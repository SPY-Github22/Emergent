import { Renderer } from './js/renderer.js';
import { Interaction } from './js/interaction.js';
import { events } from './js/events.js';

// Mock Canvas and Document
const mockCtx = {
    fillRect: 0,
    beginPath: 0,
    arc: 0,
    fill: 0,
    stroke: 0,
    strokeRect: 0,
    moveTo: 0,
    closePath: 0,
    fillText: 0,
    setLineDash: () => {},
    calls: []
};

for (const key of ['fillRect', 'beginPath', 'arc', 'fill', 'stroke', 'strokeRect', 'moveTo', 'closePath', 'fillText']) {
    const orig = mockCtx[key];
    mockCtx[key] = function(...args) {
        mockCtx.calls.push({ method: key, args });
    };
}

const mockCanvas = {
    width: 800,
    height: 600,
    getContext: (type) => type === '2d' ? mockCtx : null,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: (type, cb) => {
        mockCanvas.listeners[type] = cb;
    },
    listeners: {}
};

global.document = {
    getElementById: (id) => id === 'gameCanvas' ? mockCanvas : null
};

// Mock World and Person
class MockPerson {
    constructor(id, x, y) {
        this.id = id;
        this.position = { x, y };
        this.hunger = 50;
        this.social = 50;
    }
    getState() { return { id: this.id, hunger: this.hunger }; }
}

const world = {
    isDay: true,
    persons: [
        new MockPerson('agent_1', 100, 100),
        new MockPerson('agent_2', 300, 300)
    ]
};

async function test() {
    console.log("Starting Execution Validation...");

    // 1. Test Renderer Initialization
    const renderer = new Renderer('gameCanvas');
    if (!renderer.ctx) throw new Error("Renderer did not get context");

    // 2. Test Interaction Initialization
    const interaction = new Interaction('gameCanvas', world);
    if (!mockCanvas.listeners['pointerdown']) throw new Error("Pointerdown listener not added");
    
    // 3. Render initial frame
    renderer.render(world, interaction.state);
    const fillRectCalls = mockCtx.calls.filter(c => c.method === 'fillRect');
    if (fillRectCalls.length === 0) throw new Error("Renderer did not draw background");
    
    console.log(`Rendered initial frame. fillRect calls: ${fillRectCalls.length}`);

    // 4. Simulate clicking on an agent
    let eventFired = null;
    events.on('ACTION_TAKEN', (data) => {
        eventFired = data;
    });

    console.log("Simulating click to open menu...");
    mockCanvas.listeners['pointerdown']({
        button: 0,
        clientX: 105,
        clientY: 105
    });

    if (!interaction.state.radialMenu.isOpen) throw new Error("Radial menu did not open after clicking agent");

    // 5. Render with open menu
    mockCtx.calls = [];
    renderer.render(world, interaction.state);
    const fillTextCalls = mockCtx.calls.filter(c => c.method === 'fillText');
    if (fillTextCalls.length === 0) throw new Error("Renderer did not draw radial menu text");

    console.log("Simulating pointer move to select action...");
    // Moving pointer to top-right of the menu (should be index 0 or 1 depending on math)
    // Center is 100, 100
    mockCanvas.listeners['pointermove']({
        clientX: 100,
        clientY: 50 // Directly above center -> angle should be 0 (since it shifts by +pi/2) -> index 0 ('Feed')
    });

    console.log(`Hovered index: ${interaction.state.radialMenu.hoveredIndex}, expected: 0`);
    if (interaction.state.radialMenu.hoveredIndex === -1) throw new Error("Pointer move did not select an option");

    console.log("Simulating click to trigger action...");
    mockCanvas.listeners['pointerdown']({
        button: 0,
        clientX: 100,
        clientY: 50
    });

    if (!eventFired) throw new Error("ACTION_TAKEN event not fired");
    if (eventFired.action !== 'Feed') throw new Error(`Wrong action fired: ${eventFired.action}`);
    if (eventFired.targetId !== 'agent_1') throw new Error(`Wrong targetId: ${eventFired.targetId}`);
    
    console.log("All execution validation tests PASSED.");
}

test().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
