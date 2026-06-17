/**
 * engine.js — Grid Simulation Engine (50×50, 12 cell types)
 * Physics starts DISABLED — activates only after player first paints.
 * Probabilities are tuned to be calm and legible, not frantic.
 */

'use strict';

const CELL = Object.freeze({
  EMPTY:     0,
  ALIVE:     1,
  FOOD:      2,
  HAZARD:    3,
  SIGNAL:    4,
  WALL:      5,
  ENERGY:    6,
  DECAY:     7,
  SEED:      8,
  CONDUCTOR: 9,
  PREDATOR:  10,
  CRYSTAL:   11,
});

const CELL_NAMES = [
  'Empty','Alive','Food','Hazard','Signal','Wall',
  'Energy','Decay','Seed','Conductor','Predator','Crystal',
];

const NUM_TYPES         = 12;
const NEIGHBORHOOD_RADIUS = 2;
const NEIGHBORHOOD_SIZE   = (NEIGHBORHOOD_RADIUS * 2 + 1) ** 2; // 25

// ─────────────────────────────────────────────
// Physics — tuned to be slow and visible, not frantic
// ─────────────────────────────────────────────
const PHYSICS = {
  step(cell, neighbors, rand) {
    const c = new Int32Array(NUM_TYPES);
    for (const n of neighbors) c[n]++;

    switch (cell) {
      case CELL.EMPTY: {
        // Very low spread probabilities — changes should be noticeable, not noise
        if (c[CELL.ALIVE]  >= 3 && rand() < 0.012) return CELL.ALIVE;
        if (c[CELL.FOOD]   >= 4 && rand() < 0.008) return CELL.FOOD;
        if (c[CELL.SIGNAL] >= 1 && rand() < 0.08)  return CELL.SIGNAL;
        if (c[CELL.SEED]   >= 1 && rand() < 0.018) return CELL.ALIVE;
        if (c[CELL.CRYSTAL]>= 3 && rand() < 0.02)  return CELL.CRYSTAL;
        return CELL.EMPTY;
      }
      case CELL.ALIVE: {
        if (c[CELL.HAZARD]  >= 2 && rand() < 0.15) return CELL.DECAY;
        if (c[CELL.PREDATOR]>= 1 && rand() < 0.10) return CELL.EMPTY;
        if (c[CELL.DECAY]   >= 2 && rand() < 0.08) return CELL.DECAY;
        if (c[CELL.ALIVE]   >  6 && rand() < 0.04) return CELL.DECAY; // overcrowding
        if (c[CELL.ALIVE]   <  2 && rand() < 0.02) return CELL.EMPTY; // loneliness
        if (c[CELL.FOOD]    >= 2 && rand() < 0.02) return CELL.ENERGY;
        return CELL.ALIVE;
      }
      case CELL.FOOD: {
        if (c[CELL.ALIVE] >= 4 && rand() < 0.06) return CELL.EMPTY;
        return CELL.FOOD;
      }
      case CELL.HAZARD: {
        if (rand() < 0.002) return CELL.EMPTY;
        return CELL.HAZARD;
      }
      case CELL.SIGNAL: {
        // Signal fades — this is intentional and visible
        if (rand() < 0.35) return CELL.EMPTY;
        return CELL.SIGNAL;
      }
      case CELL.WALL:
        return CELL.WALL;
      case CELL.ENERGY: {
        if (rand() < 0.02)  return CELL.ALIVE;
        if (rand() < 0.015) return CELL.EMPTY;
        return CELL.ENERGY;
      }
      case CELL.DECAY: {
        if (rand() < 0.08) return CELL.EMPTY;
        return CELL.DECAY;
      }
      case CELL.SEED: {
        const pressure = c[CELL.ALIVE] + c[CELL.FOOD];
        if (pressure >= 4 && rand() < 0.12) return CELL.ALIVE;
        if (rand() < 0.001) return CELL.ALIVE;
        return CELL.SEED;
      }
      case CELL.CONDUCTOR: {
        if (c[CELL.SIGNAL] >= 1 && rand() < 0.5) return CELL.SIGNAL;
        return CELL.CONDUCTOR;
      }
      case CELL.PREDATOR: {
        if (c[CELL.ALIVE] === 0 && rand() < 0.05) return CELL.EMPTY;
        return CELL.PREDATOR;
      }
      case CELL.CRYSTAL: {
        if (c[CELL.DECAY] >= 2 && rand() < 0.05) return CELL.EMPTY;
        return CELL.CRYSTAL;
      }
      default: return CELL.EMPTY;
    }
  }
};

// ─────────────────────────────────────────────
// Engine
// ─────────────────────────────────────────────
class Engine {
  constructor(width, height) {
    this.width  = width;
    this.height = height;
    this.size   = width * height;

    this.grid     = new Uint8Array(this.size);
    this.nextGrid = new Uint8Array(this.size);
    this.dirtySet = new Set();

    this.tickCount    = 0;
    this.nnInfluence  = 0;
    this.paused       = false;

    // Physics starts OFF — enabled after player's first paint
    this.physicsActive = false;

    this.onTick = null;

    for (let i = 0; i < this.size; i++) this.dirtySet.add(i);
  }

