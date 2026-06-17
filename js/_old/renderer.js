/* renderer.js — 3-layer canvas, cinematic terrain, particles, radial menu */
'use strict';

// ─── Particle System ──────────────────────────────────────────────────────────
class Particles {
  constructor() { this.pool = []; }

  _emit(config) {
    this.pool.push({
      x: config.x, y: config.y,
      vx: config.vx || 0, vy: config.vy || 0,
      color: config.color || '#fff',
      size: config.size  || 4,
      life: config.life  || 0.9,
      max:  config.life  || 0.9,
      grav: config.grav  !== undefined ? config.grav : 28,
      text: config.text  || null,
    });
  }

  feed(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI * 0.9 + (Math.random()-0.5) * 0.9;
      const sp= 55 + Math.random() * 70;
      this._emit({ x: x + (Math.random()-0.5)*14, y: y + 10, vx: Math.cos(a)*sp*0.4, vy: Math.sin(a)*sp, color:'#fbbf24', size: 2.5 + Math.random()*3, life: 0.55 + Math.random()*0.4 });
    }
  }

  connect(x1,y1,x2,y2) {
    for (let i = 0; i < 12; i++) {
      const t = Math.random();
      const a = Math.random()*Math.PI*2;
      this._emit({ x:x1+(x2-x1)*t, y:y1+(y2-y1)*t, vx:Math.cos(a)*30, vy:Math.sin(a)*30, color:C.COL.APPROVE, size:2.5+Math.random()*2.5, life:0.8+Math.random()*0.5, grav:0 });
    }
  }

  approve(x,y) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random()*Math.PI*2;
      const sp= 50 + Math.random()*80;
      this._emit({ x, y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, color:C.COL.NN, size:2+Math.random()*3.5, life:0.7+Math.random()*0.5 });
    }
  }

  fight(x1,y1,x2,y2) {
    const mx=(x1+x2)/2, my=(y1+y2)/2;
    for (let i = 0; i < 18; i++) {
      const a = Math.random()*Math.PI*2;
      const sp= 80 + Math.random()*120;
      this._emit({ x:mx+(Math.random()-0.5)*12, y:my+(Math.random()-0.5)*12, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, color: Math.random()<0.5 ? C.COL.FIGHT : C.COL.SPARK, size:2+Math.random()*3.5, life:0.5+Math.random()*0.6 });
    }
    this._emit({ x:mx, y:my - 30, color:'#fff', size:0, life:1.5, grav:0, text:'💥' });
  }

  heart(x,y) {
    this._emit({ x: x + (Math.random()-0.5)*16, y, vx:(Math.random()-0.5)*15, vy:-25-Math.random()*25, color:C.COL.LOVE, size:0, life:1.8, grav:-5, text:'❤' });
  }

  gossip(x,y) {
    this._emit({ x, y: y - 30, color:'#fff', size:0, life:2.0, grav:0, text:'💬' });
  }

  update(dt) {
    const dtS = dt / 1000;
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.x  += p.vx * dtS;
      p.y  += p.vy * dtS;
      p.vy += p.grav * dtS;
      p.life -= dtS;
      if (p.life <= 0) { this.pool.splice(i, 1); }
    }
  }

  draw(ctx) {
    for (const p of this.pool) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      if (p.text) {
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

// ─── Renderer ─────────────────────────────────────────────────────────────────
class Renderer {
  constructor() {
    this.bgC = document.getElementById('bg-canvas');
    this.enC = document.getElementById('entity-canvas');
    this.uiC = document.getElementById('ui-canvas');

    if (!this.bgC || !this.enC || !this.uiC) {
      console.error('Renderer: missing canvas elements');
      return;
    }

    this.bgX = this.bgC.getContext('2d', { alpha: false });
    this.enX = this.enC.getContext('2d');
    this.uiX = this.uiC.getContext('2d');

    this.W = this.bgC.width;
    this.H = this.bgC.height;

    this.particles   = new Particles();
    this.dayProgress = 1; // 0=night 1=day

    // Stars (stable positions)
    this.stars = Array.from({ length: 180 }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H * 0.72,
      r: 0.4 + Math.random() * 1.6,
      a: 0.25 + Math.random() * 0.75,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpd: 0.6 + Math.random() * 2.0,
    }));

    // Moon position
    this.moonX = this.W * 0.78;
    this.moonY = this.H * 0.15;

    // Pre-compute hill control points (stable)
    this._buildHills();
  }

  _buildHills() {
    // Far hills
    this.hills = [
      { pts: [[0,0.52],[0.12,0.38],[0.28,0.45],[0.42,0.33],[0.60,0.44],[0.75,0.30],[0.88,0.42],[1,0.36]], lightBase: 22 },
      { pts: [[0,0.62],[0.10,0.52],[0.25,0.58],[0.40,0.48],[0.55,0.56],[0.70,0.46],[0.85,0.55],[1,0.50]], lightBase: 16 },
      { pts: [[0,0.72],[0.08,0.65],[0.22,0.70],[0.38,0.62],[0.52,0.68],[0.68,0.60],[0.82,0.67],[1,0.63]], lightBase: 11 },
      { pts: [[0,0.80],[0.12,0.75],[0.30,0.80],[0.50,0.73],[0.70,0.79],[0.88,0.74],[1,0.78]], lightBase: 8  },
    ];
  }

  // Smooth day/night lerp
  _updateDayNight(world, dt) {
    const tgt = world.isDay ? 1 : 0;
    this.dayProgress += (tgt - this.dayProgress) * 0.0025 * dt;
  }

  // Lerp between two hex / rgba colors
  _lerp(a, b, t) {
    const p = s => {
      if (s.startsWith('#')) {
        const v = parseInt(s.slice(1), 16);
        return [(v>>16)&255, (v>>8)&255, v&255, 1];
      }
      const m = s.match(/[\d.]+/g);
      return [+m[0], +m[1], +m[2], m[3] !== undefined ? +m[3] : 1];
    };
    const [r1,g1,b1,a1] = p(a), [r2,g2,b2,a2] = p(b);
    return `rgba(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)},${(a1+(a2-a1)*t).toFixed(2)})`;
  }

  // Draw a hill layer from bezier-interpolated y-control-points
  _drawHill(ctx, hDef, fillColor) {
    const pts = hDef.pts;
    ctx.beginPath();
    ctx.moveTo(0, this.H);
    ctx.lineTo(0, pts[0][1] * this.H);
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = ((pts[i][0] + pts[i+1][0]) / 2) * this.W;
      const cy = ((pts[i][1] + pts[i+1][1]) / 2) * this.H;
      ctx.quadraticCurveTo(pts[i][0]*this.W, pts[i][1]*this.H, cx, cy);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0]*this.W, last[1]*this.H);
    ctx.lineTo(this.W, this.H);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  _drawBackground(totalMs) {
    const ctx = this.bgX;
    const d   = this.dayProgress;
    const W   = this.W, H = this.H;

    // ── Sky gradient ──
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H * 0.82);
    skyGrad.addColorStop(0,   this._lerp('#020515', '#1a2a4a', d));
    skyGrad.addColorStop(0.4, this._lerp('#08102a', '#1e3460', d));
    skyGrad.addColorStop(0.8, this._lerp('#0e1a35', '#263c6a', d));
    skyGrad.addColorStop(1,   this._lerp('#121f3a', '#2d4575', d));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // ── Stars (fade out in day) ──
    const starA = 1 - d;
    if (starA > 0.02) {
      for (const s of this.stars) {
        const t  = Math.sin(s.twinkle + totalMs * s.twinkleSpd * 0.001) * 0.3 + 0.7;
        ctx.globalAlpha = s.a * starA * t;
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── Moon ──
    const moonAlpha = (1 - d) * 0.9;
    if (moonAlpha > 0.02) {
      // Outer glow
      const mGlow = ctx.createRadialGradient(this.moonX, this.moonY, 0, this.moonX, this.moonY, 45);
      mGlow.addColorStop(0, `rgba(220,220,180,${moonAlpha * 0.3})`);
      mGlow.addColorStop(1, 'rgba(220,220,180,0)');
      ctx.fillStyle = mGlow;
      ctx.beginPath();
      ctx.arc(this.moonX, this.moonY, 45, 0, Math.PI * 2);
      ctx.fill();
      // Moon body
      ctx.fillStyle = `rgba(240,235,210,${moonAlpha * 0.95})`;
      ctx.beginPath();
      ctx.arc(this.moonX, this.moonY, 18, 0, Math.PI * 2);
      ctx.fill();
      // Crescent shadow
      ctx.fillStyle = `rgba(10,15,35,${moonAlpha * 0.7})`;
      ctx.beginPath();
      ctx.arc(this.moonX + 8, this.moonY - 2, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Atmospheric glow near horizon (dawn/dusk) ──
    const transitionFactor = 1 - Math.abs(d - 0.5) * 2;
    if (transitionFactor > 0.02) {
      const atm = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.65);
      atm.addColorStop(0, 'rgba(255,140,60,0)');
      atm.addColorStop(0.5, `rgba(255,100,40,${transitionFactor * 0.22})`);
      atm.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = atm;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Layered hills ──
    const hillColors = [
      [this._lerp('#0a0820', '#1c2848', d), this._lerp('#0c0a22', '#202e50', d)],
      [this._lerp('#050e10', '#10211e', d), this._lerp('#071012', '#122420', d)],
      [this._lerp('#040a06', '#0f1e0c', d), this._lerp('#061008', '#12220e', d)],
      [this._lerp('#030705', '#0b180a', d), this._lerp('#040a06', '#0d1c0c', d)],
    ];

    for (let i = 0; i < this.hills.length; i++) {
      this._drawHill(ctx, this.hills[i], hillColors[i][0]);
      // Subtle rim light on hill top edge
      ctx.strokeStyle = this._lerp(`rgba(30,40,60,0.4)`, `rgba(80,110,180,0.25)`, d);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ── Ground ──
    const gnd = ctx.createLinearGradient(0, H * 0.78, 0, H);
    gnd.addColorStop(0, this._lerp('#020a04', '#0a1a08', d));
    gnd.addColorStop(1, this._lerp('#010602', '#060e04', d));
    ctx.fillStyle = gnd;
    ctx.fillRect(0, H * 0.78, W, H * 0.22);

    // ── Ambient ground light ──
    const ambGrad = ctx.createRadialGradient(W/2, H, 0, W/2, H, H * 0.5);
    ambGrad.addColorStop(0, `rgba(74,222,128,${0.04 + d*0.05})`);
    ambGrad.addColorStop(1, 'rgba(74,222,128,0)');
    ctx.fillStyle = ambGrad;
    ctx.fillRect(0, H*0.5, W, H*0.5);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  render(world, interactionState, totalMs, dt) {
    if (!this.bgX) return;

    this._updateDayNight(world, dt);
    this._drawBackground(totalMs);

    // Draw food nodes on bg layer
    for (const f of world.foodNodes) f.draw(this.bgX);

    // ── Entity layer ──
    const eCtx = this.enX;
    eCtx.clearRect(0, 0, this.W, this.H);

    // Agent proximity bonds
    const ps = world.persons;
    eCtx.setLineDash([4, 8]);
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const d   = Math.hypot(a.x - b.x, a.y - b.y);
        const rel = a.getRelationship(b.id);
        if (d > 160) continue;

        let lColor, lWidth;
        if (rel.affection > C.LOVE_AFFECTION_THRESH) {
          lColor = `rgba(249,168,212,${(1-d/160)*0.55})`; lWidth = 2;
        } else if (rel.affection < C.FIGHT_AFFECTION_THRESH) {
          lColor = `rgba(239,68,68,${(1-d/160)*0.4})`; lWidth = 1.5;
        } else {
          lColor = `rgba(129,140,248,${(1-d/160)*0.25})`; lWidth = 1;
        }
        eCtx.strokeStyle = lColor;
        eCtx.lineWidth   = lWidth;
        eCtx.beginPath();
        eCtx.moveTo(a.x, a.y);
        eCtx.lineTo(b.x, b.y);
        eCtx.stroke();
      }
    }
    eCtx.setLineDash([]);

    // Particles
    this.particles.update(dt);
    this.particles.draw(eCtx);

    // Agents
    const hoveredId  = interactionState?.hovered;
    const selectedId = interactionState?.radialMenu?.isOpen ? interactionState.radialMenu.targetId : null;
    for (const p of ps) {
      p.draw(eCtx, p.id === hoveredId, p.id === selectedId);
    }

    // ── UI layer (radial menu) ──
    const uCtx = this.uiX;
    uCtx.clearRect(0, 0, this.W, this.H);
    if (interactionState?.radialMenu?.isOpen) {
      this._drawRadialMenu(uCtx, interactionState.radialMenu, world);
    }
  }

  _drawRadialMenu(ctx, menu, world) {
    const { x, y, options, hoveredIndex, openProgress: t } = menu;
    const eased = this._ease(t);
    const outerR = 82 * eased;
    const innerR = 26 * eased;
    const n = options.length;

    // Target pulse ring
    const target = world.persons.find(p => p.id === menu.targetId);
    if (target) {
      ctx.beginPath();
      ctx.arc(target.x, target.y, C.AGENT_RADIUS + 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(129,140,248,0.7)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const segColors = [
      ['rgba(251,191,36,',  'rgba(251,191,36,0.12)' ],
      ['rgba(52,211,153,',  'rgba(52,211,153,0.12)' ],
      ['rgba(56,189,248,',  'rgba(56,189,248,0.12)' ],
      ['rgba(129,140,248,', 'rgba(129,140,248,0.12)'],
      ['rgba(251,113,133,', 'rgba(251,113,133,0.12)'],
    ];

    for (let i = 0; i < n; i++) {
      const sa = (i / n) * Math.PI * 2 - Math.PI / 2;
      const ea = ((i+1) / n) * Math.PI * 2 - Math.PI / 2;
      const ma = (sa + ea) / 2;
      const hov = i === hoveredIndex;

      ctx.save();
      ctx.translate(x, y);

      // Segment path
      ctx.beginPath();
      ctx.arc(0, 0, outerR, sa, ea);
      ctx.arc(0, 0, innerR, ea, sa, true);
      ctx.closePath();

      ctx.fillStyle = hov ? segColors[i][0] + '0.88)' : segColors[i][1];
      ctx.fill();
      ctx.strokeStyle = hov ? segColors[i][0] + '0.9)' : 'rgba(255,255,255,0.07)';
      ctx.lineWidth = hov ? 2 : 1;
      ctx.stroke();

      // Icon + label
      const midR = (innerR + outerR) / 2;
      const ix = Math.cos(ma) * midR, iy = Math.sin(ma) * midR;

      if (eased > 0.3) {
        ctx.font = `${hov ? 18 : 15}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = Math.min(1, (eased - 0.3) / 0.4);
        ctx.fillText(C.ACTION_ICON[i], ix, iy - 5);

        ctx.font = `500 ${hov ? 11 : 9.5}px "Inter", sans-serif`;
        ctx.fillStyle = hov ? '#fff' : 'rgba(255,255,255,0.65)';
        ctx.fillText(options[i], ix, iy + 9);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
    }

    // Center circle
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,8,25,0.7)';
    ctx.fill();
    ctx.restore();
  }

  _ease(t) {
    // Elastic ease-out
    const c4 = (2 * Math.PI) / 4.5;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
}
