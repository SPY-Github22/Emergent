# Handoff Report: Iteration 3 Bug Fixes

## Observation
1. **Agent Over-Ageing Bug**: In `d:/Emergent Game/js/world.js` lines 127-142, agents are instantiated inside a `while` loop when `this.absoluteTime >= this.arrivalTimers[this.agentsArrived]`. Newly spawned agents are immediately pushed to `this.persons`. Then, a `for` loop updates all elements in `this.persons` with the full `dt` parameter.
2. **State Migration Bug**: In `d:/Emergent Game/js/world.js` line 84 within `loadState()`, `this.agentsArrived` is directly assigned `state.agentsArrived`. If loading an old save state, `state.agentsArrived` is `undefined`, causing `this.agentsArrived` to become `undefined`. This breaks subsequent numerical logic (`this.agentsArrived < this.arrivalTimers.length` returns `false` when `undefined < 2`).

## Logic Chain
- **Agent Over-Ageing Bug**: An agent arriving at `this.arrivalTimers[this.agentsArrived]` has only existed for `this.absoluteTime - this.arrivalTimers[this.agentsArrived]` milliseconds in the current update tick. However, it is being updated with the full `dt` (e.g., 20000ms instead of 5000ms). The fix must:
  1. Calculate `const timeAlive = this.absoluteTime - this.arrivalTimers[this.agentsArrived];` upon spawning.
  2. Perform `person.update(timeAlive);` for its initial fractional age.
  3. Track newly spawned agents this tick (e.g., via a `Set` or `Array`) so they are skipped in the global `for (const person of this.persons)` loop to avoid double-updating.
- **State Migration Bug**: Since old saves lack `agentsArrived`, we need an integer fallback. Because old saves still preserved `persons`, the number of agents that had arrived is logically equivalent to `state.persons.length`. Defaulting to `state.persons.length` or `0` will seamlessly repair old saves without breaking existing flow.

## Caveats
- Using `state.persons.length` assumes that no agents were manually deleted in older versions of the game (which there isn't a mechanic for yet). If there were, this value might be slightly lower than reality, but still better than `undefined`.
- In the Over-Ageing fix, adding agents to `this.persons` *before* emitting the `AGENT_ARRIVED` event is preserved to maintain the exact existing event sequence, but double-counting is prevented using an exclusion collection (`Set`).

## Conclusion
- **Fix 1 Strategy (Over-Ageing)**: Introduce a tracking collection (e.g., `const spawnedThisTick = new Set();`) before the spawner `while` loop. Within the loop, call `person.update(this.absoluteTime - this.arrivalTimers[this.agentsArrived])` and add `person` to the `Set`. In the main agent update loop, wrap `person.update(dt)` in an `if (!spawnedThisTick.has(person))` check.
- **Fix 2 Strategy (Migration)**: Change line 84 in `world.js` to `this.agentsArrived = state.agentsArrived ?? (state.persons ? state.persons.length : 0);`.

## Verification Method
- **Over-Ageing**: Programmatically invoke `world.update(20000)` from a fresh state (0ms). Assert that `world.persons[0].hunger === 75` (since it lived 15000ms * 0.005) and `world.persons[1].hunger === 25` (since it lived 5000ms * 0.005). Prior to the fix, both would be `100`.
- **Migration**: Call `loadState` with an old mock state `{ time: 1000, isDay: true, persons: [{id: 'agent_1', position: {x: 0, y: 0}, direction: {x: 0, y: 0}, hunger: 0, social: 100}] }`. Assert `world.agentsArrived === 1` and spawner functions resume correctly.
