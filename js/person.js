/* person.js — Full agent: movement, social sim, illustrated drawing */
'use strict';

class Person {
  constructor(id, x, y, name) {
    this.id   = id;
    this.name = name || id;

    // Position & velocity
    this.x  = x;  this.y  = y;
    this.vx = 0;  this.vy = 0;
    this.tx = x;  this.ty = y;  // steering target

    // Needs (0-100)
    this.hunger = 10 + Math.random() * 25;
    this.social = 70 + Math.random() * 25;

    // Personality (fixed at birth, drives behaviour)
    const seed  = this._hash(id);
    this.aggression  = 0.15 + ((seed >>  0) & 0xFF) / 255 * 0.55;
    this.sociability = 0.30 + ((seed >>  8) & 0xFF) / 255 * 0.60;
    this.curiosity   = 0.20 + ((seed >> 16) & 0xFF) / 255 * 0.60;

    // Visual identity (seeded, deterministic)
    this.hue        = (seed * 61) % 360;
    this.bodyScale  = 0.88 + ((seed >> 4) & 0x0F) / 0x0F * 0.24;
    this.hairOffset = ((seed >> 12) & 0x3F) - 32; // hue offset for hair

    // Relationships: agentId → { affection: -1..1, encounters }
    this.rel = {};

    // State machine
    this.state       = 'WANDERING'; // WANDERING SEEKING_FOOD EATING SEEKING_SOCIAL SOCIALIZING FIGHTING LOVING GOSSIPING
    this.stateTimer  = 0;
    this.fightTarget = null;
    this.fightTimer  = 0;
    this.gossipWith  = null;
    this.gossipTimer = 0;
    this.loveTarget  = null;

    // Wander
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;

    // Animation
    this.walkPhase  = Math.random() * Math.PI * 2;
    this.breathPhase= Math.random() * Math.PI * 2;

    // Floating hearts / sparks timer
    this.heartTimer  = 0;
    this.lastLookX   = 0;
  }

