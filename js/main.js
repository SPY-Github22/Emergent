/**
 * main.js — Bootstrap & Game Loop
 * - World starts empty and STATIC (no physics until player paints)
 * - Dashboard hidden initially, reveals progressively
 * - Tutorial steps drive the first-run experience
 */

'use strict';

const GRID_W  = 50;
const GRID_H  = 50;
const CELL_PX = 12;   // → 600×600 canvas
const TICK_MS = 600;  // Tick every 600ms — slow & legible
const VIZ_MS  = 800;  // Dashboard refresh every 0.8s

let engine, nn, renderer, interaction, trainer, visualizer, ui;
let tickTimer = null;
let vizTimer  = null;
let _tickRunning = false;  // Overlap guard

// Tutorial state
let tutorialStep = 0;        // 0=not started, 1–4=steps, 5=done
let totalInteractions = 0;
let toolsUsed         = new Set();
let firstTrainingDone = false;
let dashboardRevealed = false;

// ─── Boot ─────────────────────────────────────────────────────────────
async function boot() {
  showLoading(true, 'Loading TensorFlow.js…');

  // 1. Engine — completely empty, physics off
  engine = new Engine(GRID_W, GRID_H);

  // 2. Neural network
  showLoading(true, 'Initializing neural network…');
  nn = new NeuralNet();
  await nn.init();

  // 3. Renderer
  const gridCanvas = document.getElementById('grid-canvas');
  renderer = new Renderer(gridCanvas, GRID_W, GRID_H, CELL_PX);

  // 4. Interaction
  interaction = new Interaction(gridCanvas, engine, renderer);

  // 5. Trainer
  trainer = new Trainer(nn, engine);

  // 6. Visualizer
  visualizer = new Visualizer({
    lossCanvas:  document.getElementById('loss-canvas'),
    biasCanvas:  document.getElementById('bias-canvas'),
    influenceEl: document.getElementById('influence-meter'),
    memEl:       document.getElementById('mem-info'),
    weightCanvas: document.getElementById('weight-canvas'),
  });

  // 7. UI
  ui = new UI({
    toolPalette:    document.getElementById('tool-palette'),
    brushSizeEl:    document.getElementById('brush-size'),
    brushValEl:     document.getElementById('brush-val'),
    tempSlider:     document.getElementById('temp-slider'),
    tempValEl:      document.getElementById('temp-val'),
    statsEl:        document.getElementById('stats-panel'),
    toastContainer: document.getElementById('toast-container'),
    resetBtn:       document.getElementById('btn-reset'),
    pauseBtn:       document.getElementById('btn-pause'),
    clearBtn:       document.getElementById('btn-clear'),
  });

  // ── Wire events ───────────────────────────────────────────────────

  ui.onToolChange  = (type) => {
    interaction.setTool(type);
    toolsUsed.add(type);
  };
  ui.onBrushChange = (r) => interaction.setBrushRadius(r);
  ui.onTempChange  = (t) => { nn.temperature = t; };

  ui.onPause = (paused) => {
    engine.paused = paused;
    if (paused) stopTick(); else startTick();
  };

  ui.onClear = () => {
    engine.clear();
    trainer.clearBuffer();
    renderer.fullRedraw(engine);
    totalInteractions = 0;
    toolsUsed = new Set([interaction.currentTool]);
    firstTrainingDone = false;
  };

  ui.onReset = async () => {
    stopTick();
    trainer.stopAutoTrain();
    trainer.clearBuffer();
    await nn.reset();
    engine.clear();
    engine.setNNInfluence(0);
    renderer.fullRedraw(engine);
    visualizer.lossChart.clear();
    visualizer.lossChart.draw();
    totalInteractions = 0;
    toolsUsed = new Set([interaction.currentTool]);
    firstTrainingDone = false;
    dashboardRevealed = false;
    hideDashboard();
    trainer._startAutoTrain();
    startTick();
  };

  // Player paints → training samples + tutorial advancement
  interaction.onSamples = (samples) => {
    trainer.addSamples(samples);
    totalInteractions += samples.length;
    toolsUsed.add(interaction.currentTool);

    // Activate physics on very first paint
    if (!engine.physicsActive) {
      engine.physicsActive = true;
    }

    checkTutorialProgress();
  };

  // NN callbacks
  nn.onEpochEnd     = (epoch, logs) => visualizer.onEpochEnd(epoch, logs);
  nn.onTrainingStart = ()  => ui.setTrainingStatus(true);
  nn.onTrainingEnd   = () => {
    ui.setTrainingStatus(false);
    renderer.flashTrainingPulse();
    if (!firstTrainingDone) {
      firstTrainingDone = true;
      checkTutorialProgress();
    }
  };
  nn.onInsight      = (insight) => ui.queueInsight(insight);
  trainer.onDiversityInsight = (insight) => ui.queueInsight(insight);

  // ── Start loops ───────────────────────────────────────────────────
  startTick();
  vizTimer = setInterval(vizTick, VIZ_MS);
  requestAnimationFrame(renderLoop);

  // Initial render (empty grid)
  renderer.fullRedraw(engine);

  showLoading(false);

  // Hide dashboard until earned
  hideDashboard();

  // Start tutorial
  setTimeout(() => startTutorial(), 600);
}

// ─── Simulation tick ──────────────────────────────────────────────────
function startTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(simulationTick, TICK_MS);
}
function stopTick() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = null;
}

