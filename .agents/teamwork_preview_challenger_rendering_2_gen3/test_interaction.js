// test_interaction.js

function simulateClick(persons, clickPos) {
    const clickRadius = 25;
    const visualRadius = 12;
    let bestAgent = null;
    let minDistance = Infinity;

    for (let i = persons.length - 1; i >= 0; i--) {
        const person = persons[i];
        const dx = clickPos.x - person.position.x;
        const dy = clickPos.y - person.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= visualRadius) {
            // Direct hit, respect Z-order
            bestAgent = person;
            break;
        } else if (dist <= clickRadius) {
            // Proximity hit, find closest
            if (dist < minDistance) {
                minDistance = dist;
                bestAgent = person;
            }
        }
    }
    return bestAgent;
}

const tests = [
    {
        name: "Direct hits respect Z-order (Top wins)",
        persons: [
            { id: 1, position: { x: 10, y: 10 } }, // Bottom, direct hit (dist 0)
            { id: 2, position: { x: 12, y: 10 } }  // Top, direct hit (dist 2)
        ],
        clickPos: { x: 10, y: 10 },
        expectedId: 2
    },
    {
        name: "Proximity hits pick the closest agent",
        persons: [
            { id: 1, position: { x: 25, y: 10 } }, // Bottom, dist 15
            { id: 2, position: { x: 30, y: 10 } }  // Top, dist 20
        ],
        clickPos: { x: 10, y: 10 },
        expectedId: 1
    },
    {
        name: "Direct hit overrides earlier proximity hit (Top proximity vs Bottom direct)",
        persons: [
            { id: 1, position: { x: 20, y: 10 } }, // Bottom, direct hit (dist 10)
            { id: 2, position: { x: 25, y: 10 } }  // Top, proximity hit (dist 15)
        ],
        clickPos: { x: 10, y: 10 },
        expectedId: 1
    },
    {
        name: "Proximity hit ignores even closer direct hit? No, direct hit always wins",
        persons: [
            { id: 1, position: { x: 25, y: 10 } }, // Bottom, proximity hit (dist 15)
            { id: 2, position: { x: 20, y: 10 } }  // Top, direct hit (dist 10)
        ],
        clickPos: { x: 10, y: 10 },
        expectedId: 2
    },
    {
        name: "Only proximity hits, equal distance, top wins",
        persons: [
            { id: 1, position: { x: 25, y: 10 } }, // Bottom, dist 15
            { id: 2, position: { x: -5, y: 10 } }  // Top, dist 15
        ],
        clickPos: { x: 10, y: 10 },
        expectedId: 2
    }
];

let failed = false;
for (const test of tests) {
    const result = simulateClick(test.persons, test.clickPos);
    const resultId = result ? result.id : null;
    if (resultId !== test.expectedId) {
        console.error(`❌ Test failed: ${test.name}`);
        console.error(`   Expected ID: ${test.expectedId}, got: ${resultId}`);
        failed = true;
    } else {
        console.log(`✅ Test passed: ${test.name}`);
    }
}

if (failed) {
    process.exit(1);
} else {
    console.log("All tests passed.");
}
