/**
 * visualizer.js — Live NN Visualization
 * Real-time loss/accuracy charts, cell distribution bar, NN influence meter,
 * and weight heatmap. All drawn on HTML5 Canvas — zero external dependencies.
 */

'use strict';

// ─────────────────────────────────────────────
// Mini sparkline chart
// ─────────────────────────────────────────────
class Sparkline {
  constructor(canvas, options = {}) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.series  = {};  // { name: Float32Array }
    this.colors  = options.colors || ['#00d4ff', '#10b981', '#f59e0b', '#ef4444'];
    this.maxPts  = options.maxPts || 200;
    this.labels  = options.labels || [];
    this.yMin    = options.yMin ?? null;
    this.yMax    = options.yMax ?? null;
    this.pad     = { t: 8, r: 8, b: 24, l: 36 };
  }

  push(name, value) {
    if (!this.series[name]) this.series[name] = [];
    this.series[name].push(value);
    if (this.series[name].length > this.maxPts) this.series[name].shift();
  }

  draw() {
    const { ctx, canvas, pad } = this;
    const W = canvas.width, H = canvas.height;
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;

    // Background
    ctx.fillStyle = 'rgba(5,8,18,0.9)';
    ctx.fillRect(0, 0, W, H);

    const allValues = Object.values(this.series).flat();
    if (allValues.length === 0) { this._drawEmpty(); return; }

    const yMin = this.yMin ?? Math.min(...allValues, 0);
    const yMax = this.yMax ?? Math.max(...allValues, 1);
    const yRange = yMax - yMin || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ph / 4) * i;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();

      // Y-axis labels
      const val = yMax - (yRange / 4) * i;
      ctx.fillStyle   = 'rgba(255,255,255,0.35)';
      ctx.font        = '9px Inter, monospace';
      ctx.textAlign   = 'right';
      ctx.fillText(val.toFixed(2), pad.l - 3, y + 3);
    }

    // Series lines
    let ci = 0;
    for (const [name, data] of Object.entries(this.series)) {
      if (data.length < 2) { ci++; continue; }
      const color = this.colors[ci++ % this.colors.length];

      // Gradient fill
      const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
      grad.addColorStop(0, color + '33');
      grad.addColorStop(1, color + '00');

      ctx.beginPath();
      const pts = data.map((v, i) => ({
        x: pad.l + (i / (this.maxPts - 1)) * pw,
        y: pad.t + ph - ((v - yMin) / yRange) * ph,
      }));

      // Fill under curve
      ctx.moveTo(pts[0].x, pad.t + ph);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(pts[pts.length - 1].x, pad.t + ph);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      // Latest value label
      const last = data[data.length - 1];
      ctx.fillStyle = color;
      ctx.font      = 'bold 10px Inter, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${name}: ${last.toFixed(3)}`, pad.l + 4, pad.t + 12 + ci * 14 - 14);
    }

    // X-axis label
    ctx.fillStyle   = 'rgba(255,255,255,0.25)';
    ctx.font        = '9px Inter, monospace';
    ctx.textAlign   = 'center';
    ctx.fillText('epochs →', pad.l + pw / 2, H - 6);
  }

  _drawEmpty() {
    const { ctx, canvas } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font      = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Train the AI to see metrics', canvas.width / 2, canvas.height / 2);
  }

  clear() { this.series = {}; }
}

// ─────────────────────────────────────────────
// Visualizer — main class
// ─────────────────────────────────────────────
class Visualizer {
  constructor(opts) {
    this.lossChart     = new Sparkline(opts.lossCanvas, {
      colors: ['#00d4ff', '#7c3aed'],
      maxPts: 200,
      yMin:   0,
    });
    this.biasCanvas    = opts.biasCanvas;
    this.biasCtx       = opts.biasCanvas.getContext('2d');
    this.influenceEl   = opts.influenceEl;
    this.memEl         = opts.memEl;
    this.weightCanvas  = opts.weightCanvas || null;
    this.weightCtx     = this.weightCanvas ? this.weightCanvas.getContext('2d') : null;
  }

  // ─── Update from NN epoch callback ────────
  onEpochEnd(epoch, logs) {
    this.lossChart.push('loss', logs.loss);
    if (logs.acc !== undefined)     this.lossChart.push('acc', logs.acc);
    if (logs.val_loss !== undefined) this.lossChart.push('val_loss', logs.val_loss);
    this.lossChart.draw();
  }

