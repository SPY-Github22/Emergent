# World.js Bug Fix Strategy

## Observation
1. **Framerate-dependent timers & Absolute/relative mismatch**: In `world.js:112-124`, `this.arrivalTimers[this.agentsArrived] -= dt;` subtracts the delta time. `arrivalTimers` is initialized as `[5000, 15000]`. Only one timer is updated per tick. If `dt` is larger than the remaining timer, the excess time is lost because it's not carried over to the next timer. Furthermore, treating `15000` as a countdown after the `5000` countdown has finished results in the second agent arriving 20 seconds from start instead of 15 seconds (mismatch between absolute intention and relative execution).
2. **State persistence**: In `saveState()` (`world.js:48-54`) and `loadState()` (`world.js:77-90`), the `this.time`, `this.isDay`, and `this.agentsArrived` variables are persisted, but the modified `this.arrivalTimers` array is ignored. Consequently, any partial progress toward an agent's arrival is lost upon reload, resetting the countdown back to the initial array value.
3. **Day/night cycle events drop**: In `world.js:103-108`, the update uses modulo arithmetic `this.time = (this.time + dt) % this.dayDuration;` and a single conditional check `if (newIsDay !== this.isDay)` to emit `DAY_NIGHT_CHANGED`. If a massive `dt` (e.g. backgrounding the tab or simulating offline time) exceeds `this.dayDuration / 2` or wraps around entirely, zero or one event is emitted, dropping multiple cycle events.

## Logic Chain
1. To fix the **timer mismatch and framerate dependency**, we should stop mutating the `arrivalTimers` array. The values `[5000, 15000]` should be treated as absolute timestamps (uptime). We can introduce a `this.uptime` variable that tracks total simulated milliseconds.
2. In the `update(dt)` function, we simply do `this.uptime += dt`. We then use a `while` loop: `while(this.agentsArrived < this.arrivalTimers.length && this.uptime >= this.arrivalTimers[this.agentsArrived])`. This loop spawns agents sequentially, automatically handling large `dt` leaps and completely eliminating the "timer debt" bug, since `this.uptime` natively absorbs all overflow.
3. To fix **state persistence**, we only need to add `uptime: this.uptime` to the state object in `saveState()` and restore `this.uptime = state.uptime || 0` in `loadState()`. Because `this.arrivalTimers` is no longer mutated, it doesn't need to be saved.
4. To fix the **day/night cycle event drop**, we must replace the modulo math with a `while` loop that slices `dt` into manageable chunks. By calculating the time remaining until the next phase change (e.g. `this.dayDuration / 2 - this.time`), we can deduct that time from `dt`, trigger the phase change, emit the event, and continue until `dt` is exhausted.

## Caveats
- Assuming `[5000, 15000]` are intended to be absolute times since game start (Agent 1 arrives at 5s, Agent 2 arrives at 15s). If they were strictly meant to be relative intervals (Agent 2 arrives 15s *after* Agent 1), the absolute values in the array should be redefined as `[5000, 20000]`. Based on the bug report's mention of "Absolute/relative timer mismatch", treating them as absolute solves the underlying structural flaw.
- If the game introduces endless random arrivals later, the `uptime` absolute array approach will need to be refactored into a recurring event scheduler, but for the current static array, it is optimal.

## Conclusion
The bugs stem from treating absolute thresholds as relative mutable countdowns, omitting timer state during persistence, and jumping time boundaries without event iteration.
**Fix Strategy**:
1. Add `this.uptime = 0;` to `constructor()`.
2. Update `saveState()` and `loadState()` to include `uptime`.
3. In `update(dt)`, increment `this.uptime += dt` and use a `while` loop checking `this.uptime >= this.arrivalTimers[this.agentsArrived]` to spawn agents.
4. In `update(dt)`, replace the modulo day/night logic with a `while` loop that iteratively drains `dt` to boundaries, toggling `this.isDay` and emitting `DAY_NIGHT_CHANGED` at each boundary.

## Verification Method
1. Open `d:/Emergent Game/js/world.js` and implement the changes.
2. Call `update(16000)` instantly. Verify that *both* agents arrive immediately and 0 time is lost.
3. Call `update(60000 * 3)` instantly. Verify that `DAY_NIGHT_CHANGED` emits exactly 6 times (3 days, 3 nights).
4. Run `saveState()`, note the `uptime`, restart the world, and `loadState()`. Verify that the `uptime` loads correctly and agent spawn timers do not reset.
