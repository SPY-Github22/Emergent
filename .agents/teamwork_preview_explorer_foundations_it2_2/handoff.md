# Analysis of world.js Foundations Bugs

## Observation
- **world.js:103-109**: `this.time` is updated via modulo arithmetic: `this.time = (this.time + dt) % this.dayDuration`. `isDay` is calculated by comparing `this.time` to `this.dayDuration / 2`. If `dt` exceeds half a day (30,000ms), multiple day/night phases can pass in a single update, but the `newIsDay !== this.isDay` check only compares the before and after states, dropping intermediate `'DAY_NIGHT_CHANGED'` events.
- **world.js:112-125**: `arrivalTimers` logic uses `this.arrivalTimers[this.agentsArrived] -= dt`. If `dt` is larger than the current timer, the excess `dt` is discarded rather than applying to the next timer, resulting in lost time (timer debt).
- **world.js:13**: `this.arrivalTimers = [5000, 15000];` with the comment `// 5s and 15s`. The array implies absolute arrival times from the start of the game, but the logic evaluates them as relative countdowns (Agent 2 arrives at 5000 + 15000 = 20,000ms instead of 15,000ms).
- **world.js:45-95**: `saveState` and `loadState` completely ignore the `arrivalTimers` array and any elapsed time concept. Only the modulo `time`, `isDay`, and `agentsArrived` are persisted, meaning pending timers reset on load.

## Logic Chain
1. **Framerate-dependent timers (Bug 1)**: Subtracting `dt` from a single sequential timer without carrying over the remainder to the next timer destroys time consistency during lag spikes.
2. **Absolute/Relative mismatch (Bug 4)**: The code treats `[5000, 15000]` as sequential delays, but the expected behavior (based on the comment and absolute/relative mismatch description) is for them to be absolute elapsed time timestamps.
3. **Lost timer progress on load (Bug 2)**: Because mutated timers (or an absolute time reference) are not persisted to IndexedDB, reloading the game resets the arrival clock while keeping `agentsArrived` intact, leading to desyncs.
4. **Dropped day/night events (Bug 3)**: A large `dt` causes `this.time` to wrap. The `newIsDay !== this.isDay` condition only checks the frame's start and end state. If the phase flips an even number of times, the condition is false and 0 events are emitted instead of the actual number of flips.

## Caveats
- Using a `while` loop to emit missed `DAY_NIGHT_CHANGED` events during a large `dt` lag spike might fire multiple events in a single frame. Ensure the event listeners (in `events.js` or elsewhere) can safely handle burst emissions without crashing or causing visual glitches.
- To use an absolute time approach, we assume the game world starts at absolute time `0`.

## Conclusion
A unified fix strategy is to introduce an `absoluteTime` property (initialized to 0) that increments by `dt` every update:
1. **Bugs 1 & 4**: Treat `arrivalTimers` as absolute timestamps (`[5000, 15000]`). Use a `while` loop checking `this.absoluteTime >= this.arrivalTimers[this.agentsArrived]` to spawn agents. This prevents timer debt and correctly implements absolute timings.
2. **Bug 2**: Persist `absoluteTime` in `saveState` and restore it in `loadState`. This natively restores the progress toward the next absolute timer without needing to save mutated arrays.
3. **Bug 3**: Replace the day/night modulo calculation with a `while` loop or mathematical formula that advances a simulated time cursor up to `absoluteTime`. For every half-day (`this.dayDuration / 2`) crossed, flip `this.isDay` and emit the `'DAY_NIGHT_CHANGED'` event, ensuring no events are dropped on large lag spikes.

## Verification Method
- **Bug 1 & 4**: Run `world.update(25000)`. Both agents should spawn during this single frame, and `world.agentsArrived` should equal 2.
- **Bug 2**: Run `world.update(2000)`, call `saveState()`, reload the world via `loadState()`, and run `world.update(4000)`. Agent 1 should correctly arrive exactly at the 5000ms mark, proving timer progress was not lost.
- **Bug 3**: Run `world.update(120000)` (2 full days). The `DAY_NIGHT_CHANGED` event listener should receive exactly 4 emissions.
