import { Renderer } from '../../js/renderer.js';
import { Interaction } from '../../js/interaction.js';
import { events } from '../../js/events.js';

global.document = {
    getElementById: (id) => {
        if (id === 'gameCanvas') {
            return canvasMock;
        }
        return null;
    }
};

const canvasMock = {
    width: 800,
    height: 600,
    getContext: () => ({
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        strokeRect: () => {},
        setLineDash: () => {},
        closePath: () => {},
        fillText: () => {},
        canvas: canvasMock,
    }),
    listeners: {},
    addEventListener: function(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    },
    getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600
    }),
    triggerEvent: function(event, payload) {
        if (this.listeners[event]) {
            for (const cb of this.listeners[event]) {
                cb(payload);
            }
        }
    }
};

class MockPerson {
    constructor(id, x, y) {
        this.id = id;
        this.position = { x, y };
        this.hunger = 50;
        this.social = 50;
    }
    getState() {
        return { id: this.id };
    }
}

const world = {
    isDay: true,
    persons: [
        new MockPerson('agent_0', 100, 100), // Agent 0
        new MockPerson('agent_1', 124, 100)  // Agent 1, 24px away (does not overlap visually, agent radius is 12)
    ]
};

const interaction = new Interaction('gameCanvas', world);

console.log("=== HITBOX STEALING BUG TEST ===");
console.log("Agent 0 is at (100, 100)");
console.log("Agent 1 is at (124, 100)");
console.log("Simulating click exactly at (100, 100) - the absolute center of Agent 0.");

canvasMock.triggerEvent('pointerdown', {
    button: 0,
    clientX: 100,
    clientY: 100
});

console.log("Expected target: agent_0");
console.log("Actual target  :", interaction.state.radialMenu.targetId);

if (interaction.state.radialMenu.targetId === 'agent_1') {
    console.log("BUG CONFIRMED: Higher-index agent stole the click due to 25px clickRadius and greedy reverse loop!");
} else {
    console.log("NO BUG: Click handled correctly.");
}
