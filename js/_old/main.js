/* main.js — Orchestrator: boot, game loop, NN inference, UI wiring */
'use strict';

let world, nn, trainer, renderer, interaction;
let lastTime     = 0;
let totalMs      = 0;
let isPaused     = false;
let trainPaused  = false;

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  _setLoading('Generating world…');
  world = new World();
  await world.initDB();
  const loaded = await world.loadState();
  if (!loaded) world.generate();

  _setLoading('Loading neural network…');
  nn = new NN();
  await nn.load();

  _setLoading('Preparing trainer…');
  trainer = new Trainer(nn);
  await trainer.init();
  nn.totalSamples = trainer.buffer.length;

  _setLoading('Spinning up renderer…');
  renderer    = new Renderer();
  interaction = new Interaction(world, renderer);

  _wireUI();
  _hideLoading();

  // Training loop
  setInterval(() => {
    if (!trainPaused && !isPaused) trainer.trainIfReady();
  }, C.NN_TRAIN_INTERVAL);

  // NN autonomous inference
  setInterval(_tryNNAction, 2200);

  // Auto-save
  setInterval(() => { if (!isPaused) world.saveState(); }, 20000);

  // Heart particles for loving agents
  setInterval(_emitHearts, 2800);

  requestAnimationFrame(_loop);
}

// ── Game loop ─────────────────────────────────────────────────────────────────
function _loop(now) {
  const raw = now - (lastTime || now);
  const dt  = Math.min(raw, C.MAX_DT);
  lastTime  = now;
  totalMs  += dt;

  if (!isPaused) {
    world.update(dt);
    interaction.update(dt);
  }
  renderer.render(world, interaction.state, totalMs, dt);
  _refreshHUD();
  requestAnimationFrame(_loop);
}

// ── NN autonomous action ──────────────────────────────────────────────────────
function _tryNNAction() {
  if (isPaused || trainPaused || world.persons.length === 0) return;
  if (nn.influence < 0.25) return;

  for (const person of world.persons) {
    const feat = world.getPersonFeatures(person);
    const pred = nn.predict(feat);
    if (!pred) continue;

    const roll = Math.random();
    if (pred.confidence >= C.NN_ACT_THRESHOLD && roll < nn.influence * 0.6) {
      // Actually apply the effect
      if (pred.action === 'Feed') {
        person.hunger = Math.max(0, person.hunger - 18);
        renderer.particles.feed(person.x, person.y);
      } else if (pred.action === 'Approve') {
        person.social = Math.min(100, person.social + 12);
        renderer.particles.approve(person.x, person.y);
      } else if (pred.action === 'Connect') {
        person.social = Math.min(100, person.social + 10);
      }

      events.emit('NN_DECISION', {
        action:     pred.action,
        confidence: pred.confidence,
        name:       person.name,
      });
      break; // one action per tick
    }
  }
}

// ── Hearts for loving pairs ───────────────────────────────────────────────────
function _emitHearts() {
  for (const a of world.persons) {
    for (const b of world.persons) {
      if (a.id >= b.id) continue;
      const rel = a.getRelationship(b.id);
      if (rel.affection >= C.LOVE_AFFECTION_THRESH) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        renderer.particles.heart(mx, my);
      }
    }
  }
}

// ── HUD refresh ───────────────────────────────────────────────────────────────
function _refreshHUD() {
  // Training indicator dot
  const ind = document.getElementById('training-indicator');
  if (ind) {
    ind.textContent = nn.isTraining ? 'Training…' : (trainPaused ? 'Paused' : 'Idle');
    ind.className   = nn.isTraining ? 'training-active' : (trainPaused ? 'training-paused' : '');
  }

  // Mind panel — update once per second-ish via throttle
  if (!_refreshHUD._lastMind || totalMs - _refreshHUD._lastMind > 1000) {
    _refreshHUD._lastMind = totalMs;
    _updateMindPanel();
  }
}
_refreshHUD._lastMind = 0;

function _updateMindPanel() {
  const el = document.getElementById('mind-stats');
  if (!el || world.persons.length === 0) return;

  const p    = world.persons[0];
  const feat = world.getPersonFeatures(p);
  const pred = nn.predict(feat);

  const bias = trainer.getBiasInfo();
  const biasHTML = bias
    ? bias.filter(b => b.count > 0).map(b =>
        `<div class="mind-row"><span>${b.name}</span><span class="mind-badge">${b.count}×</span></div>`
      ).join('')
    : '';

  el.innerHTML = `
    <div class="mind-row"><span>Watching</span><strong>${p.name}</strong></div>
    <div class="mind-row"><span>Would</span><strong style="color:${C.COL.NN}">${pred?.action ?? '—'}</strong></div>
    <div class="mind-row"><span>Confidence</span><span>${pred ? (pred.confidence*100).toFixed(0)+'%' : '—'}</span></div>
    <div class="mind-row"><span>Influence</span><span style="color:${C.COL.APPROVE}">${(nn.influence*100).toFixed(0)}%</span></div>
    <div class="mind-row"><span>Samples</span><span>${nn.totalSamples}</span></div>
    <div class="mind-row"><span>Hunger</span><span>${p.hunger.toFixed(0)}</span></div>
    <div class="mind-row"><span>Social</span><span>${p.social.toFixed(0)}</span></div>
    ${biasHTML}
  `;
}

