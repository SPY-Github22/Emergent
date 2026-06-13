import { World } from './js/world.js';
import { Person } from './js/person.js';

// Mock IndexedDB
class MockIDBRequest {
    constructor() {
        this.onsuccess = null;
        this.onerror = null;
    }
}
class MockIDBObjectStore {
    constructor(name) {
        this.name = name;
        this.data = new Map();
    }
    put(item) {
        const req = new MockIDBRequest();
        setTimeout(() => {
            this.data.set(item.id, item);
            if (req.onsuccess) req.onsuccess({ target: { result: item.id } });
        }, 0);
        return req;
    }
    get(id) {
        const req = new MockIDBRequest();
        setTimeout(() => {
            const item = this.data.get(id);
            if (req.onsuccess) req.onsuccess({ target: { result: item } });
        }, 0);
        return req;
    }
}
class MockIDBTransaction {
    constructor(store) {
        this.store = store;
    }
    objectStore(name) {
        return this.store;
    }
}
class MockIDB {
    constructor() {
        this.store = new MockIDBObjectStore('worldState');
        this.objectStoreNames = { contains: () => true };
    }
    transaction(stores, mode) {
        return new MockIDBTransaction(this.store);
    }
}
global.indexedDB = {
    open: (name, version) => {
        const req = new MockIDBRequest();
        setTimeout(() => {
            if (req.onsuccess) req.onsuccess({ target: { result: new MockIDB() } });
        }, 0);
        return req;
    }
};

async function runTests() {
    console.log("Starting tests...");
    let passed = 0, failed = 0;
    
    function assert(condition, message) {
        if (!condition) {
            console.error(`FAIL: ${message}`);
            failed++;
        } else {
            console.log(`PASS: ${message}`);
            passed++;
        }
    }

    try {
        // Test 1: Day/Night cycle with large dt
        const world = new World();
        // Day starts at absoluteTime = 0, isDay = true.
        // Day duration = 60000.
        // 0-29999: Day, 30000-59999: Night, 60000-89999: Day, 90000-119999: Night
        world.update(90000); 
        // Expected: passed 30000 (Day->Night), 60000 (Night->Day), 90000 (Day->Night)
        // At 90000, isDay should be false.
        assert(world.isDay === false, `After 90000ms, isDay should be false (got ${world.isDay})`);
        assert(world.time === 30000, `After 90000ms, time should be 30000 (got ${world.time})`);

        // Test 2: Multiple small dt updates
        const world2 = new World();
        for (let i = 0; i < 30001; i++) {
            world2.update(1);
        }
        assert(world2.isDay === false, `After 30001 small updates, isDay should be false (got ${world2.isDay})`);
        
        // Test 3: Agent arrival sequential
        const world3 = new World();
        world3.update(5000);
        assert(world3.agentsArrived === 1, `At 5000ms, 1 agent arrived (got ${world3.agentsArrived})`);
        assert(world3.persons.length === 1, `At 5000ms, 1 person in persons array (got ${world3.persons.length})`);
        world3.update(9999);
        assert(world3.agentsArrived === 1, `At 14999ms, still 1 agent (got ${world3.agentsArrived})`);
        world3.update(1);
        assert(world3.agentsArrived === 2, `At 15000ms, 2 agents arrived (got ${world3.agentsArrived})`);

        // Test 4: Agent arrival with large dt
        const world4 = new World();
        world4.update(20000);
        assert(world4.agentsArrived === 2, `At 20000ms jump, 2 agents arrived (got ${world4.agentsArrived})`);

        // Test 5: Save and Load State
        const world5 = new World();
        await world5.initDB();
        world5.update(15000); // 2 agents
        world5.persons[0].hunger = 50;
        await world5.saveState();
        
        const world6 = new World();
        await world6.initDB();
        await world6.loadState();
        assert(world6.absoluteTime === 15000, `Loaded absoluteTime should be 15000 (got ${world6.absoluteTime})`);
        assert(world6.agentsArrived === 2, `Loaded agentsArrived should be 2 (got ${world6.agentsArrived})`);
        assert(world6.persons.length === 2, `Loaded 2 persons (got ${world6.persons.length})`);
        assert(world6.persons[0].hunger === 50, `Loaded person hunger is 50 (got ${world6.persons[0].hunger})`);

    } catch (e) {
        console.error("Test execution threw error:", e);
        failed++;
    }

    console.log(`\nTests completed. Passed: ${passed}, Failed: ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();
