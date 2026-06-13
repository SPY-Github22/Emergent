/* interaction.js — Pointer handling, radial menu with spring animation, hover cursor */
'use strict';

class Interaction {
  constructor(world, renderer) {
    this.world    = world;
    this.renderer = renderer;
    this.canvas   = document.getElementById('ui-canvas');

    this.state = {
      hovered: null,
      radialMenu: {
        isOpen:       false,
        x: 0, y: 0,
        targetId:     null,
        options:      C.ACTIONS,
        hoveredIndex: -1,
        openProgress: 0,
      },
    };

    if (!this.canvas) return;
    this.canvas.addEventListener('pointerdown', this._onDown.bind(this));
    this.canvas.addEventListener('pointermove', this._onMove.bind(this));
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  _pos(e) {
    const r  = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width  / r.width;
    const sy = this.canvas.height / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  _agentAt(pos) {
    const HIT = C.AGENT_RADIUS + 12;
    let best = null, bd = HIT;
    for (const p of this.world.persons) {
      const d = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  _onDown(e) {
    const pos  = this._pos(e);
    const menu = this.state.radialMenu;

    if (menu.isOpen) {
      if (menu.hoveredIndex !== -1) {
        const agent = this.world.persons.find(p => p.id === menu.targetId);
        if (agent) this._execute(menu.options[menu.hoveredIndex], menu.hoveredIndex, agent);
      }
      menu.isOpen = false;
      return;
    }

    const agent = this._agentAt(pos);
    if (agent) {
      menu.isOpen       = true;
      menu.x            = agent.x;
      menu.y            = agent.y;
      menu.targetId     = agent.id;
      menu.hoveredIndex = -1;
      menu.openProgress = 0;
    }
  }

  _onMove(e) {
    const pos  = this._pos(e);
    const menu = this.state.radialMenu;

    const agent = this._agentAt(pos);
    this.state.hovered = agent ? agent.id : null;
    this.canvas.style.cursor = agent ? 'pointer' : 'default';

    if (menu.isOpen) {
      const dx = pos.x - menu.x;
      const dy = pos.y - menu.y;
      const d  = Math.hypot(dx, dy);
      if (d >= 26 && d <= 90) {
        let angle = Math.atan2(dy, dx) + Math.PI / 2;
        if (angle < 0) angle += Math.PI * 2;
        const n = menu.options.length;
        menu.hoveredIndex = Math.floor(angle / (Math.PI * 2 / n)) % n;
      } else {
        menu.hoveredIndex = -1;
      }
    }
  }

  _execute(action, actionIdx, agent) {
    // Visual effects
    const R = this.renderer;
    if (action === 'Feed') {
      agent.hunger = Math.max(0, agent.hunger - 35);
      R.particles.feed(agent.x, agent.y);
    } else if (action === 'Connect') {
      agent.social = Math.min(100, agent.social + 30);
      // Find nearest other agent and boost relationship
      let best = null, bd = Infinity;
      for (const p of this.world.persons) {
        if (p.id === agent.id) continue;
        const d = Math.hypot(p.x - agent.x, p.y - agent.y);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        agent.modAffection(best.id, 0.12);
        best.modAffection(agent.id, 0.12);
        best.social = Math.min(100, best.social + 20);
        R.particles.connect(agent.x, agent.y, best.x, best.y);
      } else {
        R.particles.approve(agent.x, agent.y);
      }
    } else if (action === 'Guide') {
      // Send agent toward a random food node or world center
      const food = this.world.foodNodes[Math.floor(Math.random() * this.world.foodNodes.length)];
      if (food) { agent.tx = food.x; agent.ty = food.y; }
      R.particles.approve(agent.x, agent.y);
    } else if (action === 'Approve') {
      agent.social = Math.min(100, agent.social + 15);
      R.particles.approve(agent.x, agent.y);
    } else if (action === 'Correct') {
      // Light nudge — hunger boost + redirect
      agent.hunger  = Math.max(0, agent.hunger - 10);
      R.particles.feed(agent.x, agent.y);
    }

    // Emit for NN training
    events.emit('ACTION_TAKEN', {
      action,
      actionIdx,
      targetId: agent.id,
      features: this.world.getPersonFeatures(agent),
    });
  }

  update(dt) {
    const menu = this.state.radialMenu;
    if (menu.isOpen && menu.openProgress < 1) {
      menu.openProgress = Math.min(1, menu.openProgress + dt / 180);
    }
    // Track the target agent as they move
    if (menu.isOpen) {
      const target = this.world.persons.find(p => p.id === menu.targetId);
      if (target) { menu.x = target.x; menu.y = target.y; }
      else { menu.isOpen = false; } // target disappeared
    }
  }
}