// ── UI wiring ─────────────────────────────────────────────────────────────────
function _wireUI() {
  // Pause
  document.getElementById('btn-pause')?.addEventListener('click', () => {
    isPaused = !isPaused;
    document.getElementById('btn-pause').textContent = isPaused ? '▶ Resume' : '⏸ Pause';
  });

  // Stop / resume training
  document.getElementById('btn-stop-training')?.addEventListener('click', () => {
    trainPaused = !trainPaused;
    const btn = document.getElementById('btn-stop-training');
    btn.textContent = trainPaused ? '▶ Train' : '🛑 Pause Training';
    _log(trainPaused ? 'Training paused by player.' : 'Training resumed.', '#fbbf24');
  });

  // Reset modal
  document.getElementById('btn-reset')?.addEventListener('click', () => {
    const modal = document.getElementById('reset-modal');
    if (modal) { modal.classList.add('visible'); document.getElementById('reset-confirm-input').value = ''; }
  });
  document.getElementById('btn-cancel-reset')?.addEventListener('click', () => {
    document.getElementById('reset-modal')?.classList.remove('visible');
  });
  document.getElementById('btn-confirm-reset')?.addEventListener('click', async () => {
    const v = document.getElementById('reset-confirm-input')?.value.trim().toUpperCase();
    if (v === 'RESET') {
      document.getElementById('reset-modal')?.classList.remove('visible');
      ['EmergentWorld_v4','EmergentTrainer_v4'].forEach(n => { try { indexedDB.deleteDatabase(n); } catch {} });
      try { indexedDB.deleteDatabase('tensorflowjs'); } catch {}
      setTimeout(() => location.reload(), 400);
    }
  });

  // ── Event subscriptions ──
  events.on('ACTION_TAKEN', d => {
    const p = world.persons.find(x => x.id === d.targetId);
    _log(`You ${d.action.toLowerCase()}ed ${p?.name ?? d.targetId}.`, C.COL.SOCIAL);
    _whisper(`You showed the NN: ${d.action} for ${p?.name ?? ''}. It's watching.`);
  });

  events.on('NN_DECISION', d => {
    _log(`AI autonomously: ${d.action} → ${d.name} (${(d.confidence*100).toFixed(0)}% sure)`, C.COL.NN);
    _whisper(`The NN acted on its own: ${d.action} for ${d.name}.`);
  });

  events.on('NN_TRAINED', d => {
    _log(`NN trained. Loss: ${d.loss?.toFixed(4) ?? '—'}  Epochs: ${d.epochs}`, C.COL.APPROVE);
  });

  events.on('AGENT_ARRIVED', d => {
    _log(`${d.person.name} arrived.`, C.COL.APPROVE);
    _whisper(`Someone new has entered the world: ${d.person.name}.`);
  });

  events.on('FIGHT_STARTED', d => {
    renderer.particles.fight(
      ...((p => [p.x, p.y])(world.persons.find(p => p.name === d.nameA) ?? { x: C.W/2, y: C.H/2 })),
      ...((p => [p.x, p.y])(world.persons.find(p => p.name === d.nameB) ?? { x: C.W/2, y: C.H/2 }))
    );
    _log(`${d.nameA} and ${d.nameB} are fighting! 💥`, '#ef4444');
    _whisper(`${d.nameA} and ${d.nameB} started a fight.`);
  });

  events.on('GOSSIP', d => {
    const p = world.persons.find(x => x.name === d.nameA);
    if (p) renderer.particles.gossip(p.x, p.y);
    _log(`${d.nameA} and ${d.nameB} are talking. 💬`, '#94a3b8');
  });

  events.on('DAY_NIGHT_CHANGED', d => {
    _log(d.isDay ? 'The sun rises.' : 'Night falls.', '#fbbf24');
  });
}

// ── UI helpers ─────────────────────────────────────────────────────────────────
function _whisper(text) {
  const el = document.getElementById('whisper-text');
  if (el) el.textContent = text;
}

function _log(msg, color) {
  const j = document.getElementById('event-journal');
  if (!j) return;
  const div = document.createElement('div');
  div.className = 'journal-entry';
  div.style.color = color || C.COL.TEXT_MAIN;
  div.textContent = msg;
  j.prepend(div);
  while (j.children.length > 28) j.removeChild(j.lastChild);
}

function _setLoading(msg) {
  const el = document.getElementById('loading-text');
  if (el) el.textContent = msg;
}

function _hideLoading() {
  const el = document.getElementById('loading-overlay');
  if (!el) return;
  el.style.transition = 'opacity 0.6s ease';
  el.style.opacity    = '0';
  setTimeout(() => el.remove(), 700);
}

// ── Entry point ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('Boot failed:', err);
    _setLoading('Error: ' + err.message);
  });
});
