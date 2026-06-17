/**
 * ui.js — HUD, Tool Palette, Insight Toast System, Onboarding
 */

'use strict';

// ─────────────────────────────────────────────
// Tool definitions (all 12 cell types + erase)
// ─────────────────────────────────────────────
const TOOLS = [
  { type: CELL.ALIVE,     icon: '◉',  label: 'Alive',     key: '1', desc: 'Living cell — spreads and forms colonies' },
  { type: CELL.FOOD,      icon: '✦',  label: 'Food',      key: '2', desc: 'Sustains Alive cells — grows slowly' },
  { type: CELL.HAZARD,    icon: '☠',  label: 'Hazard',    key: '3', desc: 'Kills nearby Alive — stable poison' },
  { type: CELL.SIGNAL,    icon: '~',  label: 'Signal',    key: '4', desc: 'Propagating wave — fades quickly' },
  { type: CELL.WALL,      icon: '█',  label: 'Wall',      key: '5', desc: 'Immovable barrier — shapes the world' },
  { type: CELL.ENERGY,    icon: '⚡', label: 'Energy',    key: '6', desc: 'Amplifier — boosts nearby cells' },
  { type: CELL.DECAY,     icon: '☣',  label: 'Decay',     key: '7', desc: 'Spreading death — consumes everything' },
  { type: CELL.SEED,      icon: '●',  label: 'Seed',      key: '8', desc: 'Dormant — bursts into life when ready' },
  { type: CELL.CONDUCTOR, icon: '⟶', label: 'Conductor', key: '9', desc: 'Routes Signal efficiently — wire-like' },
  { type: CELL.PREDATOR,  icon: '✕',  label: 'Predator',  key: '0', desc: 'Hunts Alive cells — apex organism' },
  { type: CELL.CRYSTAL,   icon: '◇',  label: 'Crystal',   key: 'q', desc: 'Geometric growth — forms patterns' },
  { type: CELL.EMPTY,     icon: '○',  label: 'Erase',     key: 'e', desc: 'Erase cells — remove training signal' },
];

class UI {
  constructor(opts) {
    this.toolPalette    = opts.toolPalette;
    this.brushSizeEl    = opts.brushSizeEl;
    this.brushValEl     = opts.brushValEl;
    this.tempSlider     = opts.tempSlider;
    this.tempValEl      = opts.tempValEl;
    this.statsEl        = opts.statsEl;
    this.toastContainer = opts.toastContainer;
    this.onboardingEl   = opts.onboardingEl;
    this.resetBtn       = opts.resetBtn;
    this.pauseBtn       = opts.pauseBtn;
    this.clearBtn       = opts.clearBtn;
    this.seedBtn        = opts.seedBtn;

    this.onToolChange   = null;
    this.onBrushChange  = null;
    this.onTempChange   = null;
    this.onReset        = null;
    this.onPause        = null;
    this.onClear        = null;
    this.onSeed         = null;

    this._activeTool    = CELL.ALIVE;
    this._paused        = false;
    this._insightQueue  = [];
    this._showingInsight = false;

    // Track which insight levels have been seen (for progressive unlocking)
    this._seenInsightTypes = new Set();

    this._buildToolPalette();
    this._bindControls();
    this._bindKeyboard();
  }

  // ─── Tool palette ─────────────────────────
  _buildToolPalette() {
    this.toolPalette.innerHTML = '';
    for (const tool of TOOLS) {
      const btn = document.createElement('button');
      btn.className    = 'tool-btn';
      btn.dataset.type = tool.type;
      btn.dataset.key  = tool.key;
      btn.title        = `${tool.label} — ${tool.desc} [${tool.key.toUpperCase()}]`;
      btn.innerHTML = `
        <span class="tool-icon" style="color:${CELL_COLORS[tool.type]}">${tool.icon}</span>
        <span class="tool-label">${tool.label}</span>
        <span class="tool-key">${tool.key.toUpperCase()}</span>
      `;
      btn.addEventListener('click', () => this.setActiveTool(tool.type));
      this.toolPalette.appendChild(btn);
    }
    this.setActiveTool(CELL.ALIVE);
  }

