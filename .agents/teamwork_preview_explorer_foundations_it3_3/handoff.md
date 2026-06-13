# Handoff Report: Iteration 3 Bug Fix Strategy

## 1. Observation
- **Agent Over-Ageing Bug**: In `d:/Emergent Game/js/world.js` within `update(dt)`, new agents are instantiated inside a `while` loop (lines 127-137) and added to `this.persons`. Immediately after (lines 140-142), a `for` loop calls `person.update(dt)` on all items in `this.persons`.
- **State Migration Bug**: In `d:/Emergent Game/js/world.js` within `loadState()`, line 84 reads `this.agentsArrived = state.agentsArrived;`. If an old save file is loaded, `state.agentsArrived` is `undefined`, causing `this.agentsArrived` to be assigned `undefined`. 

## 2. Logic Chain
- **Agent Over-Ageing Bug**: When a large `dt` bridges multiple arrival times, newly created agents age by the entire `dt` instead of their actual time alive (`this.absoluteTime - arrivalTime`).
  - *Fix Strategy*: Move the existing agent update loop (`for (const person of this.persons)`) to run *before* the `while` loop that spawns new agents. Existing agents will correctly receive the full `dt`. Then, inside the spawning `while` loop, call `person.update(this.absoluteTime - this.arrivalTimers[this.agentsArrived])` for each newly spawned agent, ensuring they only age for the fraction of the tick they existed.
- **State Migration Bug**: Setting `this.agentsArrived` to `undefined` breaks the condition `this.agentsArrived < this.arrivalTimers.length`. 
  - *Fix Strategy*: To support old saves that only stored the `persons` array, we can use `state.persons.length` as a fallback. Changing the assignment to `this.agentsArrived = state.agentsArrived ?? state.persons.length;` will accurately reconstruct the arrival counter since agents are never deleted.

## 3. Caveats
- The Over-Ageing fix assumes that agents do not have complex chronological interactions that strictly require interleaved updates within a single `dt` step. Since `person.update(dt)` currently only drifts `hunger` and `social` stats linearly, the reordering is completely safe.
- The State Migration fix assumes that agents cannot be removed (e.g., die or despawn). If removal were possible, `state.persons.length` could be lower than the true `agentsArrived` value. Given the current code in `world.js` and `person.js`, there is no removal logic, making this fallback completely robust.

## 4. Conclusion
- **Agent Over-Ageing Bug Fix Proposal**:
  1. In `world.js`, move lines 139-142 (`for (const person of this.persons) { person.update(dt); }`) above line 126.
  2. Inside the `while` loop at line 134, add: `person.update(this.absoluteTime - this.arrivalTimers[this.agentsArrived]);` before incrementing `this.agentsArrived`.
- **State Migration Bug Fix Proposal**:
  1. In `world.js`, change line 84 from `this.agentsArrived = state.agentsArrived;` to `this.agentsArrived = state.agentsArrived ?? state.persons.length;`.

## 5. Verification Method
- **Agent Over-Ageing Bug**: Instantiate `World`, call `update(20000)`, and verify `world.persons[0].hunger` is `75` (`15000 * 0.005`) instead of `100`, and `world.persons[1].hunger` is `25` (`5000 * 0.005`) instead of `100`.
- **State Migration Bug**: Mock an old DB state object `{ time: 100, isDay: true, persons: [p1, p2] }` (missing `agentsArrived`). Call `loadState()` and verify `world.agentsArrived === 2`. Call `update(100)` and verify the simulation doesn't crash or re-spawn existing agents.
