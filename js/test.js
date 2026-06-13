import { World } from './world.js';
import { Person } from './person.js';

// Simple IndexedDB mock
class MockRequest {
    constructor() {
        this.onsuccess = null;
        this.onerror = null;
    }
}

class MockStore {
    constructor() {
        this.data = new Map();
    }
    put(item) {
        const req = new MockRequest();
        setTimeout(() => {
            this.data.set(item.id, item);
            req.result = item.id;
            if (req.onsuccess) req.onsuccess({ target: req });
        }, 0);
        return req;
    }
    get(key) {
        const req = new MockRequest();
        setTimeout(() => {
            req.result = this.data.get(key) || null;
            if (req.onsuccess) req.onsuccess({ target: req });
        }, 0);
        return req;
    }
}

class MockDB {
    constructor() {
        this.store = new MockStore();
        this.objectStoreNames = { contains: () => true };
    }
    transaction() {
        return {
            objectStore: () => this.store
        };
    }
}

global.indexedDB = {
    open: () => {
        const req = new MockRequest();
        setTimeout(() => {
            req.result = new MockDB();
            if (req.onsuccess) req.onsuccess({ target: req });
        }, 0);
        return req;
    }
};

async function runTests() {
    console.log("--- TEST 1: Agent Arrival Timers are Absolute vs Relative ---");
    let w1 = new World();
    w1.update(5000);
    console.log(`After 5000ms, agents arrived: ${w1.agentsArrived} (Expected: 1)`);
    w1.update(10000); // Total 15000ms
    console.log(`After 15000ms total, agents arrived: ${w1.agentsArrived} (Expected: 2 if absolute, 1 if relative)`);
    w1.update(5000); // Total 20000ms
    console.log(`After 20000ms total, agents arrived: ${w1.agentsArrived} (Expected: 2)`);

    console.log("\n--- TEST 2: Timer Reset on Load ---");
    let w2 = new World();
    await w2.initDB();
    w2.update(4000); // 4 seconds pass, agent 1 should arrive in 1 sec
    await w2.saveState();
    
    let w3 = new World();
    w3.db = w2.db; // Share DB mock
    await w3.loadState();
    w3.update(1000); // 1 more second passes
    console.log(`After save/load + 1000ms, agents arrived: ${w3.agentsArrived} (Expected: 1)`);
    w3.update(4000); // Total 5000ms after load
    console.log(`After save/load + 5000ms, agents arrived: ${w3.agentsArrived} (Expected: 1)`);

    console.log("\n--- TEST 3: Day/Night Cycle Edge Case ---");
    let w4 = new World();
    w4.update(30000); // exactly half day
    console.log(`After 30000ms (half cycle), isDay: ${w4.isDay}`); // time = 30000, 30000 < 30000 is false, so it's night.
    w4.update(30000); // exactly full cycle
    console.log(`After 60000ms (full cycle), isDay: ${w4.isDay}`); // time = 0, 0 < 30000 is true, so it's day.
    
    // Wait, what happens if dt is huge?
    let w5 = new World();
    w5.update(150000); // 2.5 days
    console.log(`After 150000ms, time: ${w5.time}, isDay: ${w5.isDay}`);
}

runTests().catch(console.error);
