# Handoff Report: Renderer and Interaction Fix Strategy

## 1. Observation
- **Interface Contract Violation**: In `d:/Emergent Game/js/interaction.js` at lines 54-58, the `events.emit('ACTION_TAKEN', ...)` payload contains `targetId: targetPerson.id`.
- **Visual Obscuration Bug**: In `d:/Emergent Game/js/renderer.js` at lines 84-87, the radial menu slices are drawn as wedges originating from the center using `moveTo(x, y)` and a single `arc()`. At lines 112-117, a solid circle filled with the background color (`world.isDay ? '#1a1d2e' : '#0a0c16'`) is drawn over the center to fake a donut shape, which hides any underlying entity or halo.
- **Z-Index Picking Bug**: In `d:/Emergent Game/js/interaction.js` at line 68, the `handlePointerDown` method iterates through agents using a forward loop (`for (const person of this.world.persons)`). Because rendering is also done in forward order, the visually topmost agent is at the end of the array, but the click detection selects the bottom-most agent first.

## 2. Logic Chain
1. To fix the interface contract, the property name `targetId` in the `ACTION_TAKEN` event payload must be changed to `target` in `interaction.js`.
2. To fix the z-index picking issue, `interaction.js` should iterate over `this.world.persons` in reverse order. This ensures the last drawn (topmost) agent intercepts the pointer events first.
3. To fix the radial menu rendering, the slices should be drawn as true donut paths in `renderer.js`. The `moveTo(x, y)` call should be removed. Instead, the path should consist of an outer arc (`arc(..., false)`) followed immediately by an inner arc in the reverse direction (`arc(..., true)`). After modifying the slice path, the code drawing the central fake background circle (lines 112-117) must be completely deleted, exposing the center without obscuring the background.

## 3. Caveats
- I did not directly observe `SCOPE.md`, but I rely on the reviewer feedback which strictly dictates the payload change.
- Reverse iteration in `interaction.js` assumes that the click bounding box overlap perfectly matches the visual overlap. Given they are circles of the same radius, this holds true.

## 4. Conclusion
The implementation strategy is as follows:
- **`interaction.js`**: Update line 56 from `targetId: targetPerson.id` to `target: targetPerson.id`.
- **`interaction.js`**: Update line 68 from `for (const person of this.world.persons) {` to `for (let i = this.world.persons.length - 1; i >= 0; i--) { const person = this.world.persons[i];`.
- **`renderer.js`**: Replace lines 84-87 with:
  ```javascript
  this.ctx.beginPath();
  this.ctx.arc(x, y, radius, startAngle, endAngle, false);
  this.ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
  this.ctx.closePath();
  ```
- **`renderer.js`**: Delete lines 111-118 which draw the inner masking circle.

## 5. Verification Method
- **Contract Verification**: Monitor the `ACTION_TAKEN` event payloads (e.g., via console logs) and ensure they contain `target` instead of `targetId`.
- **Z-Index Verification**: Spawn two overlapping agents and click exactly on the intersection area. The interaction menu should open for the agent that is rendered on top.
- **Rendering Verification**: Open the radial menu on an agent and visually confirm that the agent's cyan circle and dashed halo remain visible through the hole in the center of the menu.
