# Observation
- **implementation_plan.md**: Outlines architecture. `world.js` manages state, day/night cycle, agent arrival, DB persistence. `person.js` manages agent state (hunger, social, position) and exposes it for NN. `events.js` acts as an event bus with `ACTION_TAKEN`, `DAY_NIGHT_CHANGED`, `AGENT_ARRIVED`, `NN_DECISION`.
- **PROJECT.md**: Code layout specifies `js/events.js`, `js/world.js`, `js/person.js`. Interface contracts require `on(event, callback)` and `emit(event, data)` in `events.js`. `world.js` holds an array of `Person` instances and triggers `person.update(dt)`.
- **SCOPE.md**: Confirms `events.js`, `world.js`, `person.js` must be built completely from scratch. Defines explicit interface contracts.

# Logic Chain
1. **events.js**:
   - We need a global event bus to decouple components. A straightforward `EventEmitter` class (or singleton object) storing a dictionary of event names mapped to arrays of callbacks will satisfy the `on` and `emit` requirements.
2. **person.js**:
   - Must represent an agent with a state object (`hunger`, `social`, `position: {x, y}`).
   - Needs an `update(dt)` method that gradually modifies hunger/social levels over time to simulate biological needs.
   - Needs a structural placeholder for "fully illustrated" visuals (e.g., `visuals: { state: 'idle', direction: 'down' }`) that `renderer.js` will read from.
   - Needs a `serialize()` or `toJSON()` method to prepare its state for database storage.
3. **world.js**:
   - Needs a `persons` array and tracking variables for `time` and `dayNightCycle`.
   - In its `update(dt)` loop:
     - Update global time.
     - Manage sequential arrival of 2 agents. A timer mechanism can spawn Agent 1 at `t=arrival_time_1` and Agent 2 at `t=arrival_time_2`, emitting `AGENT_ARRIVED` each time.
     - Call `person.update(dt)` for all spawned agents.
     - Detect day/night transitions and emit `DAY_NIGHT_CHANGED`.
   - Requires asynchronous IndexedDB methods: `saveState()` (serializes World and Person states) and `loadState()` (deserializes and reconstructs Person objects). Since we must not block the main loop, we will use Promises wrapping `indexedDB` API calls.

# Caveats
- **Module System**: It is not explicitly stated whether the project uses ES6 modules (`import`/`export`) or global window variables attached by script tags. I propose using standard ES6 modules for cleaner isolation, but the code can easily be adapted to attach to `window`.
- **IndexedDB Schema**: The exact schema for IndexedDB isn't strict. I propose a single `EmergentDB` database containing a `gameState` object store with a specific key (e.g., `saveSlot1`).
- **Tuning**: Timing thresholds for day/night and agent arrivals are arbitrary at this stage and will need to be parameterized/tuned later.

# Conclusion
The proposed implementation strategy for Milestone 1 (Foundations) is:
- **`events.js`**: Create and export a singleton instance of an `EventEmitter` class with `on(event, cb)` and `emit(event, data)` methods.
- **`person.js`**: Create a `Person` class with an `id`, an initial state (`hunger: 0`, `social: 0`, `position: {x: 0, y: 0}`), and an `update(dt)` method that continuously decays needs based on elapsed time.
- **`world.js`**: Create a `World` class managing `persons`, `timeOfDay`, and `simulationTime`. In `update(dt)`, update time, instantiate `Person` objects at specific intervals (up to 2), update existing persons, and track day/night states to emit events. Implement `async saveState()` and `async loadState()` wrapping the IndexedDB API to persist and retrieve the simulation snapshot without blocking the main thread.

# Verification Method
1. Write a dummy boot script (e.g., `test.js` or `main.js`) that initializes `World` and `events`.
2. Register listeners: `events.on('AGENT_ARRIVED', console.log)` and `events.on('DAY_NIGHT_CHANGED', console.log)`.
3. Call `world.update(dt)` in a mock loop using `requestAnimationFrame` or `setInterval`.
4. Verify that two agents are sequentially added to `world.persons` and the corresponding events are fired.
5. Call `await world.saveState()`, then clear the world state and call `await world.loadState()`. Ensure `world.persons` and internal states are fully restored from IndexedDB.