  setActiveTool(type) {
    this._activeTool = type;
    this.toolPalette.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.type) === type);
    });
    if (this.onToolChange) this.onToolChange(type);
  }

  // ─── Controls ─────────────────────────────
  _bindControls() {
    // Brush size
    if (this.brushSizeEl) {
      this.brushSizeEl.addEventListener('input', () => {
        const v = parseInt(this.brushSizeEl.value);
        this.brushValEl.textContent = v;
        if (this.onBrushChange) this.onBrushChange(v);
      });
    }

    // Temperature
    if (this.tempSlider) {
      this.tempSlider.addEventListener('input', () => {
        const v = parseFloat(this.tempSlider.value);
        this.tempValEl.textContent = v.toFixed(1);
        if (this.onTempChange) this.onTempChange(v);
      });
    }

    // Action buttons
    if (this.resetBtn) this.resetBtn.addEventListener('click', () => {
      if (confirm('Reset the AI? All learned behavior will be forgotten (Catastrophic Forgetting).')) {
        if (this.onReset) this.onReset();
      }
    });

    if (this.pauseBtn) this.pauseBtn.addEventListener('click', () => {
      this._paused = !this._paused;
      this.pauseBtn.textContent = this._paused ? '▶ Resume' : '⏸ Pause';
      this.pauseBtn.classList.toggle('active', this._paused);
      if (this.onPause) this.onPause(this._paused);
    });

    if (this.clearBtn) this.clearBtn.addEventListener('click', () => {
      if (this.onClear) this.onClear();
    });

    if (this.seedBtn) this.seedBtn.addEventListener('click', () => {
      if (this.onSeed) this.onSeed();
    });
  }

  _bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      const tool = TOOLS.find(t => t.key === key);
      if (tool) {
        this.setActiveTool(tool.type);
        return;
      }
      // Space = pause
      if (e.code === 'Space') {
        e.preventDefault();
        this.pauseBtn?.click();
      }
      // [ ] = brush size
      if (key === '[') this._adjustBrush(-1);
      if (key === ']') this._adjustBrush(+1);
    });
  }

  _adjustBrush(delta) {
    if (!this.brushSizeEl) return;
    const cur = parseInt(this.brushSizeEl.value);
    const nxt = Math.max(0, Math.min(5, cur + delta));
    this.brushSizeEl.value      = nxt;
    this.brushValEl.textContent = nxt;
    if (this.onBrushChange) this.onBrushChange(nxt);
  }

  // ─── Stats HUD ────────────────────────────
  updateStats(engineStats, nnStats, trainerStats) {
    if (!this.statsEl) return;
    const influence   = (engineStats.nnInfluence * 100).toFixed(0);
    const loss        = nnStats.lastLoss    != null ? nnStats.lastLoss.toFixed(3)    : '—';
    const acc         = nnStats.lastAccuracy != null ? (nnStats.lastAccuracy * 100).toFixed(0) + '%' : '—';
    const samples     = nnStats.totalSamples;
    const epochs      = nnStats.totalEpochs;
    const aliveCount  = engineStats.counts[CELL.ALIVE] || 0;
    const diversity   = (trainerStats.diversityScore * 100).toFixed(0);
    const tick        = engineStats.tickCount;

    this.statsEl.innerHTML = `
      <div class="stat-row"><span class="stat-label">Tick</span><span class="stat-val">${tick}</span></div>
      <div class="stat-row"><span class="stat-label">Alive</span><span class="stat-val" style="color:#00d4ff">${aliveCount}</span></div>
      <div class="stat-row"><span class="stat-label">NN Influence</span><span class="stat-val" style="color:#7c3aed">${influence}%</span></div>
      <div class="stat-row"><span class="stat-label">Loss</span><span class="stat-val">${loss}</span></div>
      <div class="stat-row"><span class="stat-label">Accuracy</span><span class="stat-val">${acc}</span></div>
      <div class="stat-row"><span class="stat-label">Samples</span><span class="stat-val">${samples}</span></div>
      <div class="stat-row"><span class="stat-label">Epochs</span><span class="stat-val">${epochs}</span></div>
      <div class="stat-row"><span class="stat-label">Buffer</span><span class="stat-val">${trainerStats.bufferSize}/${trainerStats.maxBuffer}</span></div>
      <div class="stat-row"><span class="stat-label">Diversity</span><span class="stat-val" style="color:#84cc16">${diversity}%</span></div>
    `;
  }

  // ─── Insight toast system ─────────────────
  queueInsight(insight) {
    // Progressive unlock: only show level-appropriate insights
    const level = insight.level || 1;
    const minSamples = (level - 1) * 80;

    // Don't repeat same insight type too often
    if (this._seenInsightTypes.has(insight.type)) {
      if (!['data_bias', 'underfitting'].includes(insight.type)) return;
    }
    this._seenInsightTypes.add(insight.type);
    this._insightQueue.push(insight);
    this._processQueue();
  }

  _processQueue() {
    if (this._showingInsight || this._insightQueue.length === 0) return;
    const insight = this._insightQueue.shift();
    this._showInsight(insight);
  }

  _showInsight(insight) {
    this._showingInsight = true;

    const severityColors = {
      success: '#10b981',
      warning: '#f59e0b',
      error:   '#ef4444',
      info:    '#38bdf8',
    };
    const color = severityColors[insight.severity] || '#00d4ff';

    const toast = document.createElement('div');
    toast.className = 'insight-toast';
    toast.style.cssText = `border-left-color: ${color};`;
    toast.innerHTML = `
      <div class="insight-header">
        <span class="insight-emoji">${insight.emoji}</span>
        <span class="insight-title" style="color:${color}">${insight.title}</span>
        <button class="insight-close" onclick="this.parentElement.parentElement.remove()">✕</button>
      </div>
      <p class="insight-msg">${insight.message}</p>
    `;
    this.toastContainer.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('visible'));

    // Auto-remove after 8s
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => {
        toast.remove();
        this._showingInsight = false;
        // Small delay before next toast
        setTimeout(() => this._processQueue(), 600);
      }, 400);
    }, 8000);
  }

  // ─── Onboarding ───────────────────────────
  showOnboarding() {
    if (!this.onboardingEl) return;
    this.onboardingEl.classList.add('visible');
    this.onboardingEl.querySelector('.close-onboard')?.addEventListener('click', () => {
      this.onboardingEl.classList.remove('visible');
      localStorage.setItem('emergent_onboarded', '1');
    });
  }

  checkOnboarding() {
    if (!localStorage.getItem('emergent_onboarded')) {
      setTimeout(() => this.showOnboarding(), 800);
    }
  }

  // ─── Training status indicator ────────────
  setTrainingStatus(isTraining) {
    const el = document.getElementById('training-indicator');
    if (!el) return;
    el.classList.toggle('active', isTraining);
    el.textContent = isTraining ? '⚡ Training...' : '● Idle';
  }
}

window.UI    = UI;
window.TOOLS = TOOLS;
