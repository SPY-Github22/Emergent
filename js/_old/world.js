/* world.js — Simulation world: food nodes, day/night, agent management, persistence */
'use strict';

// ─── Food node ────────────────────────────────────────────────────────────────
class FoodNode {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.capacity = C.FOOD_CAPACITY;
    this.amount   = this.capacity;
  }

  update(dt) {
    this.amount = Math.min(this.capacity, this.amount + C.FOOD_REPLENISH * dt);
  }

  draw(ctx) {
    const pct  = this.amount / this.capacity;
    const r    = 7 + pct * 7;
    const alph = 0.35 + pct * 0.55;

    // Outer glow
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r + 14);
    grad.addColorStop(0, `rgba(74, 222, 128, ${alph * 0.55})`);
    grad.addColorStop(1, 'rgba(74,222,128,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r + 14, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.strokeStyle = `rgba(34,197,94,${alph})`;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + r);
    ctx.lineTo(this.x, this.y + r + 8);
    ctx.stroke();
    // Leaf
    ctx.strokeStyle = `rgba(52,211,153,${alph * 0.7})`;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y + r + 4);
    ctx.quadraticCurveTo(this.x + 8, this.y + r, this.x + 6, this.y + r + 8);
    ctx.stroke();

    // Core circle
    ctx.fillStyle = `rgba(74,222,128,${alph})`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Shine spot
    ctx.fillStyle = `rgba(187,247,208,${alph * 0.6})`;
    ctx.beginPath();
    ctx.arc(this.x - r * 0.3, this.y - r * 0.3, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── World ────────────────────────────────────────────────────────────────────
class World {
  constructor() {
    this.persons      = [];
    this.foodNodes    = [];
    this.absoluteTime = 0;
    this.isDay        = true;
    this.agentsArrived= 0;

    // Agent spawn schedule (ms from start)
    this.spawnSchedule = [2500, 9000];

    this.db     = null;
    this.dbName = 'EmergentWorld_v4';
  }

  // ── Generation ──────────────────────────────
  generate() {
    // Four food nodes, spread across the world
    const positions = [
      { x: C.W * 0.18, y: C.H * 0.30 },
      { x: C.W * 0.78, y: C.H * 0.22 },
      { x: C.W * 0.55, y: C.H * 0.72 },
      { x: C.W * 0.12, y: C.H * 0.70 },
    ];
    this.foodNodes = positions.map(p => new FoodNode(p.x, p.y));
  }

  // ── IndexedDB ───────────────────────────────
  async initDB() {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = e => {
          e.target.result.createObjectStore('world', { keyPath: 'id' });
        };
        req.onsuccess = e => { this.db = e.target.result; resolve(); };
        req.onerror   = () => resolve(); // graceful fail (private mode)
      } catch { resolve(); }
    });
  }

  async saveState() {
    if (!this.db) return;
    const state = {
      id: 'w4',
      absoluteTime:  this.absoluteTime,
      isDay:         this.isDay,
      agentsArrived: this.agentsArrived,
      persons:  this.persons.map(p => p.getState()),
      foodNodes: this.foodNodes.map(f => ({ x: f.x, y: f.y, amount: f.amount })),
    };
    return new Promise(resolve => {
      try {
        const tx = this.db.transaction('world', 'readwrite');
        tx.objectStore('world').put(state);
        tx.oncomplete = resolve;
        tx.onerror    = resolve;
      } catch { resolve(); }
    });
  }

  async loadState() {
    if (!this.db) return false;
    return new Promise(resolve => {
      try {
        const tx = this.db.transaction('world', 'readonly');
        tx.objectStore('world').get('w4').onsuccess = e => {
          const s = e.target.result;
          if (!s) { resolve(false); return; }

          this.absoluteTime  = s.absoluteTime  || 0;
          this.isDay         = s.isDay !== undefined ? s.isDay : true;
          this.agentsArrived = s.agentsArrived || 0;

          this.persons = (s.persons || []).map(ps => {
            const p = new Person(ps.id, ps.x, ps.y, ps.name);
            p.hunger = ps.hunger;
            p.social = ps.social;
            if (ps.rel) p.rel = ps.rel;
            return p;
          });

          if (s.foodNodes) {
            this.foodNodes = s.foodNodes.map(f => {
              const n = new FoodNode(f.x, f.y);
              n.amount = f.amount;
              return n;
            });
          } else {
            this.generate(); // regenerate if missing
          }

          resolve(true);
        };
      } catch { resolve(false); }
    });
  }

  // ── Per-frame update ────────────────────────
  update(dtMs) {
    const dt  = Math.min(dtMs, C.MAX_DT);
    const dtS = dt / 1000;

    const prev = this.absoluteTime;
    this.absoluteTime += dt;

    // Day / night flip
    const half    = C.DAY_DURATION / 2;
    const prevH   = Math.floor(prev / half);
    const currH   = Math.floor(this.absoluteTime / half);
    if (currH > prevH) {
      this.isDay = !this.isDay;
      events.emit('DAY_NIGHT_CHANGED', { isDay: this.isDay });
    }

    // Food
    for (const f of this.foodNodes) f.update(dtS);

    // Agents
    for (const p of this.persons) p.update(dt, this);

    // Social events (fights, gossip)
    this._checkSocialEvents(dtS);

    // Scheduled arrivals
    while (
      this.agentsArrived < this.spawnSchedule.length &&
      this.absoluteTime  >= this.spawnSchedule[this.agentsArrived]
    ) {
      this._spawnAgent();
    }
  }

  // ── Agent spawning ──────────────────────────
  _spawnAgent() {
    const idx  = this.agentsArrived;
    const name = NameGen.generate();
    const sx   = idx === 0 ? 50 : C.W - 50;
    const sy   = C.H * 0.45 + (Math.random() - 0.5) * 80;

    const p = new Person(`agent_${idx + 1}`, sx, sy, name);
    // Walk toward center on spawn
    p.tx = C.W * 0.35 + Math.random() * C.W * 0.3;
    p.ty = C.H * 0.35 + Math.random() * C.H * 0.3;

    this.persons.push(p);
    this.agentsArrived++;
    events.emit('AGENT_ARRIVED', { person: p });
  }

  // ── Social event checker ─────────────────────
  _checkSocialEvents(dtS) {
    const ps = this.persons;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];

        // Skip if either already fighting
        if (a.state === 'FIGHTING' || b.state === 'FIGHTING') continue;

        const d = Math.hypot(a.x - b.x, a.y - b.y);

        if (d < 45) {
          const rA = a.getRelationship(b.id);
          const rB = b.getRelationship(a.id);

          // ── Fight ──────────────────────────────────────────
          const canFight =
            rA.affection < C.FIGHT_AFFECTION_THRESH &&
            rB.affection < C.FIGHT_AFFECTION_THRESH &&
            (a.hunger > 55 || b.hunger > 55) &&
            (a.aggression + b.aggression) > 0.6;

          if (canFight && Math.random() < C.FIGHT_PROB * dtS) {
            a.state = 'FIGHTING'; a.fightTimer = C.FIGHT_DURATION; a.fightTarget = b.id;
            b.state = 'FIGHTING'; b.fightTimer = C.FIGHT_DURATION; b.fightTarget = a.id;
            a.modAffection(b.id, -0.18);
            b.modAffection(a.id, -0.18);
            a.social = Math.max(0, a.social - 12);
            b.social = Math.max(0, b.social - 12);
            events.emit('FIGHT_STARTED', { nameA: a.name, nameB: b.name });
          }

          // ── Gossip ─────────────────────────────────────────
          const canGossip =
            a.state === 'WANDERING' && b.state === 'WANDERING' &&
            rA.affection >= -0.1 &&
            d < C.GOSSIP_DIST &&
            Math.random() < 0.003 * dtS;

          if (canGossip) {
            a.state = 'GOSSIPING'; a.gossipWith = b.id; a.gossipTimer = C.GOSSIP_DURATION;
            b.state = 'GOSSIPING'; b.gossipWith = a.id; b.gossipTimer = C.GOSSIP_DURATION;
            a.modAffection(b.id, 0.05);
            b.modAffection(a.id, 0.05);
            events.emit('GOSSIP', { nameA: a.name, nameB: b.name });
          }
        }
      }
    }
  }

  // ── NN feature extraction ────────────────────
  getPersonFeatures(person) {
    const dayPhase = (this.absoluteTime % C.DAY_DURATION) / C.DAY_DURATION;
    const tod      = Math.sin(dayPhase * Math.PI * 2) * 0.5 + 0.5;
    const diag     = Math.hypot(C.W, C.H);

    let fDist = 1, fAX = 0, fAY = 0;
    for (const f of this.foodNodes) {
      if (f.amount < 5) continue;
      const d = Math.hypot(f.x - person.x, f.y - person.y);
      const n = d / diag;
      if (n < fDist) { fDist = n; fAX = (f.x - person.x) / d; fAY = (f.y - person.y) / d; }
    }

    let aDist = 1, aAX = 0, aAY = 0;
    for (const p of this.persons) {
      if (p.id === person.id) continue;
      const d = Math.hypot(p.x - person.x, p.y - person.y);
      const n = d / diag;
      if (n < aDist) { aDist = n; aAX = (p.x - person.x) / d; aAY = (p.y - person.y) / d; }
    }

    return [
      person.hunger / 100,
      person.social  / 100,
      tod,
      fDist, fAX, fAY,
      aDist, aAX, aAY,
    ];
  }
}
