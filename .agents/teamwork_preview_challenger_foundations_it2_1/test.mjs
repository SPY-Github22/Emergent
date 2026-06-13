import { World } from '../js/world.js';
import { events } from '../js/events.js';
import assert from 'assert';

// Mock IndexedDB
global.indexedDB = {
    open: function(name, version) {
        let req = { onsuccess: null, onerror: null, onupgradeneeded: null };
        setTimeout(() => {
            req.result = {
                objectStoreNames: { contains: () => false },
                createObjectStore: () => {},
                transaction: function() {
                    return {
                        objectStore: function() {
                            return {
                                put: function(state) {
                                    global.mockDbState = state;
                                    let reqPut = { onsuccess: null, onerror: null };
                                    setTimeout(() => reqPut.onsuccess && reqPut.onsuccess(), 0);
                                    return reqPut;
                                },
                                get: function(id) {
                                    let reqGet = { onsuccess: null, onerror: null };
                                    setTimeout(() => {
                                        reqGet.result = global.mockDbState;
                                        reqGet.onsuccess && reqGet.onsuccess({ target: reqGet });
                                    }, 0);
                                    return reqGet;
                                }
                            }
                        }
                    }
                }
            };
            req.onsuccess && req.onsuccess({ target: req });
        }, 0);
        return req;
    }
};

async function runTests() {
    let allPassed = true;
    console.log("Starting tests...\n");

    try {
        let w = new World();
        let dayNightChanges = 0;
        events.on('DAY_NIGHT_CHANGED', (data) => {
            dayNightChanges++;
        });

        w.update(60000); 
        assert.strictEqual(dayNightChanges, 2, "Should emit DAY_NIGHT_CHANGED twice for 60s dt");
        assert.strictEqual(w.isDay, true, "Should return to day");
        
        dayNightChanges = 0;
        w.update(120000);
        assert.strictEqual(dayNightChanges, 4, "Should emit DAY_NIGHT_CHANGED 4 times for 120s dt");
        console.log("✅ Test 1 PASS: Framerate-dependent timers dropping dt");
    } catch (e) {
        console.error("❌ Test 1 FAIL:", e.message);
        allPassed = false;
    }

    try {
        let w2 = new World();
        w2.update(5000); 
        assert.strictEqual(w2.persons.length, 1, "Agent 1 arrived");
        
        w2.update(15000); 
        assert.strictEqual(w2.persons.length, 2, "Agent 2 arrived");

        let w3 = new World();
        w3.update(20000); 
        assert.strictEqual(w3.persons.length, 2, "Both agents arrive with massive dt");
        console.log("✅ Test 2 PASS: Agent arrival logic");
    } catch (e) {
        console.error("❌ Test 2 FAIL:", e.message);
        allPassed = false;
    }

    try {
        let w4 = new World();
        w4.update(10000); // absoluteTime=10000, 1 agent
        await w4.initDB();
        await w4.saveState();

        let w5 = new World();
        await w5.initDB();
        await w5.loadState();
        
        assert.strictEqual(w5.absoluteTime, 10000, "absoluteTime should persist");
        assert.strictEqual(w5.agentsArrived, 1, "agentsArrived should persist");
        assert.strictEqual(w5.persons.length, 1, "Persons length should be 1");

        w5.update(5000);
        assert.strictEqual(w5.absoluteTime, 15000);
        assert.strictEqual(w5.agentsArrived, 2);
        assert.strictEqual(w5.persons.length, 2);
        console.log("✅ Test 3 PASS: IndexedDB timer persistence");
    } catch (e) {
        console.error("❌ Test 3 FAIL:", e.message);
        allPassed = false;
    }

    // Edge Case: Backward compatibility (loading an older save without agentsArrived)
    try {
        let w6 = new World();
        await w6.initDB();
        
        // Mock an old save state without agentsArrived and absoluteTime
        global.mockDbState = {
            id: 'world_state_1',
            time: 10000,
            isDay: true,
            persons: []
        };
        
        await w6.loadState();
        // Check if fallback works or breaks
        w6.update(6000); // Should cross 15000 if absoluteTime was restored from time, and should spawn agents
        
        // After loading, w6.agentsArrived is likely undefined.
        // update(6000) will fail to spawn agents because undefined < 2 is false.
        assert.notStrictEqual(w6.agentsArrived, undefined, "agentsArrived should not be undefined after loading old save");
        console.log("✅ Test 4 PASS: Backward compatibility for old save states");
    } catch (e) {
        console.error("❌ Test 4 FAIL:", e.message);
        allPassed = false;
    }

    if (!allPassed) {
        process.exit(1);
    }
}

runTests();
