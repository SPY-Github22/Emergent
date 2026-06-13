# Scope: Rendering & Input

## Architecture
- `renderer.js`: Handles all canvas drawing across 4 layers (Background, Entities, Effects, UI/Menus).
- `interaction.js`: Listens to mouse events, determines what the user clicked (agent vs ground), draws radial menus, and dispatches `ACTION_TAKEN` events to `events.js`.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 2 | Rendering & Input | Build `renderer.js` and `interaction.js` completely from scratch. | M1 | DONE |

## Interface Contracts
- `renderer.js`: `Renderer` class with a `render(world, interactionState)` method. Must support 4 distinct rendering layers.
- `interaction.js`: `Interaction` class that binds to the canvas, updates interaction state (which menu is open), and `events.emit('ACTION_TAKEN', { action: 'Feed', target: person.id })`.
- Dependencies: Must read state from `world.js` and `person.js` constructed in M1.
