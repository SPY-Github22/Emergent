import { Interaction } from '../../js/interaction.js';

// Mock document and events
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
        { id: 1, position: { x: 100, y: 100 }, getState: () => ({}) }, // Agent 1 (bottom layer)
        { id: 2, position: { x: 124, y: 100 }, getState: () => ({}) }  // Agent 2 (top layer, x is 24px away)
    ]
};

// With a visual radius of 12, Agent 1 is bounded at x=88 to 112. 
// Agent 2 is bounded at x=112 to 136. They are visually tangent, not overlapping!
// If a user clicks at x=100 (exact center of Agent 1), distance to Agent 2 is 24.
// Since clickRadius is 25, the loop will check Agent 2 first (highest index), 
// find dist (24) <= 25, and SELECT AGENT 2, completely ignoring the direct hit on Agent 1!

const interaction = new Interaction('canvas', world);

// Simulate click exactly at the center of Agent 1
const mockEvent = { button: 0, clientX: 100, clientY: 100 };
interaction.canvas.trigger('pointerdown', mockEvent);

console.log("=== Overlapping Agent Hitbox Test ===");
console.log("Expected Target ID: 1 (User clicked exact center of Agent 1)");
console.log("Actual Target ID:  ", interaction.state.radialMenu.targetId);
if (interaction.state.radialMenu.targetId === 2) {
    console.log("FAIL: Agent 2 was selected because its fuzzy hitbox (radius=25) shadowed the direct visual hit on Agent 1.");
} else {
    console.log("PASS");
}
