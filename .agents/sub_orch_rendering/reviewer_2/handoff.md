# Handoff Report: Milestone 2 Review

## 1. Observation
- `SCOPE.md` specifies the interface contract for `interaction.js` as: `events.emit('ACTION_TAKEN', { action: 'Feed', target: person.id })`.
- In `interaction.js` (lines 54-58), the event emitted is:
  ```javascript
  events.emit('ACTION_TAKEN', {
      action: action,
      targetId: targetPerson.id,
      stateSnapshot: targetPerson.getState()
  });
  ```
- In `renderer.js` (lines 112-117), the central "hole" of the radial menu is created using a facade/shortcut implementation that paints a solid background color over the center:
  ```javascript
  this.ctx.beginPath();
  this.ctx.arc(x, y, innerRadius, 0, Math.PI * 2);
  this.ctx.fillStyle = world.isDay ? '#1a1d2e' : '#0a0c16'; 
  this.ctx.fill();
  ```
- Since the menu is centered on the active `person` (lines 76-77 of `interaction.js`), drawing a solid background circle of `innerRadius = 25` over it completely obscures the person (radius 12) and their selection halo (radius 20).

## 2. Logic Chain
1. The `interaction.js` implementation emits the event payload with the key `targetId` instead of `target`. This violates the explicit interface contract documented in `SCOPE.md` and will break downstream consumers expecting `data.target`.
2. The `renderer.js` approach to creating a "donut" radial menu relies on painting over the center with the world's background color rather than drawing complex paths or using canvas compositing modes (`destination-out`). 
3. Because the center is painted over with a solid color, it visually erases the very `person` the user just clicked on, defeating the purpose of the UI and breaking visual feedback. This represents a facade shortcut.

## 3. Caveats
- I am unable to test visually since I don't have a browser environment, but the canvas `arc` and `fillStyle` commands clearly paint opaque colors over the entity layer. 
- Including `stateSnapshot` in the emitted event is not explicitly forbidden, but the key mismatch (`target` vs `targetId`) is definitely a bug.

## 4. Conclusion
**Verdict**: REQUEST_CHANGES

### Findings
1. **[Major] Interface Violation in Event Payload**
   - **What**: `interaction.js` emits `{ targetId: person.id }` instead of `{ target: person.id }`.
   - **Where**: `interaction.js` line 56.
   - **Why**: Breaks interface contract with `SCOPE.md`.
   - **Suggestion**: Rename `targetId` to `target` in the `ACTION_TAKEN` event payload.
2. **[Major] Facade Donut Rendering Obscures Target Entity**
   - **What**: `renderer.js` paints a solid background circle to create the inner menu hole.
   - **Where**: `renderer.js` lines 112-117.
   - **Why**: Since the radial menu is placed exactly over the clicked person, the solid inner circle erases the person and their selection halo, severely impacting UX.
   - **Suggestion**: Use proper arc drawing techniques to draw slices with an inner radius (e.g., using `arc` with `anticlockwise` to draw the inner boundary of each slice), or just avoid drawing the inner punch-out entirely.

## 5. Verification Method
- Inspect the emitted `ACTION_TAKEN` object in `interaction.js` to ensure the key `target` is used.
- Render the radial menu over an agent and verify the agent's cyan circle and halo are visible through the center hole.
