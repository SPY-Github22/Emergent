## Review Summary

**Verdict**: VETO / REQUEST_CHANGES

## Findings

### [Critical] Memory Leak in `nn.js` `load()`
- **What**: The fresh model created by `buildModel()` is never disposed before being overwritten by the model loaded from IndexedDB. 
- **Where**: `nn.js`, lines 25-26 (`this.model = await tf.loadLayersModel(...)`)
- **Why**: In TensorFlow.js, abandoning a model reference without calling `this.model.dispose()` causes the underlying WebGL textures/tensors to leak.
- **Suggestion**: Add `if (this.model) { this.model.dispose(); }` before assigning the newly loaded model.

### [Critical] NaN Weight Poisoning NOT Fixed
- **What**: The state unpacking logic does not protect against `NaN` values.
- **Where**: `nn.js` lines 81-88 and `trainer.js` lines 133-140.
- **Why**: `(state.hunger ?? 0)` and `(s.hunger !== undefined ? s.hunger : 0)` both allow `NaN` to pass through (since `NaN !== undefined` and `NaN` is not nullish). If `person.js` emits a `NaN` state, it will propagate into the tensors and permanently poison the network weights.
- **Suggestion**: Use `Number.isFinite(val) ? val : 0` or `val || 0` to safely coalesce `NaN` values to 0.

### [Major] Inconsistent and Fragile State Unpacking
- **What**: `nn.js` and `trainer.js` use completely different logic to unpack the same state object.
- **Where**: `nn.js` `predict()` vs `trainer.js` `trainTask()`.
- **Why**: `trainer.js` uses truthiness checks like `s.position.x ? s.position.x : 0` (which is logically flawed for valid `0` values, although it coincidentally evaluates to `0` here), while `nn.js` uses nullish coalescing `?? 0`. This discrepancy can cause the same world state to be represented differently during training vs. inference.
- **Suggestion**: Create a single shared method in `nn.js` like `formatState(state)` and call it from both `predict()` and `trainTask()`.

### [Major] Database Leak in `trainer.js`
- **What**: Samples added to the database can be orphaned and never deleted.
- **Where**: `trainer.js` lines 53-60 (`loadSamples()`).
- **Why**: If fallback samples were added before the DB initialized, the combined array `[...results, ...this.samples]` may exceed `maxSize`. `slice(-this.maxSize)` drops the oldest `results` from memory, but DOES NOT delete them from the object store. Over multiple sessions, the DB size will grow beyond `maxSize` continuously.
- **Suggestion**: Delete any `results` from the database that are sliced out during the merge.

### [Minor] Missing Synchronization for `load()`
- **What**: `this.nn.load()` is fired in the constructor without awaiting, and `setInterval` starts ticking immediately.
- **Where**: `trainer.js` lines 20-24.
- **Why**: If IndexedDB takes longer than 5 seconds to load, `trainTask()` might execute on the "fresh" model, save it, and then have it immediately overwritten by the delayed `load()` operation, wiping out the training progress.
- **Suggestion**: Set an `isLoaded` flag or await `this.nn.load()` before starting the training loop.

## Conclusion
The implementation successfully fixed the IndexedDB ID deletion errors (`oldest.dbId !== undefined` check) and wrapped `predict` in `tf.tidy`, which fixes some leaks. However, critical vulnerabilities regarding TF tensor leaks, NaN weight poisoning, and state consistency remain. **VETO**.

## Verification Method
- **Memory leak**: Call `nn.load()` multiple times in the console and monitor `tf.memory().numTensors`. It will continuously increase.
- **NaN poisoning**: Trigger an action with `{ stateSnapshot: { hunger: NaN } }` in the world state. Watch the model weights become `NaN` after the next training cycle.
