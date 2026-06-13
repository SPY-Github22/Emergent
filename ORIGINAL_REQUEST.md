# Original User Request

## Initial Request — 2026-06-12T17:43:13Z

# Teamwork Project Prompt

> Status: Launched
> Goal: Execute the Emergent game build based on the agreed-upon architecture.

Emergent is a free, browser-based interactive simulation where the player acts as a teacher to an evolving civilization, built entirely from scratch using TensorFlow.js (client-side, zero external dependencies). Every player action acts as training data for a neural network that eventually takes over and manages the agents autonomously based on the player's learned values.

Working directory: d:/Emergent Game

## Requirements

### R1. Architecture & Core Simulation
Implement the architecture specified in `implementation_plan.md`, including `world.js`, `person.js`, `events.js`, and the 4-layer canvas `renderer.js`. Support 2 fully illustrated agents arriving sequentially, a day-night cycle, and the persistence of the world in IndexedDB.

### R2. Interaction & Neural Network
Implement `interaction.js` with radial menus for actions (Feed, Connect, Guide, Approve, Correct) and `nn.js` using TensorFlow.js (Dense layers). The NN must learn from player actions via `trainer.js` and act autonomously (then notify via the Whisper Bar) once confidence is high enough. Support IndexedDB persistence for the NN.

### R3. UI & Onboarding
Implement the UI specified in `implementation_plan.md`, including the Whisper Bar, Mind Panel, Journal, and the cinematic opening sequence / tutorial.

### R4. Integrity & Constraints
Direct copying of core logic from existing open-source projects is prohibited. Code must be written from scratch, though existing open-source code can be used as a reference.

## Acceptance Criteria

### Functional Prototype
- [ ] The game boots successfully in the browser without errors.
- [ ] 2 agents arrive sequentially and can be interacted with.
- [ ] The TensorFlow.js dense neural network correctly trains in the background and eventually triggers autonomous actions based on learned player behavior.
- [ ] The Whisper Bar, Mind Panel, and radial context menus function visually.
- [ ] Manual verification and final QA will be performed by the User; the agent team's goal is to deliver a functional, feature-complete integration of the implementation plan.

(Note: The team is permitted and encouraged to use `supervisor_addon` plugin skills if helpful during execution.)
