# Handoff Report: Rendering & Input (Milestone 2)

## Observation
- `world.js` and `person.js` (from Milestone 1) define a continuous 2D coordinate space. `world.js` manages time, day/night cycles, and an array of `Person` instances. Agents have `x`, `y` positions, `hunger`, `social` stats, and `direction`.
- The current `renderer.js` and `interaction.js` in the codebase are tied to an older, grid-based cellular automata game (`Engine` class) using pixel-buffer manipulation (`ImageData`). These files do not align with the new continuous agent architecture described in `PROJECT.md` and `SCOPE.md`.
- `index.html` contains an existing canvas element (`<canvas id="grid-canvas"></canvas>`) but is wrapped in old UI structures.
- `SCOPE.md` specifies that `renderer.js` must implement a `Renderer` class with a `render(world, interactionState)` method supporting 4 layers (Background, Entities, Effects, UI/Menus).
- `SCOPE.md` specifies that `interaction.js` must implement an `Interaction` class that binds to the canvas, listens to mouse events for hit detection, manages radial menus, and dispatches `ACTION_TAKEN` events via `events.js`.

## Logic Chain
1. Because `world.js` now uses continuous coordinates (e.g., `x = Math.random() * 800`, `y = Math.random() * 600`), `renderer.js` must abandon the pixel-buffer grid approach and adopt standard HTML5 Canvas 2D primitives (`fillRect`, `arc`, `fillText`, etc.).
2. To satisfy the 4-layer requirement in `renderer.js`, the `render(world, interactionState)` method should clear the canvas and sequentially call four sub-methods: `_renderBackground()` (day/night shading), `_renderEntities()` (drawing agents and their status bars), `_renderEffects()` (particles/selection outlines), and `_renderUI()` (radial menus and tooltips). This ensures proper Z-ordering.
3. `interaction.js` must capture mouse coordinates relative to the canvas. To determine what was clicked, it will perform distance-based collision detection against `world.persons` (since agents are drawn as circles).
4. `interaction.js` needs internal state (`interactionState`) to track the `hoveredAgentId`, and radial menu data (`isOpen`, `x`, `y`, `targetId`, `options`). The `Renderer` will read this state to visually highlight the hovered agent and draw the radial menu.
5. Clicks within `interaction.js` must first check if they intersect an open radial menu wedge. If so, it emits an event like `events.emit('ACTION_TAKEN', { action: 'Feed', targetId: agent.id })` and closes the menu. If no menu is open, clicks on an agent will open the menu.

## Caveats
- The current `main.js` and `index.html` are still heavily coupled to the old cellular automata game. Integrating the new `renderer.js` and `interaction.js` might require a temporary bootstrap script or partial rewrite of `main.js` to construct `World`, `Renderer`, and `Interaction` and run the simulation loop, replacing `Engine`.
- Canvas dimensions are assumed to be 800x600 based on agent spawn logic, but `index.html` uses different scaling logic. Hardcoding or passing dimensions on initialization will be necessary.
- We assume simple hit-circle mechanics for agent interaction.

## Conclusion
`renderer.js` and `interaction.js` must be rebuilt from scratch to target the continuous coordinate system defined by `world.js`. 
- **Renderer Strategy:** Implement a class that takes a canvas context and loops through the `World` array, drawing shapes for the background (time of day), entities (agents), effects, and UI (radial menu) sequentially on each frame.
- **Interaction Strategy:** Implement a class that listens to `mousemove` and `click` on the canvas, uses simple geometry (Euclidean distance) to detect agent hover/clicks, updates a local `state` object (read by the Renderer), and handles radial menu logic, emitting `ACTION_TAKEN` events to `events.js` when an option is selected.

## Verification Method
1. Replace `renderer.js` and `interaction.js` with the newly implemented classes.
2. Create a minimal bootstrap script (e.g. replacing `main.js`) that instantiates `World`, `Renderer`, and `Interaction`, then runs a `requestAnimationFrame` loop calling `world.update(dt)` and `renderer.render(world, interaction.getState())`.
3. Open `index.html`, verify that the day/night cycle colors render, agents appear as circles, hovering over them triggers highlights, clicking them opens a radial menu, and clicking a menu option fires an `ACTION_TAKEN` event (verifiable via `console.log`).
