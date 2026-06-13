


class World {
    constructor() {
        this.persons = [];
        this.time = 0;
        this.absoluteTime = 0;
        this.isDay = true;
        this.dayDuration = 60000; // 60 seconds per full day/night cycle

        // Logic for sequential arrival of 2 agents
        this.agentsArrived = 0;
        this.arrivalTimers = [5000, 15000]; // 5s and 15s

        // IndexedDB configuration
        this.dbName = 'EmergentWorldDB';
        this.dbVersion = 1;
        this.storeName = 'worldState';
        this.db = null;
    }

    /**
     * Initialize the world database.
     */
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e);
        });
    }

    /**
     * Save the current world state asynchronously.
     */
    async saveState() {
        if (!this.db) return;
        
        const state = {
            id: 'world_state_1',
            time: this.time,
            absoluteTime: this.absoluteTime,
            isDay: this.isDay,
            agentsArrived: this.agentsArrived,
            persons: this.persons.map(p => p.getState())
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(state);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    /**
     * Load the world state asynchronously.
     */
    async loadState() {
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get('world_state_1');
            
            request.onsuccess = (e) => {
                const state = e.target.result;
                if (state) {
                    this.time = state.time;
                    this.absoluteTime = state.absoluteTime !== undefined ? state.absoluteTime : state.time;
                    this.isDay = state.isDay;
                    this.agentsArrived = state.agentsArrived ?? (state.persons ? state.persons.length : 0);
                    
                    this.persons = state.persons.map(pState => {
                        const p = new Person(pState.id, pState.position.x, pState.position.y);
                        p.direction = { ...pState.direction };
                        p.hunger = pState.hunger;
                        p.social = pState.social;
                        return p;
                    });
                }
                resolve(state);
            };
            request.onerror = (e) => reject(e);
        });
    }

    /**
     * Update the world simulation by a given time delta.
     * @param {number} dt Delta time in milliseconds
     */
    update(dt) {
        // Update absolute time
        const previousTime = this.absoluteTime;
        this.absoluteTime += dt;
        
        // Day/night cycle update
        let cursor = previousTime;
        const halfDay = this.dayDuration / 2;
        
        while (true) {
            const nextHalfDay = Math.floor(cursor / halfDay) * halfDay + halfDay;
            if (nextHalfDay <= this.absoluteTime) {
                this.isDay = !this.isDay;
                events.emit('DAY_NIGHT_CHANGED', { isDay: this.isDay });
                cursor = nextHalfDay;
            } else {
                break;
            }
        }
        
        this.time = this.absoluteTime % this.dayDuration;

        // Update all agents
        for (const person of this.persons) {
            person.update(dt);
        }

        // Sequential arrival logic
        while (this.agentsArrived < this.arrivalTimers.length && this.absoluteTime >= this.arrivalTimers[this.agentsArrived]) {
            const id = `agent_${this.agentsArrived + 1}`;
            const x = Math.random() * 800; // Assuming an 800x600 grid/screen
            const y = Math.random() * 600;
            
            const newPerson = new Person(id, x, y);
            newPerson.update(this.absoluteTime - this.arrivalTimers[this.agentsArrived]);
            this.persons.push(newPerson);
            events.emit('AGENT_ARRIVED', { person: newPerson });
            
            this.agentsArrived++;
        }
    }
}
