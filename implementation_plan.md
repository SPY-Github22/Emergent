# Emergent: Implementation Plan

## 1. Overview
Emergent is a browser-based simulation where a player acts as a teacher to evolving agents. Player actions generate training data. A TensorFlow.js neural network learns these values and eventually autonomously manages the agents.

## 2. Architecture Components

### Core Simulation
- **`world.js`**: Manages the global simulation state.
  - Day-night cycle state.
  - Controls arrival of the 2 fully illustrated agents.
  - World IndexedDB persistence (save/load state).
- **`person.js`**: Agent representation.
  - Manages agent state (hunger, social, direction, position).
  - Handles "fully illustrated" visual asset management or procedural drawing instructions.
  - Exposes state to the neural network for training.
- **`events.js`**: Global event bus.
  - Decouples UI, simulation, and training.
  - Event types: `ACTION_TAKEN`, `DAY_NIGHT_CHANGED`, `AGENT_ARRIVED`, `NN_DECISION`.
- **`renderer.js`**: 4-Layer Canvas System.
  - Layer 1: Environment & Background (day/night visuals).
  - Layer 2: Entities (Persons, objects).
  - Layer 3: Effects (Particles, highlights).
  - Layer 4: Interactive UI overlay (Radial menus, Whisper Bar overlay).

### AI & Interaction
- **`interaction.js`**: Input handling & UI components.
  - Contextual radial menus when clicking agents or the world.
  - Actions: Feed, Connect, Guide, Approve, Correct.
  - Dispatches `ACTION_TAKEN` events.
- **`nn.js`**: Neural Network (TensorFlow.js).
  - Architecture: Dense layers. Input = (World State + Agent State). Output = Action Probabilities.
  - IndexedDB persistence for weights.
  - Inference method: When confidence > threshold, triggers autonomous actions.
- **`trainer.js`**: Data collection and backpropagation.
  - Listens for `ACTION_TAKEN` to record (State -> Action) pairs.
  - Periodically trains the NN in the background.

### User Interface
- **Whisper Bar**: Notification bar at the bottom/top. Notifies player when the AI takes an autonomous action.
- **Mind Panel**: Visualizes the NN's current confidence, training loss, and learned behavior.
- **Journal**: Log of historical actions and world events.
- **Cinematic Opening / Tutorial**: Onboarding sequence introducing the player to their role as the teacher and the arrival of the two agents.

## 3. Constraints
- Zero external dependencies except TensorFlow.js (`tf.min.js`).
- Code must be written from scratch. Do not reuse existing logic from the legacy grid version.
- Ensure IndexedDB operations are asynchronous and do not block the main loop.
