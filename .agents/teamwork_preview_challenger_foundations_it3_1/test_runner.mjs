import { World } from '../../js/world.js';
import { Person } from '../../js/person.js';

async function runTests() {
    console.log("Running tests...");
    
    // Test 1: update(20000)
    const world1 = new World();
    world1.update(20000);
    const agent2 = world1.persons[1];
    if (agent2 && agent2.hunger === 25) {
        console.log("PASS: agent 2 hunger is 25");
    } else {
        console.log("FAIL: agent 2 hunger is", agent2 ? agent2.hunger : 'undefined');
    }

    // Test 2: loadState sets agentsArrived to 1
    const world2 = new World();
    
    // Mock IndexedDB
    world2.db = {
        transaction: () => ({
            objectStore: () => ({
                get: () => {
                    const req = {};
                    setTimeout(() => {
                        req.onsuccess({ target: { result: { time: 1000, persons: [{ id: 'p1', position: {x:0, y:0}, direction: {x:0, y:0}, hunger: 0, social: 100 }] } } });
                    }, 10);
                    return req;
                }
            })
        })
    };
    world2.storeName = 'test';

    await world2.loadState();
    if (world2.agentsArrived === 1) {
        console.log("PASS: agentsArrived is 1");
    } else {
        console.log("FAIL: agentsArrived is", world2.agentsArrived);
    }
}

runTests().catch(console.error);