  // ─── Cell type distribution bar ───────────
  drawBiasBar(biasMap) {
    const { biasCtx, biasCanvas } = this;
    const W = biasCanvas.width, H = biasCanvas.height;
    biasCtx.clearRect(0, 0, W, H);

    // Background
    biasCtx.fillStyle = 'rgba(5,8,18,0.8)';
    biasCtx.fillRect(0, 0, W, H);

    const barH      = 14;
    const labelW    = 72;
    const barW      = W - labelW - 8;
    const rowH      = H / NUM_TYPES;

    for (let i = 0; i < NUM_TYPES; i++) {
      const frac  = biasMap[i] || 0;
      const y     = i * rowH + (rowH - barH) / 2;
      const color = CELL_COLORS[i];

      // Label
      biasCtx.fillStyle = 'rgba(255,255,255,0.55)';
      biasCtx.font      = '9px Inter, monospace';
      biasCtx.textAlign = 'right';
      biasCtx.fillText(CELL_NAMES[i], labelW - 4, y + barH / 2 + 3);

      // Track
      biasCtx.fillStyle = 'rgba(255,255,255,0.06)';
      biasCtx.fillRect(labelW, y, barW, barH);

      // Fill
      if (frac > 0) {
        biasCtx.fillStyle = color;
        biasCtx.fillRect(labelW, y, barW * frac, barH);

        // Percentage
        if (frac > 0.04) {
          biasCtx.fillStyle = 'rgba(255,255,255,0.8)';
          biasCtx.font      = '8px Inter, monospace';
          biasCtx.textAlign = 'left';
          biasCtx.fillText(`${(frac * 100).toFixed(0)}%`, labelW + barW * frac + 3, y + barH / 2 + 3);
        }
      }
    }
  }

  // ─── NN influence meter ───────────────────
  updateInfluence(influence, numTensors, numBytes) {
    if (!this.influenceEl) return;
    const pct = (influence * 100).toFixed(0);
    this.influenceEl.querySelector('.influence-fill').style.width = pct + '%';
    this.influenceEl.querySelector('.influence-pct').textContent  = pct + '%';

    // Color ramp: red (0) → yellow (0.5) → green (1)
    const r = Math.round(255 * Math.max(0, 1 - influence * 2));
    const g = Math.round(255 * Math.min(1, influence * 2));
    this.influenceEl.querySelector('.influence-fill').style.background =
      `rgb(${r},${g},50)`;
  }

  // ─── Memory info ──────────────────────────
  updateMemory(memInfo) {
    if (!this.memEl) return;
    const mb = (memInfo.numBytes / 1048576).toFixed(1);
    this.memEl.textContent = `${memInfo.numTensors} tensors · ${mb} MB`;
  }

  // ─── Weight heatmap (conv1 filters) ───────
  drawWeightHeatmap(weights) {
    if (!this.weightCanvas || !weights) return;
    const { weightCtx, weightCanvas } = this;
    const W = weightCanvas.width, H = weightCanvas.height;
    weightCtx.clearRect(0, 0, W, H);

    const len = weights.length;
    if (len === 0) return;

    const cols   = 16;
    const rows   = Math.ceil(len / cols);
    const cellW  = W / cols;
    const cellH  = H / rows;

    const minW   = Math.min(...weights);
    const maxW   = Math.max(...weights);
    const rangeW = maxW - minW || 1;

    for (let i = 0; i < len; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const t   = (weights[i] - minW) / rangeW;  // 0–1

      // Diverging colormap: negative = red, zero = dark, positive = cyan
      let r, g, b;
      if (t < 0.5) {
        const s = (0.5 - t) * 2;
        r = Math.round(s * 200); g = 0; b = 0;
      } else {
        const s = (t - 0.5) * 2;
        r = 0; g = Math.round(s * 180); b = Math.round(s * 255);
      }
      weightCtx.fillStyle = `rgb(${r},${g},${b})`;
      weightCtx.fillRect(col * cellW, row * cellH, cellW - 0.5, cellH - 0.5);
    }
  }

  // ─── Full update tick ─────────────────────
  tick(nn, trainer) {
    const nnStats      = nn.getStats();
    const trainerStats = trainer.getStats();

    this.drawBiasBar(trainerStats.biasMap);
    this.updateInfluence(
      nn.totalSamples > 0 ? Math.min(0.88, (nn.totalSamples / 800) ** 0.6) : 0,
      nnStats.memInfo.numTensors,
      nnStats.memInfo.numBytes
    );
    this.updateMemory(nnStats.memInfo);

    // Weight heatmap (every 10 calls)
    this._tickCount = (this._tickCount || 0) + 1;
    if (this._tickCount % 10 === 0) {
      this.drawWeightHeatmap(nn.getWeightSnapshot());
    }
  }
}

window.Sparkline   = Sparkline;
window.Visualizer  = Visualizer;
