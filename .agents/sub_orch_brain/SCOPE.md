# Scope: Brain

## Architecture
- `nn.js`: Uses TensorFlow.js (`tf.min.js`) to define a dense neural network. Must predict an action based on world state and person state. Includes async IndexedDB save/load.
- `trainer.js`: Listens to `ACTION_TAKEN` events to record training pairs (State -> Action). Periodically trains `nn.js` in the background (asynchronously).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 3 | Brain | Build `nn.js` and `trainer.js` completely from scratch. | M1, M2 | PLANNED |

## Interface Contracts
- `trainer.js`: Subscribes to `events.on('ACTION_TAKEN')`. Extracts the current state from the `world` and the targeted `person`. Stores `(state -> action)` pairs. Calls `nn.train(samples)` periodically without blocking the main thread.
- `nn.js`: Exposes `predict(state)` which returns an action class ID and confidence. If confidence > threshold, it triggers `events.emit('NN_DECISION', { action, targetId })`.
- Dependencies: Must integrate with `events.js`, `world.js`, `person.js` constructed in M1, and train on the actions defined in `interaction.js` (M2).
- TensorFlow.js `tf` is available globally in the browser.
