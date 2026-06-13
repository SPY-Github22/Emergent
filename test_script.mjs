import { World } from './js/world.js';

async function run() {
    const world = new World();
    world.update(20000);
    
    console.log(`Agent 1 hunger: ${world.persons[0].hunger}`); // Should be 15000 * 0.005 = 75
    console.log(`Agent 2 hunger: ${world.persons[1].hunger}`); // Should be 5000 * 0.005 = 25
    
    const world2 = new World();
    // Test loadState sets agentsArrived properly
    // Mock IndexedDB
    const fakeState = {
        time: 1000,
        absoluteTime: 1000,
        isDay: true,
        persons: [{
            id: 'agent_1',
            position: {x: 0, y: 0},
            direction: {x: 0, y: 0},
            hunger: 10,
            social: 90
        }]
    };
    
    // We can't easily test IndexedDB in Node, but we can see the code logic:
    // this.agentsArrived = state.agentsArrived ?? (state.persons ? state.persons.length : 0);
    
    // Let's create a dummy DB logic just to pass the loadState internally
    world2.db = {
        transaction: () => ({
            objectStore: () => ({
                get: () => {
                    const req = {};
                    setTimeout(() => {
                        req.result = fakeState;
                        if (req.onsuccess) req.onsuccess({ target: req });
                    }, 10);
                    return req;
                }
            })
        })
    };
    
    await world2.loadState();
    console.log(`agentsArrived after load: ${world2.agentsArrived}`); // Should be 1
}

run().catch(console.error);
