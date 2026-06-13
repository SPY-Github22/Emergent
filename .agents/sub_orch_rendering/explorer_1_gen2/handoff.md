# Handoff Report: Milestone 2 Rendering & Interaction Fixes

## 1. Observation
- **Interface Contract**: In `d:/Emergent Game/js/interaction.js` lines 54-58, the event payload emitted for `'ACTION_TAKEN'` contains the key `targetId`.
- **Visual Obscuration Bug**: In `d:/Emergent Game/js/renderer.js` lines 84-87, the radial menu slice path is drawn as a solid pie wedge (connecting to the center `x, y`). Subsequently, lines 111-117 draw a solid filled circle with the background color over the center to create a donut hole, but this obscures any entities drawn underneath it in earlier layers.
- **Z-Index Picking Bug**: In `d:/Emergent Game/js/interaction.js` lines 68-82, the hit-detection logic uses `for (const person of this.world.persons)`, traversing the agents from bottom-to-top of the z-order, leading to the wrong agent being picked when they overlap.

## 2. Logic Chain
- **Interface Contract Fix**: Modifying the emitted event payload key from `targetId` to `target` directly addresses the `SCOPE.md` violation and aligns with the expected data structure.
- **Visual Obscuration Fix**: If the path for each radial slice is drawn as a true donut sector using `arc()` for the outer radius and a reverse `arc()` for the inner radius, it will naturally have a hole in the center without needing an opaque cover. We can replace the `moveTo()` and simple `arc()` with `arc(..., false)` and `arc(..., true)`, and safely delete the entire "punch out" circle code block at the end.
- **Z-Index Picking Fix**: Because agents are rendered sequentially, the last agent in the array is drawn on top. A reverse `for` loop starting from `this.world.persons.length - 1` down to `0` ensures that the topmost agent is evaluated first during the hit test.

## 3. Caveats
- Assuming `SCOPE.md` expects `target` to contain the ID (e.g. `targetPerson.id`), not the object itself, as inferred from the original implementation `targetId: targetPerson.id`.
- For the true donut path to fill correctly, we need to ensure the inner arc's start and end angles match the outer arc's end and start angles exactly (reversed), avoiding intersecting lines.

## 4. Conclusion
Implement the following changes:
1. `interaction.js`: Rename `targetId` to `target` in the `ACTION_TAKEN` emit payload (line 56).
2. `interaction.js`: Change hit testing loop to `for (let i = this.world.persons.length - 1; i >= 0; i--)` and define `const person = this.world.persons[i];` (lines 68).
3. `renderer.js`: Change the path construction (lines 84-87) to:
   ```javascript
   this.ctx.beginPath();
   this.ctx.arc(x, y, radius, startAngle, endAngle, false);
   this.ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
   this.ctx.closePath();
   ```
   And delete the center punching code (lines 111-118).

## 5. Verification Method
- **Contract Verification**: Monitor the `ACTION_TAKEN` event listener to confirm `{ target: "..." }` is received.
- **Visual Verification**: Open the game, click an agent to open the radial menu, and visually confirm the agent and its dashed halo remain visible in the center of the menu.
- **Hit-Test Verification**: Move two agents to overlap. Click the intersecting area and verify the agent visually rendered on top is the one selected.
