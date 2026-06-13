# Milestone 2: Rendering & Input Strategy Handoff

## 1. Observation
- **State Data**: `world.js` defines an 800x600 area implicitly (`Math.random() * 800`), tracking `time`, `isDay`, and an array of `Person` instances.
- **Entity Data**: `person.js` defines agents with `position: {x, y}`, `direction`, `hunger`, and `social` attributes.
- **HTML Structure**: `index.html` provides a `<canvas id="grid-canvas"></canvas>` element inside `#canvas-frame`.
- **Requirements (`SCOPE.md`)**:
  - `renderer.js` must contain a `Renderer` class with a `render(world, interactionState)` method supporting 4 layers (Background, Entities, Effects, UI/Menus).
  - `interaction.js` must contain an `Interaction` class binding to the canvas to determine targets (agents vs. ground), manage radial menu state, and emit `ACTION_TAKEN` events to `events.js`.

## 2. Logic Chain
1. **Rendering Approach (`renderer.js`)**:
   - Because `render()` receives both `world` and `interactionState`, the renderer acts purely as a stateless view. 
   - It will grab the 2D context of `grid-canvas` and execute 4 sequential drawing steps:
     - **Layer 1 (Background)**: Draw a full rectangle, tinting its color based on `world.isDay` and `world.time`.
     - **Layer 2 (Entities)**: Iterate over `world.persons`. Draw circles for agents, small lines/triangles for `direction`, and small floating bars for `hunger` and `social` levels.
     - **Layer 3 (Effects)**: Draw selection halos around agents if they are targeted in `interactionState`.
     - **Layer 4 (UI/Menus)**: If `interactionState.radialMenu.active` is true, draw a pie-chart style radial menu at the menu's origin coordinates.
2. **Input Handling Approach (`interaction.js`)**:
   - `Interaction` needs to listen to `pointerdown` (or `click`) on the canvas. 
   - It must maintain an internal `state` (exposed as `interactionState`) that tracks `selectedTargetId`, `radialMenu: { active, x, y, options }`.
   - **Target Identification**: On click, calculate the distance between the mouse `(mx, my)` and each `person.position`. If `distance <= agentRadius`, the user clicked an agent. Set `interactionState.selectedTargetId` and open the radial menu at that location.
   - **Radial Menu Hit Detection**: If the menu is already open, check if the click distance to the menu origin `(cx, cy)` is between the inner and outer radii. If so, use `Math.atan2(my - cy, mx - cx)` to find the angle and determine which slice was clicked.
   - **Event Emission**: When a menu slice is clicked, close the menu and call `events.emit('ACTION_TAKEN', { action: selectedAction, targetId: currentTargetId })`.

## 3. Caveats
- **Canvas Scaling**: `index.html` has no explicit `width` or `height` attributes on the canvas. `renderer.js` should initialize by setting `canvas.width` and `canvas.height` based on the DOM element's computed size or use a fixed 800x600 resolution and scale via CSS.
- **Coordinate Mapping**: Mouse events provide screen/client coordinates (`clientX`, `clientY`). `interaction.js` must map these using `canvas.getBoundingClientRect()` to the internal drawing coordinate system.
- **Script Tags**: `index.html` currently includes `<script src="js/engine.js"></script>` instead of the scripts defined in `PROJECT.md`. This is an inconsistency in the base project but doesn't affect the implementation of M2 modules.

## 4. Conclusion
- **`renderer.js`** should implement a 4-pass Canvas 2D render loop, utilizing `world` state for physical rendering and `interactionState` for overlays.
- **`interaction.js`** should act as the input controller, managing the radial menu state machine (Closed -> Click Agent -> Open -> Click Slice -> Emit Action -> Closed), performing point-to-circle distance and angular calculations for hit detection.

## 5. Verification Method
- **Implementation Check**: Create both files with the proposed classes.
- **Testing**:
  1. Instantiate `world`, `interaction`, and `renderer`.
  2. Mock 1 `Person` at `(400, 300)`.
  3. Call `interaction.handlePointerDown` with coordinates `(400, 300)`.
  4. Verify `interaction.getState().radialMenu.active` is true.
  5. Call `renderer.render(...)` and verify it does not throw errors and executes the 4 layer draw routines.
  6. Call `interaction.handlePointerDown` slightly offset to click a menu slice, and verify `events.on('ACTION_TAKEN')` fires with the correct action name.
