/**
 * world.js
 * Manages the global simulation state.
 */

import { Person } from './person.js';
import { events } from './events.js';

export class World {
    constructor() {
        this.persons = [];
        this.time = 0; // Current time in the day cycle
        this.dayDuration = 60000; // 60 seconds per full day/night cycle
        this.isDay = true;
        
        // Arrival logic for 2 agents
        this.agentsArrived = 0;
        this.arrivalTimers = [5000, 15000]; // Agent 1 arrives at 5s, Agent 2 at 15s

        // DB configuration
        this.dbName = 'EmergentDB';
        this.dbVersion = 1;
        this.storeName = 'worldState';
        this.db = null;
    }

    /**
     * Initialize the world and load state from IndexedDB if available.
     */
    async init() {
        await this.initDB();
        const savedState = await this.loadState();
        if (savedState) {
            this.restoreState(savedState);
        }
    }

    initDB() {
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

    async saveState() {
        if (!this.db) return;
        const state = {
            id: 'currentState',
            time: this.time,
            isDay: this.isDay,
            agentsArrived: this.agentsArrived,
            persons: this.persons.map(p => p.getStateSnapshot())
        };
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put(state);
            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e);
        });
    }

    async loadState() {
        if (!this.db) return null;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get('currentState');
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e);
        });
    }

    restoreState(state) {
        this.time = state.time;
        this.isDay = state.isDay;
        this.agentsArrived = state.agentsArrived;
        this.persons = state.persons.map(pData => {
            const p = new Person(pData.id, pData.x, pData.y);
            p.loadStateSnapshot(pData);
            return p;
        });
    }

    update(dt) {
        // Day/night cycle update
        this.time = (this.time + dt) % this.dayDuration;
        const newIsDay = this.time < this.dayDuration / 2;
        if (newIsDay !== this.isDay) {
            this.isDay = newIsDay;
            events.emit('DAY_NIGHT_CHANGED', { isDay: this.isDay });
        }

        // Sequential arrival logic
        if (this.agentsArrived < this.arrivalTimers.length) {
            this.arrivalTimers[this.agentsArrived] -= dt;
            if (this.arrivalTimers[this.agentsArrived] <= 0) {
                this.addAgent(this.agentsArrived + 1);
                this.agentsArrived++;
            }
        }

        // Update all agents
        for (const person of this.persons) {
            person.update(dt);
        }
    }

    addAgent(agentNum) {
        const x = Math.random() * 800;
        const y = Math.random() * 600;
        const person = new Person(`agent_${agentNum}`, x, y);
        this.persons.push(person);
        events.emit('AGENT_ARRIVED', { person });
    }
}