  // ── Helpers ─────────────────────────────────
  _hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
    return h;
  }

  getRelationship(otherId) {
    if (!this.rel[otherId]) this.rel[otherId] = { affection: 0, encounters: 0 };
    return this.rel[otherId];
  }

  modAffection(otherId, delta) {
    const r = this.getRelationship(otherId);
    r.affection = Math.max(-1, Math.min(1, r.affection + delta));
    r.encounters++;
  }

  // ── Main update ─────────────────────────────
  update(dtMs, world) {
    const dt = Math.min(dtMs, C.MAX_DT) / 1000;

    // Tick needs
    this.hunger = Math.min(100, this.hunger + C.HUNGER_RATE * dt);
    this.social = Math.max(0, this.social - C.SOCIAL_DECAY * dt);

    // Advance animation
    const spd = Math.hypot(this.vx, this.vy) / C.AGENT_SPEED;
    this.walkPhase  += dt * 5.5 * Math.max(0.08, spd);
    this.breathPhase+= dt * 1.8;
    this.heartTimer  = Math.max(0, this.heartTimer - dt);

    // State machine
    this._updateState(dt, world);

    // Steering
    this._steer(dt, world);

    // Integrate
    this.x = Math.max(C.AGENT_RADIUS, Math.min(C.W - C.AGENT_RADIUS, this.x + this.vx * dt));
    this.y = Math.max(C.AGENT_RADIUS + 10, Math.min(C.H - C.AGENT_RADIUS - 10, this.y + this.vy * dt));

    // Bounce walls
    if (this.x <= C.AGENT_RADIUS || this.x >= C.W - C.AGENT_RADIUS) this.vx *= -0.5;
    if (this.y <= C.AGENT_RADIUS + 10 || this.y >= C.H - C.AGENT_RADIUS - 10) this.vy *= -0.5;

    // Interact
    if (world) this._interact(dt, world);

    this.stateTimer += dt;
  }

  _updateState(dt, world) {
    // Fight timer
    if (this.state === 'FIGHTING') {
      this.fightTimer -= dt;
      if (this.fightTimer <= 0) {
        this.state = 'WANDERING';
        this.fightTarget = null;
        this.stateTimer = 0;
      }
      return;
    }

    // Gossip timer
    if (this.state === 'GOSSIPING') {
      this.gossipTimer -= dt;
      if (this.gossipTimer <= 0) {
        this.state = 'WANDERING';
        this.gossipWith = null;
        this.stateTimer = 0;
      }
      return;
    }

    // Hunger dominates when critical
    if (this.hunger > 65 && world) {
      const food = this._nearestFood(world.foodNodes);
      if (food) {
        this.state = 'SEEKING_FOOD';
        this.tx = food.x; this.ty = food.y;
        return;
      }
    }

    // Social need
    if (this.social < 30 && this.hunger < 55 && world && world.persons.length > 1) {
      const other = this._nearestOther(world.persons);
      if (other) {
        const rel = this.getRelationship(other.id);
        if (rel.affection >= C.LOVE_AFFECTION_THRESH) {
          this.state = 'LOVING';
          this.loveTarget = other.id;
        } else {
          this.state = 'SEEKING_SOCIAL';
        }
        this.tx = other.x + (Math.random()-0.5)*20;
        this.ty = other.y + (Math.random()-0.5)*20;
        return;
      }
    }

    // Wander otherwise
    if (this.state !== 'WANDERING' && this.state !== 'EATING') {
      this.state = 'WANDERING';
    }

    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0 && this.state === 'WANDERING') {
      this.wanderAngle += (Math.random()-0.5) * (1.2 + this.curiosity);
      const dist = 60 + Math.random() * 110;
      this.tx = Math.max(C.AGENT_RADIUS*2, Math.min(C.W-C.AGENT_RADIUS*2, this.x + Math.cos(this.wanderAngle)*dist));
      this.ty = Math.max(C.AGENT_RADIUS*2+10, Math.min(C.H-C.AGENT_RADIUS*2-10, this.y + Math.sin(this.wanderAngle)*dist));
      this.wanderTimer = 1.5 + Math.random() * 2.5;
    }
  }

  _steer(dt, world) {
    if (this.state === 'FIGHTING') {
      // Run away from fight target
      if (this.fightTarget && world) {
        const other = world.persons.find(p => p.id === this.fightTarget);
        if (other) {
          const dx = this.x - other.x, dy = this.y - other.y;
          const d = Math.hypot(dx, dy) || 1;
          this.vx += (dx/d) * C.AGENT_SPEED * 1.5;
          this.vy += (dy/d) * C.AGENT_SPEED * 1.5;
        }
      }
      this.vx *= 0.92;
      this.vy *= 0.92;
      return;
    }

    if (this.state === 'GOSSIPING') {
      this.vx *= 0.85;
      this.vy *= 0.85;
      return;
    }

    const dx   = this.tx - this.x;
    const dy   = this.ty - this.y;
    const dist = Math.hypot(dx, dy) || 0.01;

    if (dist < 4) {
      this.vx *= 0.75;
      this.vy *= 0.75;
      if (this.state === 'SEEKING_FOOD') this.state = 'EATING';
      if (this.state === 'SEEKING_SOCIAL' || this.state === 'LOVING') this.state = 'SOCIALIZING';
      return;
    }

    const speed = dist < C.ARRIVE_RADIUS
      ? C.AGENT_SPEED * (dist / C.ARRIVE_RADIUS)
      : C.AGENT_SPEED;

    // Separation force from other agents
    let sepX = 0, sepY = 0;
    if (world) {
      for (const p of world.persons) {
        if (p.id === this.id) continue;
        const sdx = this.x - p.x, sdy = this.y - p.y;
        const sd  = Math.hypot(sdx, sdy) || 0.01;
        if (sd < C.SEPARATE_DIST) {
          const f = (C.SEPARATE_DIST - sd) / C.SEPARATE_DIST;
          sepX += (sdx/sd) * f * 40;
          sepY += (sdy/sd) * f * 40;
        }
      }
    }

    const desiredVx = (dx/dist) * speed + sepX;
    const desiredVy = (dy/dist) * speed + sepY;

    // Smooth steering (exponential filter)
    this.vx += (desiredVx - this.vx) * 0.14;
    this.vy += (desiredVy - this.vy) * 0.14;

    // Track look direction
    if (Math.abs(this.vx) > 5) this.lastLookX = Math.sign(this.vx);
  }

  _nearestFood(foodNodes) {
    let best = null, bestD = Infinity;
    for (const f of foodNodes) {
      if (f.amount < 8) continue;
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  _nearestOther(persons) {
    let best = null, bestD = Infinity;
    for (const p of persons) {
      if (p.id === this.id) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  _interact(dt, world) {
    // Eat food
    for (const f of world.foodNodes) {
      const d = Math.hypot(f.x - this.x, f.y - this.y);
      if (d < C.AGENT_RADIUS + 14 && f.amount > 0) {
        const eat = Math.min(f.amount, C.FOOD_EAT_RATE * dt);
        f.amount  -= eat;
        this.hunger = Math.max(0, this.hunger - eat);
        if (this.hunger < 5) { this.state = 'WANDERING'; this.stateTimer = 0; }
      }
    }

    // Social interaction with nearby agents
    for (const p of world.persons) {
      if (p.id === this.id) continue;
      const d = Math.hypot(p.x - this.x, p.y - this.y);
      if (d < C.AGENT_RADIUS * 3.5) {
        this.social = Math.min(100, this.social + C.SOCIAL_GAIN * 0.5 * dt);

        // Relationship warmup for passive proximity
        if (d < C.GOSSIP_DIST && Math.random() < 0.002 * dt) {
          this.modAffection(p.id, 0.008);
          p.modAffection(this.id, 0.008);
        }
      }
    }
  }

  // ── Serialisation ───────────────────────────
  getState() {
    return {
      id: this.id, name: this.name,
      x: this.x, y: this.y,
      hunger: this.hunger, social: this.social,
      rel: JSON.parse(JSON.stringify(this.rel)),
    };
  }

  // ── Drawing ─────────────────────────────────
  draw(ctx, isHovered, isSelected) {
    const s  = this.bodyScale;
    const h  = this.hue;
    const spd = Math.hypot(this.vx, this.vy) / C.AGENT_SPEED;
    const walk  = Math.sin(this.walkPhase);
    const breath= Math.sin(this.breathPhase);
    const legSwing = walk * 7 * Math.max(0.1, spd);
    const bob      = breath * 1.4;
    const headR    = C.AGENT_RADIUS * s;

    ctx.save();

    // Shake if fighting
    let ox = 0, oy = 0;
    if (this.state === 'FIGHTING' && this.fightTimer > 0) {
      ox = (Math.random()-0.5) * 4;
      oy = (Math.random()-0.5) * 3;
    }
    ctx.translate(this.x + ox, this.y + oy);

    // ── Ground shadow ──
    ctx.save();
    ctx.scale(1, 0.4);
    ctx.beginPath();
    ctx.arc(1*s, 62*s, 9*s, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fill();
    ctx.restore();

    // ── State aura ──
    let auraColor = null, auraR = 0;
    if (this.state === 'FIGHTING')    { auraColor = C.COL.FIGHT;  auraR = headR * 2.2; }
    else if (this.hunger > 75)        { auraColor = '#f97316';    auraR = headR * 1.8; }
    else if (this.state === 'LOVING') { auraColor = C.COL.LOVE;   auraR = headR * 2.0; }
    else if (isSelected)              { auraColor = C.COL.NN;     auraR = headR * 1.7; }

    if (auraColor) {
      const grad = ctx.createRadialGradient(0, -18*s + bob, 0, 0, -18*s + bob, auraR);
      grad.addColorStop(0, auraColor + '55');
      grad.addColorStop(1, auraColor + '00');
      ctx.fillStyle = grad;
      ctx.fillRect(-auraR, -18*s + bob - auraR, auraR*2, auraR*2);
    }

    // ── Legs ──
    ctx.lineCap = 'round';
    ctx.lineWidth = 5.5 * s;
    ctx.strokeStyle = `hsl(${h},48%,38%)`;

    // Left leg
    ctx.beginPath();
    ctx.moveTo(-4.5*s, 8*s);
    ctx.quadraticCurveTo(-5*s - legSwing*0.2, 16*s, -3.5*s - legSwing*0.7, 25*s);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(4.5*s, 8*s);
    ctx.quadraticCurveTo(5*s + legSwing*0.2, 16*s, 3.5*s + legSwing*0.7, 25*s);
    ctx.stroke();

    // ── Torso ──
    // Shadow layer
    ctx.fillStyle = `hsl(${h},58%,35%)`;
    ctx.beginPath();
    ctx.roundRect(-8*s, (-10+bob)*s, 17*s, 17*s, 5*s);
    ctx.fill();
    // Front
    ctx.fillStyle = `hsl(${h},68%,52%)`;
    ctx.beginPath();
    ctx.roundRect(-8.5*s, (-12+bob)*s, 16*s, 16*s, 5*s);
    ctx.fill();
    // Chest highlight
    ctx.fillStyle = `hsla(${h},75%,72%,0.45)`;
    ctx.beginPath();
    ctx.roundRect(-6*s, (-12+bob)*s, 8*s, 7*s, [3*s, 3*s, 0, 0]);
    ctx.fill();

    // ── Arms ──
    ctx.lineWidth = 4.5 * s;
    ctx.strokeStyle = `hsl(${h+12},62%,48%)`;
    // Left arm
    ctx.beginPath();
    ctx.moveTo(-8.5*s, (-7+bob)*s);
    ctx.quadraticCurveTo(-15*s + legSwing*0.35, (-1+bob)*s, -13*s + legSwing*0.6, (8+bob)*s);
    ctx.stroke();
    // Right arm
    ctx.beginPath();
    ctx.moveTo(7.5*s, (-7+bob)*s);
    ctx.quadraticCurveTo(15*s - legSwing*0.35, (-1+bob)*s, 13*s - legSwing*0.6, (8+bob)*s);
    ctx.stroke();

    // ── Head ──
    const hy = (-23 + bob) * s;

    // Neck
    ctx.fillStyle = `hsl(${h},50%,58%)`;
    ctx.beginPath();
    ctx.roundRect(-3.5*s, (-12+bob)*s, 7*s, 11*s, 2*s);
    ctx.fill();

    // Head shadow (depth layer)
    ctx.fillStyle = `hsl(${h},42%,45%)`;
    ctx.beginPath();
    ctx.arc(1.5*s, hy + 2*s, headR, 0, Math.PI*2);
    ctx.fill();

    // Head base
    ctx.fillStyle = `hsl(${h},52%,66%)`;
    ctx.beginPath();
    ctx.arc(0, hy, headR, 0, Math.PI*2);
    ctx.fill();

    // Rim light (opposite to main light)
    ctx.strokeStyle = `hsla(${h},80%,82%,0.55)`;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(0, hy, headR - 0.5, Math.PI*0.85, Math.PI*1.75);
    ctx.stroke();

    // ── Hair ──
    const hairH = (h + this.hairOffset + 360) % 360;
    ctx.fillStyle = `hsl(${hairH},50%,28%)`;
    ctx.beginPath();
    ctx.arc(0, hy - headR*0.25, headR*0.82, Math.PI + 0.15, Math.PI*2 - 0.15);
    ctx.fill();
    // Hair tufts
    ctx.beginPath();
    ctx.arc(-headR*0.68, hy - headR*0.55, headR*0.42, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headR*0.28, hy - headR*0.85, headR*0.32, 0, Math.PI*2);
    ctx.fill();

    // ── Eyes ──
    const eyeY  = hy - 2 * s;
    const eyeXo = 3.8 * s;
    const lx = this.vx * 0.025;
    const ly = this.vy * 0.018;

    // Whites
    ctx.fillStyle = 'rgba(255,250,242,0.96)';
    for (const ex of [-eyeXo, eyeXo]) {
      ctx.beginPath();
      ctx.ellipse(ex + lx*0.4, eyeY + ly*0.4, 3.4*s, 4*s, 0, 0, Math.PI*2);
      ctx.fill();
    }

    // Pupils
    ctx.fillStyle = '#120c00';
    for (const ex of [-eyeXo, eyeXo]) {
      ctx.beginPath();
      ctx.arc(ex + lx, eyeY + ly, 2.1*s, 0, Math.PI*2);
      ctx.fill();
    }

    // Iris highlight
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const ex of [-eyeXo, eyeXo]) {
      ctx.beginPath();
      ctx.arc(ex + lx + 0.9*s, eyeY + ly - 0.9*s, 0.85*s, 0, Math.PI*2);
      ctx.fill();
    }

    // Eyebrows
    const hairDark = `hsl(${hairH},48%,22%)`;
    ctx.strokeStyle = hairDark;
    ctx.lineWidth = 2 * s;
    ctx.lineCap = 'round';
    const browAngle = this.state === 'FIGHTING' ? 0.22 : this.hunger > 72 ? -0.1 : 0;

    ctx.beginPath();
    ctx.moveTo(-eyeXo*1.55, eyeY - 5.5*s);
    ctx.quadraticCurveTo(-eyeXo*0.8, eyeY - 6.8*s + browAngle*5, -eyeXo*0.1, eyeY - 5.8*s);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(eyeXo*0.1, eyeY - 5.8*s);
    ctx.quadraticCurveTo(eyeXo*0.8, eyeY - 6.8*s + browAngle*5, eyeXo*1.55, eyeY - 5.5*s);
    ctx.stroke();

    // ── Mouth ──
    const mouthY = hy + 5.8 * s;
    ctx.strokeStyle = `hsl(${h},38%,28%)`;
    ctx.lineWidth = 1.8 * s;
    ctx.lineCap = 'round';

    ctx.beginPath();
    if (this.state === 'FIGHTING') {
      ctx.arc(0, mouthY + 1, 3.8*s, 0.1, Math.PI - 0.1);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,245,245,0.85)';
      ctx.beginPath();
      ctx.arc(0, mouthY + 0.5, 2.8*s, 0.1, Math.PI - 0.1);
      ctx.fill();
    } else if (this.hunger < 35 && this.social > 55) {
      ctx.arc(0, mouthY - 1, 3.6*s, 0.12, Math.PI - 0.12);
      ctx.stroke();
    } else if (this.hunger > 72) {
      ctx.arc(0, mouthY + 4.5, 3.6*s, Math.PI + 0.18, -0.18);
      ctx.stroke();
    } else {
      ctx.moveTo(-3.2*s, mouthY);
      ctx.lineTo(3.2*s, mouthY);
      ctx.stroke();
    }

    // ── Status bars ──
    const bW = 28*s, bH = 3.5*s, bX = -bW/2, bY0 = 28*s;

    // Hunger
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(bX, bY0, bW, bH, 2);
    ctx.fill();
    const hPct = Math.max(0, Math.min(1, this.hunger/100));
    if (hPct > 0) {
      ctx.fillStyle = `hsl(${120 - hPct*120},80%,52%)`;
      ctx.beginPath();
      ctx.roundRect(bX, bY0, bW*hPct, bH, 2);
      ctx.fill();
    }

    // Social
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(bX, bY0 + bH + 2.5, bW, bH, 2);
    ctx.fill();
    const sPct = Math.max(0, Math.min(1, this.social/100));
    if (sPct > 0) {
      ctx.fillStyle = C.COL.SOCIAL;
      ctx.beginPath();
      ctx.roundRect(bX, bY0 + bH + 2.5, bW*sPct, bH, 2);
      ctx.fill();
    }

    // ── Name tag ──
    ctx.font = `600 9.5px "Inter", sans-serif`;
    const tw   = ctx.measureText(this.name).width;
    const tagW = tw + 10, tagH = 14;
    const tagY = hy - headR - 17;

    ctx.fillStyle = 'rgba(8,6,20,0.80)';
    ctx.beginPath();
    ctx.roundRect(-tagW/2, tagY, tagW, tagH, 4);
    ctx.fill();

    ctx.fillStyle = '#f1f5f9';
    ctx.textAlign   = 'center';
    ctx.textBaseline= 'middle';
    ctx.fillText(this.name, 0, tagY + tagH/2);

    ctx.restore();
  }
}
