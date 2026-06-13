# Project: Emergent Game

## Architecture
- Client-side only simulation.
- Simulation Loop drives `world.js` and `person.js`.
- Rendering is handled via `renderer.js` reading state from `world.js` and `person.js`.
- Interactions generate events in `events.js`, which are caught by `world.js` (to mutate state) and `trainer.js` (to store as training data).
- `trainer.js` trains `nn.js`.
- `nn.js` runs inference and triggers events via `events.js` when confident.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Foundations | Build `events.js`, `world.js`, `person.js` (simulation loop, agent state, day/night, DB persistence). | none | DONE |
| 2 | Rendering & Input | Build `renderer.js` and `interaction.js` (radial menus, mouse input). | M1 | DONE |
| 3 | Brain | Build `nn.js` and `trainer.js` (TF.js setup, background training, autonomous inference, DB persistence). | M1, M2 | IN_PROGRESS |
| 4 | User Experience | Build UI (Whisper Bar, Mind Panel, Journal, Tutorial) and `main.js` integration. | M3 | PLANNED |
| 5 | E2E Testing | Ensure game boots, 2 agents arrive, NN trains and acts autonomously, UI elements function. | M4 | PLANNED |

## Interface Contracts

### `events.js`
- `on(event, callback)`
- `emit(event, data)`

### `world.js` ↔ `person.js`
- World holds an array of `Person` instances.
- World triggers `person.update(dt)`.

### `interaction.js` ↔ `events.js`
- Dispatches `{ type: 'ACTION_TAKEN', action: 'Feed', targetId: 'agent_1', stateSnapshot: {...} }`

### `trainer.js` ↔ `nn.js`
- `trainer.js` batches `stateSnapshot` -> `action` as tensors.
- Calls `nn.train(xTrain, yTrain)`.

### `nn.js` ↔ `world.js`
- `nn.predict(currentState)` returns `actionId`.
- If confidence high, `emit('NN_DECISION', { action, targetId })`.

## Code Layout
- `index.html`: Entry point, loads scripts.
- `style.css`: Styles for overlay UI elements.
- `js/events.js`: Event bus.
- `js/world.js`: World simulation.
- `js/person.js`: Agent logic.
- `js/renderer.js`: Canvas rendering.
- `js/interaction.js`: Input and radial menus.
- `js/nn.js`: TF.js neural net.
- `js/trainer.js`: Training logic.
- `js/ui.js`: UI overlays (Whisper, Mind Panel, Journal).
- `js/main.js`: Bootstrapping.
