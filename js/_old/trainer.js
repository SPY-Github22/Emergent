/* trainer.js — Class-balanced experience replay buffer + training scheduler */
'use strict';

class Trainer {
  constructor(nn) {
    this.nn       = nn;
    this.buffer   = [];
    this.maxBuf   = 1200;
    this.counts   = new Array(C.NN_ACTIONS).fill(0); // per-action sample counts
    this.db       = null;
    this.dbName   = 'EmergentTrainer_v4';

    events.on('ACTION_TAKEN', this._onAction.bind(this));
  }

  async init() {
    await this._openDB();
    await this._loadBuffer();
    this.nn.totalSamples = this.buffer.length;
  }

  // ── IndexedDB ────────────────────────────────
  async _openDB() {
    return new Promise(resolve => {
      try {
        const req = indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = e => e.target.result.createObjectStore('s', { autoIncrement: true });
        req.onsuccess = e => { this.db = e.target.result; resolve(); };
        req.onerror   = () => resolve();
      } catch { resolve(); }
    });
  }

  async _loadBuffer() {
    if (!this.db) return;
    return new Promise(resolve => {
      try {
        const tx = this.db.transaction('s', 'readonly');
        tx.objectStore('s').getAll().onsuccess = e => {
          const all = e.target.result || [];
          this.buffer = all.slice(-this.maxBuf);
          for (const s of this.buffer) {
            if (s.i >= 0 && s.i < C.NN_ACTIONS) this.counts[s.i]++;
          }
          resolve();
        };
      } catch { resolve(); }
    });
  }

  _persist(sample) {
    if (!this.db) return;
    try {
      this.db.transaction('s', 'readwrite').objectStore('s').add(sample);
    } catch {}
  }

  // ── Receive player action ────────────────────
  _onAction(data) {
    const { features, actionIdx } = data;
    if (!features || actionIdx === undefined || actionIdx < 0) return;

    const s = { f: features, i: actionIdx };
    this.buffer.push(s);
    this.counts[actionIdx]++;
    this.nn.totalSamples++;

    if (this.buffer.length > this.maxBuf) {
      const old = this.buffer.shift();
      if (old.i >= 0 && old.i < C.NN_ACTIONS) this.counts[old.i] = Math.max(0, this.counts[old.i] - 1);
    }
    this._persist(s);
  }

  // ── Build a class-balanced training batch ────
  _balancedBatch(size) {
    if (this.buffer.length === 0) return { xArr: [], yArr: [] };

    // Group by action
    const byAction = Array.from({ length: C.NN_ACTIONS }, () => []);
    for (const s of this.buffer) {
      if (s.i >= 0 && s.i < C.NN_ACTIONS) byAction[s.i].push(s);
    }
    const populated = byAction.filter(g => g.length > 0);
    if (!populated.length) return { xArr: [], yArr: [] };

    const perClass = Math.ceil(size / populated.length);
    const batch = [];
    for (const grp of populated) {
      const n = Math.min(perClass, grp.length);
      // Reservoir-sample n items
      const shuffled = [...grp].sort(() => Math.random() - 0.5);
      batch.push(...shuffled.slice(0, n));
    }

    const xArr = [], yArr = [];
    for (const s of batch.sort(() => Math.random() - 0.5)) {
      xArr.push(s.f);
      const y = new Array(C.NN_ACTIONS).fill(0);
      y[s.i] = 1;
      yArr.push(y);
    }
    return { xArr, yArr };
  }

  // ── Training call ────────────────────────────
  async trainIfReady() {
    if (this.buffer.length < C.NN_MIN_SAMPLES) return;
    if (this.nn.isTraining) return;

    const { xArr, yArr } = this._balancedBatch(80);
    if (xArr.length < 8) return;
    await this.nn.train(xArr, yArr);
  }

  // ── Stats for UI ─────────────────────────────
  getBiasInfo() {
    const total = this.counts.reduce((a, b) => a + b, 0);
    if (!total) return null;
    return C.ACTIONS.map((name, i) => ({
      name,
      count: this.counts[i] || 0,
      pct: (((this.counts[i] || 0) / total) * 100).toFixed(0),
    }));
  }
}
