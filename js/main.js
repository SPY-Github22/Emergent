






let world;
let nn;
let trainer;
let renderer;
let interaction;

let isPaused = false;
let lastTime = performance.now();

async function init() {
    console.log("Emergent: Initializing...");
    
    // Core Logic
    world = new World();
    await world.initDB();
    await world.loadState();
    
    // AI & Training
    nn = new NN();
    trainer = new Trainer(world, nn);
    
    // Rendering & Interaction
    renderer = new Renderer('bg-canvas', 'entity-canvas', 'ui-canvas');
    interaction = new Interaction('ui-canvas', world);
    
    // UI Event Listeners
    setupUI();
    
    // Game Loop
    requestAnimationFrame(gameLoop);
}

function setupUI() {
    const pauseBtn = document.getElementById('btn-pause');
    const resetBtn = document.getElementById('btn-reset');
    const whisperText = document.getElementById('whisper-text');
    const eventJournal = document.getElementById('event-journal');
    const mindStats = document.getElementById('mind-stats');

    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
    });

    resetBtn.addEventListener('click', async () => {
        if(confirm("Wipe all training and world data?")) {
            indexedDB.deleteDatabase('EmergentWorldDB');
            indexedDB.deleteDatabase('EmergentTrainerDB');
            indexedDB.deleteDatabase('emergent-nn-model'); // tfjs format might use a different db name, but we reset world anyway
            location.reload();
        }
    });

    function logEvent(msg, color = '#e2e8f0') {
        const entry = document.createElement('div');
        entry.className = 'journal-entry';
        entry.style.color = color;
        entry.textContent = msg;
        eventJournal.prepend(entry);
        if (eventJournal.children.length > 20) {
            eventJournal.removeChild(eventJournal.lastChild);
        }
    }

    events.on('ACTION_TAKEN', (data) => {
        whisperText.textContent = `You guided ${data.target} to ${data.action}. The NN is watching.`;
        logEvent(`Player forced ${data.target} to ${data.action}.`, '#38bdf8'); // Cyan
    });

    events.on('NN_DECISION', (data) => {
        whisperText.textContent = `NN predicted ${data.action} for ${data.targetId}`;
        logEvent(`AI autonomously decided ${data.targetId} should ${data.action}.`, '#a78bfa'); // Violet
    });

    events.on('DAY_NIGHT_CHANGED', (data) => {
        logEvent(`The sun has ${data.isDay ? 'risen' : 'set'}.`, '#f59e0b');
    });

    events.on('AGENT_ARRIVED', (data) => {
        logEvent(`${data.person.id} has arrived in the world.`, '#10b981');
    });

    // Mind Panel updates
    setInterval(() => {
        if (!world || world.persons.length === 0) return;
        // Show prediction for the first agent as an example
        const p1 = world.persons[0];
        const state = p1.getState();
        // A direct predict call without threshold trigger just to show stats
        const pred = nn.predict(state); 
        if (pred && pred.action) {
            mindStats.innerHTML = `
                <div class="mind-row"><span>Target:</span> <span>${p1.id}</span></div>
                <div class="mind-row"><span>Intent:</span> <strong>${pred.action}</strong></div>
                <div class="mind-row"><span>Confidence:</span> <span>${(pred.confidence * 100).toFixed(1)}%</span></div>
            `;
        }
    }, 1000);
    
    // World Save loop
    setInterval(() => {
        world.saveState();
    }, 5000);
}

function gameLoop(currentTime) {
    const dt = currentTime - lastTime;
    lastTime = currentTime;

    if (!isPaused) {
        // Physics update
        world.update(dt);
        
        // AI Predict step (Every few frames, or managed internally. 
        // For now, let's let the world/person logic call events, but actually person.js needs to ask for predictions.)
        // In the current person.js provided by the teamwork, it might not automatically ask. 
        // We'll hook the NN to the agents.
        for (const person of world.persons) {
            // Check if they need a decision (e.g., every 2 seconds)
            if (Math.random() < 0.01) { // roughly every 1.6 seconds at 60fps
                nn.predict(person.getState());
            }
        }
    }

    // Render step
    renderer.render(world, interaction.state);

    requestAnimationFrame(gameLoop);
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    init();
});