async function simulationTick() {
  if (_tickRunning) return; // Don't stack ticks
  _tickRunning = true;
  try {
    const predictFn = (nn.isReady && !nn.isTraining && nn.nnInfluence > 0.05)
      ? (hoods) => nn.predictBatch(hoods)
      : null;
    await engine.tick(predictFn);
  } finally {
    _tickRunning = false;
  }
}

// ─── Render loop (RAF) ────────────────────────────────────────────────
function renderLoop() {
  renderer.render(engine);
  requestAnimationFrame(renderLoop);
}

// ─── Dashboard refresh ────────────────────────────────────────────────
function vizTick() {
  if (!dashboardRevealed) return;
  visualizer.tick(nn, trainer);
  ui.updateStats(engine.getStats(), nn.getStats(), trainer.getStats());
}

// ─── Progressive dashboard reveal ────────────────────────────────────
function hideDashboard() {
  const dash = document.getElementById('nn-dashboard');
  if (dash) dash.classList.add('hidden-dashboard');
}

function revealDashboard() {
  if (dashboardRevealed) return;
  dashboardRevealed = true;
  const dash = document.getElementById('nn-dashboard');
  if (dash) {
    dash.classList.remove('hidden-dashboard');
    dash.classList.add('dashboard-reveal');
  }
}

// ─── Tutorial progression ─────────────────────────────────────────────
function startTutorial() {
  tutorialStep = 1;
  showTutorialStep(1);
}

function checkTutorialProgress() {
  if (tutorialStep === 1 && totalInteractions >= 1) {
    // Player made first click → advance to step 2
    setTimeout(() => advanceTutorial(2), 400);
  } else if (tutorialStep === 2 && totalInteractions >= 30) {
    // Player painted enough → advance to step 3
    setTimeout(() => advanceTutorial(3), 600);
  } else if (tutorialStep === 3 && toolsUsed.size >= 2) {
    // Player used a second tool → advance to step 4
    setTimeout(() => advanceTutorial(4), 600);
  } else if (tutorialStep === 4 && firstTrainingDone) {
    // First training complete → reveal dashboard, finish tutorial
    setTimeout(() => {
      revealDashboard();
      advanceTutorial(5);
    }, 1000);
  }
}

function advanceTutorial(step) {
  tutorialStep = step;
  showTutorialStep(step);
}

function showTutorialStep(step) {
  // Dismiss existing step card
  document.querySelectorAll('.tutorial-card').forEach(el => el.remove());

  if (step === 5) {
    // Tutorial complete — show a brief success toast
    ui.queueInsight({
      type: 'tutorial_complete', title: 'You\'re on your own now.',
      message: 'Explore freely. Try different patterns. Watch what your AI learns. There are no rules — only consequences.',
      emoji: '🚀', severity: 'success', level: 1,
    });
    return;
  }

  const steps = {
    1: {
      emoji: '🌍',
      title: 'Your world is empty.',
      body:  'Nothing moves. Nothing lives. <strong>Click or drag anywhere on the dark grid</strong> to paint your first living cells.',
      progress: 1,
      position: 'center',
    },
    2: {
      emoji: '🖌️',
      title: 'Keep painting.',
      body:  'Fill in a pattern — a cluster, a line, a shape. The more cells you paint, the more your AI has to learn from.',
      progress: 2,
      position: 'canvas-right',
    },
    3: {
      emoji: '🔬',
      title: 'Try a different material.',
      body:  'Select <strong>Food ✦</strong> or <strong>Energy ⚡</strong> from the toolbar and paint near your Alive cells. Different materials create different dynamics.',
      progress: 3,
      position: 'sidebar-right',
    },
    4: {
      emoji: '⏳',
      title: 'Your AI is learning…',
      body:  'It trains automatically every few seconds. When it finishes its first round, your dashboard will unlock. Keep painting.',
      progress: 4,
      position: 'canvas-right',
    },
  };

  const s = steps[step];
  if (!s) return;

  const card = document.createElement('div');
  card.className = `tutorial-card tutorial-pos-${s.position}`;
  card.innerHTML = `
    <div class="tc-emoji">${s.emoji}</div>
    <div class="tc-title">${s.title}</div>
    <p class="tc-body">${s.body}</p>
    <div class="tc-footer">
      <div class="tc-dots">
        ${[1,2,3,4].map(i => `<span class="tc-dot ${i === s.progress ? 'active' : (i < s.progress ? 'done' : '')}"></span>`).join('')}
      </div>
      <button class="tc-skip" onclick="skipTutorial()">Skip guide</button>
    </div>
  `;
  document.body.appendChild(card);
  requestAnimationFrame(() => card.classList.add('visible'));
}

window.skipTutorial = function () {
  document.querySelectorAll('.tutorial-card').forEach(el => el.remove());
  tutorialStep = 5;
  revealDashboard();
};

// ─── Loading ──────────────────────────────────────────────────────────
function showLoading(show, msg = '') {
  const el = document.getElementById('loading-overlay');
  if (!el) return;
  if (show) {
    el.classList.remove('hidden');
    const sub = el.querySelector('.loading-sub');
    if (sub && msg) sub.textContent = msg;
  } else {
    el.classList.add('hidden');
  }
}

// ─── Start ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  boot().catch(err => {
    console.error('[EMERGENT] Boot failed:', err);
    showLoading(true, 'Error: ' + err.message);
  });
});