  idx(x, y)      { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && x < this.width && y >= 0 && y < this.height; }

  getCell(x, y) {
    if (!this.inBounds(x, y)) return CELL.EMPTY;
    return this.grid[this.idx(x, y)];
  }

  setCell(x, y, value) {
    if (!this.inBounds(x, y)) return;
    const i = this.idx(x, y);
    if (this.grid[i] !== value) {
      this.grid[i] = value;
      this.dirtySet.add(i);
    }
  }

  getNeighborhood(cx, cy) {
    const hood = new Float32Array(NEIGHBORHOOD_SIZE);
    let k = 0;
    for (let dy = -NEIGHBORHOOD_RADIUS; dy <= NEIGHBORHOOD_RADIUS; dy++) {
      for (let dx = -NEIGHBORHOOD_RADIUS; dx <= NEIGHBORHOOD_RADIUS; dx++) {
        hood[k++] = this.getCell(cx + dx, cy + dy) / (NUM_TYPES - 1);
      }
    }
    return hood;
  }

  getMooreNeighbors(cx, cy) {
    const nb = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        nb.push(this.getCell(cx + dx, cy + dy));
      }
    }
    return nb;
  }

  applyTool(cx, cy, cellType, brushRadius = 1) {
    const samples = [];
    for (let dy = -brushRadius; dy <= brushRadius; dy++) {
      for (let dx = -brushRadius; dx <= brushRadius; dx++) {
        if (dx * dx + dy * dy > brushRadius * brushRadius) continue;
        const x = cx + dx, y = cy + dy;
        if (!this.inBounds(x, y)) continue;
        const neighborhood = this.getNeighborhood(x, y);
        this.setCell(x, y, cellType);
        samples.push({ neighborhood, cellType });
      }
    }
    return samples;
  }

  async tick(nnPredictBatch) {
    if (this.paused) return;

    // If physics is not active (pre-first-paint), world stays still
    if (!this.physicsActive) return;

    // Physics pass: update only a random 35% subset each tick
    // This reduces CPU load and makes changes look organic, not instantaneous
    const updateCount = Math.floor(this.size * 0.35);
    for (let k = 0; k < updateCount; k++) {
      const i = Math.floor(Math.random() * this.size);
      const x = i % this.width;
      const y = (i - x) / this.width;
      if (this.grid[i] === CELL.WALL) { this.nextGrid[i] = CELL.WALL; continue; }
      const nb = this.getMooreNeighbors(x, y);
      this.nextGrid[i] = PHYSICS.step(this.grid[i], nb, Math.random);
      if (this.nextGrid[i] !== this.grid[i]) this.dirtySet.add(i);
    }

    // Copy unchanged cells to nextGrid
    for (let i = 0; i < this.size; i++) {
      if (!this.dirtySet.has(i)) this.nextGrid[i] = this.grid[i];
    }

    // NN override pass (only when trained)
    if (nnPredictBatch && this.nnInfluence > 0.05) {
      const nnCount = Math.floor(this.size * 0.06); // 6% of cells
      const nnCells = this._sampleCells(nnCount);
      try {
        const hoods  = nnCells.map(({ x, y }) => this.getNeighborhood(x, y));
        const preds  = await nnPredictBatch(hoods);
        for (let k = 0; k < nnCells.length; k++) {
          const { x, y } = nnCells[k];
          const i = this.idx(x, y);
          if (this.grid[i] === CELL.WALL) continue;
          if (Math.random() < this.nnInfluence) {
            this.nextGrid[i] = preds[k];
            if (this.nextGrid[i] !== this.grid[i]) this.dirtySet.add(i);
          }
        }
      } catch (_) {}
    }

    // Swap
    const tmp = this.grid; this.grid = this.nextGrid; this.nextGrid = tmp;
    this.tickCount++;
    if (this.onTick) this.onTick(this.tickCount);
  }

  _sampleCells(count) {
    const cells = [];
    for (let k = 0; k < count; k++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      cells.push({ x, y });
    }
    return cells;
  }

  clear() {
    this.grid.fill(0); this.nextGrid.fill(0);
    this.dirtySet.clear();
    for (let i = 0; i < this.size; i++) this.dirtySet.add(i);
    this.tickCount    = 0;
    this.physicsActive = false;
  }

  setNNInfluence(v) { this.nnInfluence = Math.max(0, Math.min(1, v)); }

  getStats() {
    const counts = new Int32Array(NUM_TYPES);
    for (let i = 0; i < this.size; i++) counts[this.grid[i]]++;
    return { total: this.size, counts: Array.from(counts), nnInfluence: this.nnInfluence, tickCount: this.tickCount };
  }
}

window.CELL             = CELL;
window.CELL_NAMES       = CELL_NAMES;
window.NUM_TYPES        = NUM_TYPES;
window.NEIGHBORHOOD_SIZE = NEIGHBORHOOD_SIZE;
window.Engine           = Engine;
