# Handoff: Brain Implementation Plan (Milestone 3)

## 1. Observation
- `SCOPE.md` mandates building `nn.js` and `trainer.js` from scratch for Milestone 3 (Brain).
- `PROJECT.md` defines the interaction flow: `interaction.js` dispatches `ACTION_TAKEN` events containing `{ action, targetId, stateSnapshot }`.
- Actions available in `interaction.js` are `['Feed', 'Connect', 'Guide', 'Approve', 'Correct']` (5 classes).
- `Person` `stateSnapshot` contains `id, position, direction, hunger, social`. `World` state contains `time, isDay`.
- Current `js/nn.js` and `js/trainer.js` contain legacy/unrelated code for a cellular automata implementation (CNNs processing a 5x5 grid) and do not match the interface contracts defined in `PROJECT.md` for this phase.

## 2. Logic Chain
- To meet M3 requirements, the legacy files must be completely replaced.
- **`nn.js` Architecture:** 
  - Input: 8-dimensional flat array derived from `personState` (`x`, `y`, `dirX`, `dirY`, `hunger`, `social`) and `worldState` (`time`, `isDay`). Variables should be normalized (e.g. dividing positions by world dimensions).
  - Layers: A Dense sequential model (`tf.sequential()`) with `relu` activations, terminating in a 5-unit Dense layer with `softmax` activation.
  - Interface: `train(xTrain, yTrain)` for fitting, and `predict(worldState, personState)` which runs inference and conditionally calls `events.emit('NN_DECISION', { action, targetId })` if `confidence > threshold`. 
  - Persistence: Use `tf.loadLayersModel('indexeddb://emergent-brain')` on init, and `save('indexeddb://emergent-brain')` after each training run.
- **`trainer.js` Architecture:** 
  - Setup: Takes `world` and `brain` references in the constructor. Subscribes to `events.on('ACTION_TAKEN')`.
  - Data Collection: Converts `stateSnapshot` + `world` state into the 8-dim array, and one-hot encodes the action string into a 5-dim target array. Stores these pairs in an internal buffer.
  - Training loop: Sets a `setInterval` (e.g., every 10 seconds). Asynchronously extracts `xTrain` and `yTrain` from the buffer, passes them to `brain.train(xTrain, yTrain)`, and then clears the buffer.

## 3. Caveats
- The global simulation loop (which lives in `main.js`) may not yet automatically call `brain.predict()` to trigger autonomous inference; according to `PROJECT.md`, full E2E wiring is planned for Milestone 5.
- The state feature normalization constants (like screen width 800) are hardcoded assumptions based on code in `world.js`.

## 4. Conclusion
The implementation strategy is solid. `js/nn.js` and `js/trainer.js` will be completely overwritten with the new logic described above, perfectly fulfilling the Milestone 3 requirements.

## 5. Verification Method
After implementation:
1. Initialize `World`, `Brain`, and `Trainer`.
2. Emit an `ACTION_TAKEN` event via `events.emit`.
3. Wait for the `Trainer` interval to fire and observe console logs confirming `tf.fit()` execution.
4. Manually call `brain.predict(worldState, person.getState())` to confirm it returns valid class IDs and triggers `NN_DECISION` if confident.
