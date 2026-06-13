import { Renderer } from '../../js/renderer.js';
import { Interaction } from '../../js/interaction.js';
import { events } from '../../js/events.js';

let errors = [];

// Mock DOM
global.document = {
    getElementById: (id) => {
        if (id === 'gameCanvas') {
            return global.mockCanvas;
        }
        return null;
    }
};

global.mockCanvas = {
    width: 800,
    height: 600,
    listeners: {},
    addEventListener: function(event, callback) {
        this.listeners[event] = callback;
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    getContext: () => ({
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        strokeRect: () => {},
        setLineDash: () => {},
        moveTo: () => {},
        closePath: () => {},
        fillText: () => {}
    })
};

// Mock World
const mockWorld = {
    isDay: true,
    persons: [
        {
            id: 'agent_1',
            position: { x: 100, y: 100 },
            hunger: 50,
            social: 50,
            getState: () => ({ state: 'idle' })
        }
    ]
};

try {
    // Test 1: Instantiation
    const renderer = new Renderer('gameCanvas');
    const interaction = new Interaction('gameCanvas', mockWorld);
    
    // Test 2: Normal Rendering
    renderer.render(mockWorld, interaction.state);
    
    // Test 3: Normal Interaction
    interaction.canvas.listeners['pointerdown']({ button: 0, clientX: 100, clientY: 100, preventDefault: () => {} });
    
    if (!interaction.state.radialMenu.isOpen) {
        errors.push("Menu did not open upon clicking agent.");
    }
    
    // Test 4: Menu Render when open
    renderer.render(mockWorld, interaction.state);
    
    // Test 5: Click option in menu
    let actionFired = false;
    events.on('ACTION_TAKEN', (data) => { actionFired = true; });
    
    // Hover option 0 (above agent)
    interaction.canvas.listeners['pointermove']({ clientX: 100, clientY: 50, preventDefault: () => {} }); 
    
    // click
    interaction.canvas.listeners['pointerdown']({ button: 0, clientX: 100, clientY: 50, preventDefault: () => {} });
    
    if (!actionFired) {
        errors.push("ACTION_TAKEN was not emitted after clicking a menu option. Hover index was: " + interaction.state.radialMenu.hoveredIndex);
    }
    
    // Test 6: Out of bounds click (e.clientX = undefined, or NaN, or Infinity)
    interaction.canvas.listeners['pointerdown']({ button: 0, clientX: -1000, clientY: -1000, preventDefault: () => {} });
    interaction.canvas.listeners['pointerdown']({ button: 0, clientX: Infinity, clientY: Infinity, preventDefault: () => {} });
    interaction.canvas.listeners['pointerdown']({ button: 0, clientX: NaN, clientY: NaN, preventDefault: () => {} });
    interaction.canvas.listeners['pointerdown']({ button: 0, preventDefault: () => {} }); // missing clientX/Y
    
    // Test 7: Resize canvas to 0 (division by zero in getPointerPos)
    global.mockCanvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
    interaction.canvas.listeners['pointerdown']({ button: 0, clientX: 100, clientY: 100, preventDefault: () => {} });
    
    // Test 8: Missing canvas ID
    const noCanvasRenderer = new Renderer('invalidCanvas');
    if (!noCanvasRenderer) errors.push("Expected Renderer to handle invalid canvas ID gracefully");
    const noCanvasInteraction = new Interaction('invalidCanvas', mockWorld);
    if (!noCanvasInteraction) errors.push("Expected Interaction to handle invalid canvas ID gracefully");
    
} catch (e) {
    errors.push("Exception thrown: " + e.message + "\n" + e.stack);
}

console.log(JSON.stringify({ errors }));
