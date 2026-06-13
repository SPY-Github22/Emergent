# Scope: Foundations

## Architecture
- `world.js`: Manages global simulation state (day/night, arrival of agents, DB persistence).
- `person.js`: Agent state and representation.
- `events.js`: Event bus for decoupling.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Implementation | Build `events.js`, `world.js`, `person.js` completely from scratch. | none | DONE |

## Interface Contracts
- `events.js`: `on()`, `emit()`
- `world.js`: maintains list of `Person`s, updates day/night, triggers `Person.update()`. Initializes IndexedDB.
- `person.js`: state (hunger, social, position), `.update(dt)`, rendering info placeholders.
