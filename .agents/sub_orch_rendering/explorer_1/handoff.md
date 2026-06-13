# Handoff Report: Rendering & Input Strategy (Milestone 2)

## Observation
- **PROJECT.md** and **SCOPE.md** dictate that Milestone 2 requires building `renderer.js` and `interaction.js` from scratch.
- `renderer.js` must implement a `Renderer` class with a `render(world, interactionState)` method supporting 4 layers: Background, Entities, Effects, and UI/Menus.
- `interaction.js` must implement an `Interaction` class that binds to canvas events, manages radial menu state, determines click targets (agent vs ground), and emits `ACTION_TAKEN` via `events.js`.
- **`world.js` & `person.js`**: Agents (`Person`) exist in a 2D continuous space (e.g. `x, y` from `0-800` and `0-600`), not a discrete grid. They have properties `position`, `hunger` (0-100), `social` (100-0), and `direction`. The world tracks `time`, `isDay`, and holds the array of `persons`.
- **`index.html`**: Contains a single `<canvas id="grid-canvas"></canvas>`. The HTML shell appears somewhat tailored to a discrete grid painter (tools, brush size), which contradicts the continuous `Person` coordinates in `world.js`. However, the single canvas element is exactly what we need.

## Logic Chain
1. **Canvas Management**: Since there is only one canvas element (`#grid-canvas`) in the DOM, the 4 rendering layers must be drawn sequentially onto the same canvas using the Painter's Algorithm.
2. **State Separation**: 
   - `Renderer` is strictly a view layer. It takes `world` and `interactionState` and outputs pixels.
   - `Interaction` is the controller. It holds the `interactionState` (e.g., whether a menu is open, its coordinates, and the hovered option) and listens to the canvas DOM element.
3. **Renderer Strategy (`renderer.js`)**:
   - `clear()`: Wipes the canvas each frame.
   - `drawBackground()`: Checks `world.isDay` to set a light/dark fill style.
   - `drawEntities()`: Loops through `world.persons`. Draws a circle at `person.position.x/y`. Optionally draws small status bars above for `hunger` and `social`.
   - `drawEffects()`: Placeholder for particles or day/night transition overlays.
   - `drawUI()`: Checks `interactionState`. If a radial menu is open, draws an outer ring centered at the interaction coordinates, divided into slices based on the available options. Highlights the slice matching `interactionState.hoveredIndex`.
4. **Interaction Strategy (`interaction.js`)**:
   - Stores `state = { menuOpen: false, targetType: null, targetId: null, position: {x,y}, options: [], hoveredIndex: -1 }`.
   - Listens to `mousedown` on the canvas:
     - If a menu is OPEN: Calculate angle from menu center to mouse. If within the radius of the menu ring, map the angle to an option index. Emit `events.emit('ACTION_TAKEN', { action: options[index], targetId: state.targetId, stateSnapshot: /*...*/ })`. Close menu.
     - If menu is CLOSED: Iterate through `world.persons`. If Euclidean distance between mouse and `person.position` is less than entity radius, open the menu for that Agent (options: e.g. ["Feed", "Socialize"]). Otherwise, open menu for Ground.
   - Listens to `mousemove` on the canvas to update `hoveredIndex` for visual feedback in the UI layer.

## Caveats
- **UI Mismatch**: The HTML shell in `index.html` includes "brush size", "tools palette", and talks about a "grid". The continuous coordinate system in `world.js` and radial menus differ conceptually from a cell grid painter. The rendering logic proposed here will ignore the HTML palette tools and focus on the M2 requirements (Canvas 2D simulation rendering).
- **Animation Loop**: Neither `renderer.js` nor `interaction.js` should own the `requestAnimationFrame` loop. That should be implemented in `main.js` which orchestrates `world.update()`, `renderer.render()`, etc.

## Conclusion
Build `renderer.js` to expose a `Renderer` class that sequentially draws Background, Entities, Effects, and UI on a 2D canvas context. Build `interaction.js` to expose an `Interaction` class that attaches pointer listeners to the canvas, calculates Euclidean distances for hit-testing entities vs ground, maintains radial menu state, and dispatches `ACTION_TAKEN` events to `events.js`.

## Verification Method
To independently verify this strategy:
1. Implement the two classes.
2. In a temporary `main.js`, instantiate `World`, `Renderer`, and `Interaction`.
3. Set up a `requestAnimationFrame` loop calling `world.update(dt)` and `renderer.render(world, interaction.getState())`.
4. Click the canvas: expect a menu to render. Click an agent: expect a menu on the agent.
5. Click a menu option: verify the console logs the emitted `ACTION_TAKEN` event payload via an `events.on('ACTION_TAKEN', ...)` listener.
