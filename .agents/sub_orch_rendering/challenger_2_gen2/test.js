import { Interaction } from '../../js/interaction.js';

// Mock document.getElementById
global.document = {
    getElementById: function(id) {
        return {
            width: 800,
            height: 600,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
            addEventListener: function(evt, cb) {
                this.listeners = this.listeners || {};
                this.listeners[evt] = cb;
            },
            trigger: function(evt, e) {
                if (this.listeners && this.listeners[evt]) {
                    this.listeners[evt](e);
                }
            }
        };
    }
};

const world = {
    persons: [
        { id: 1, position: { x: 100, y: 100 }, getState: () => ({}) }, // bottom
        { id: 2, position: { x: 105, y: 105 }, getState: () => ({}) }  // top
    ]
};

const interaction = new Interaction('canvas', world);

// Simulate click at 102, 102 (which overlaps both, dist to #1 is 2.82, dist to #2 is 4.24, both <= 25)
interaction.canvas.trigger('pointerdown', { button: 0, clientX: 102, clientY: 102 });

console.log("Menu open:", interaction.state.radialMenu.isOpen);
console.log("Target ID:", interaction.state.radialMenu.targetId);
