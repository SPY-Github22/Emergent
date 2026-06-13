# Handoff Report: Foundations Milestone (events.js, world.js, person.js)

**Summary**: A complete architectural blueprint for building `events.js`, `person.js`, and `world.js` from scratch, avoiding legacy code while fulfilling the requested constraints.

## 1. Observation
- `implementation_plan.md` (line 47) enforces: "Code must be written from scratch. Do not reuse existing logic from the legacy grid version."
- `PROJECT.md` defines the exact interface contracts:
  - `events.js`: `on(event, callback)`, `emit(event, data)`
  - `world.js` ↔ `person.js`: World holds an array of `Person` instances and triggers `person.update(dt)`.
- `implementation_plan.md` lists component responsibilities:
  - `world.js`: Day-night cycle, IndexedDB persistence, controls the sequential arrival of 2 agents.
  - `person.js`: State (hunger, social, direction, position), exposed for training.
- A search of the `js/` directory confirms these three files do not currently exist, meaning we are free to write them cleanly without merge conflicts.

## 2. Logic Chain
1. **Module Approach**: Given the requirement for "client-side only" and zero external dependencies (save TF.js), the implementation should use standard ES6 classes. These can be exported as ES modules or attached to the global window object.
2. **`events.js`**: A pure Pub/Sub Event Bus implementation. It stores a map of event names to an array of callback functions.
3. **`person.js`**: An object model encapsulating state (`hunger`, `social`, `position`, `direction`). 
   - Uses an `update(dt)` function to naturally decay stats (e.g., hunger increases, social decreases over time).
   - Requires a `getState()` method to facilitate serialization for both the Neural Net and IndexedDB persistence.
4. **`world.js`**: 
   - Encapsulates the core loop logic (`update(dt)`) which toggles the `isDay` boolean based on accumulated time, emitting `DAY_NIGHT_CHANGED` events.
   - Handles IndexedDB via standard async browser APIs (`indexedDB.open()`, `put`, `get`), ensuring non-blocking operations.
   - Manages agent arrivals via an internal timer or `setTimeout` during initialization, emitting `AGENT_ARRIVED` events when Agent 1 and Agent 2 spawn.

## 3. Caveats
- **Coordinate Space**: The exact coordinate dimensions for "fully illustrated" rendering aren't defined yet. Arbitrary coordinates (e.g., `x: 0, y: 0`) are used as placeholders.
- **Import Strategy**: The code assumes either ES modules (`export`) or global scripts. The implementer should match the setup in `index.html` (which is yet to be fully rewired for the new architecture).
- **Time unit (`dt`)**: The unit of `dt` (milliseconds vs seconds) will be defined by the eventual engine loop. The classes below assume standard time intervals.

## 4. Conclusion
The foundations can be successfully implemented by creating the three files below. These implementations strictly adhere to the contracts and ensure asynchronous DB operations and decoupled event logic.

### Proposed Implementation Drafts:

**`js/events.js`**
```javascript
class EventBus {
  constructor() {
    this.listeners = {};
  }
  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}
export const events = new EventBus(); // Or window.events = new EventBus();
```

**`js/person.js`**
```javascript
export class Person {
  constructor(id, x, y) {
    this.id = id;
    this.position = { x, y };
    this.direction = { x: 0, y: 0 };
    this.hunger = 0;   // 0 (full) to 100 (starving)
    this.social = 100; // 100 (fulfilled) to 0 (lonely)
  }

  update(dt) {
    // Arbitrary stat drift based on delta time
    this.hunger = Math.min(100, this.hunger + (2 * dt));
    this.social = Math.max(0, this.social - (1 * dt));
  }

  getState() {
    return {
      id: this.id,
      hunger: this.hunger,
      social: this.social,
      position: { ...this.position },
      direction: { ...this.direction }
    };
  }
}
```

**`js/world.js`**
```javascript
import { events } from './events.js';
import { Person } from './person.js';

export class World {
  constructor() {
    this.persons = [];
    this.time = 0;
    this.isDay = true;
    this.dayDuration = 1000; // time units per half-cycle
    this.dbName = 'EmergentWorldDB';
    this.db = null;
  }

  async init() {
    await this.initDB();
    const hasSavedState = await this.loadState();
    
    // Sequential agent arrival if starting fresh
    if (!hasSavedState || this.persons.length === 0) {
      this.spawnAgent('agent_1', 100, 100);
      
      // Delay arrival of second agent
      setTimeout(() => {
        this.spawnAgent('agent_2', 300, 200);
      }, 3000); 
    }
  }

  spawnAgent(id, x, y) {
    const p = new Person(id, x, y);
    this.persons.push(p);
    events.emit('AGENT_ARRIVED', { id, x, y });
  }

  update(dt) {
    this.time += dt;
    
    // Day/Night logic
    const previousIsDay = this.isDay;
    this.isDay = (this.time % (this.dayDuration * 2)) < this.dayDuration;
    
    if (this.isDay !== previousIsDay) {
      events.emit('DAY_NIGHT_CHANGED', { isDay: this.isDay });
    }

    // Update agents
    this.persons.forEach(p => p.update(dt));
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('gameState')) {
          db.createObjectStore('gameState', { keyPath: 'id' });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async saveState() {
    if (!this.db) return;
    const state = {
      id: 'save_slot_1',
      time: this.time,
      isDay: this.isDay,
      persons: this.persons.map(p => p.getState())
    };
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('gameState', 'readwrite');
      const store = tx.objectStore('gameState');
      const req = store.put(state);
      req.onsuccess = () => resolve();
      req.onerror = () => reject();
    });
  }

  async loadState() {
    if (!this.db) return false;
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('gameState', 'readonly');
      const store = tx.objectStore('gameState');
      const req = store.get('save_slot_1');
      req.onsuccess = (e) => {
        const data = e.target.result;
        if (data) {
          this.time = data.time;
          this.isDay = data.isDay;
          this.persons = data.persons.map(pData => {
            const p = new Person(pData.id, pData.position.x, pData.position.y);
            p.hunger = pData.hunger;
            p.social = pData.social;
            p.direction = pData.direction;
            return p;
          });
          resolve(true);
        } else {
          resolve(false);
        }
      };
      req.onerror = () => reject();
    });
  }
}
```

## 5. Verification Method
1. Create a dummy HTML file referencing `events.js`, `person.js`, and `world.js` as ES modules.
2. Instantiate `World` and call `world.init()`.
3. Check the DevTools console to ensure `events.emit` fires correctly when agents arrive.
4. Call `world.update(100)` several times and assert `isDay` changes value at the interval threshold.
5. Inspect the browser's IndexedDB storage to confirm `EmergentWorldDB` is created and `gameState` object store populates after calling `world.saveState()`.
