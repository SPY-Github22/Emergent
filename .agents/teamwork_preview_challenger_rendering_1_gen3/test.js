const clickRadius = 25;
const visualRadius = 12;

function testClick(persons, clickPos) {
    let bestAgent = null;
    let minDistance = Infinity;

    for (let i = persons.length - 1; i >= 0; i--) {
        const person = persons[i];
        const dx = clickPos.x - person.position.x;
        const dy = clickPos.y - person.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist <= visualRadius) {
            bestAgent = person;
            break;
        } else if (dist <= clickRadius) {
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
        name: "Direct hit respects Z-order (top picked)",
        persons: [
            { id: 1, position: {x: 0, y: 0} }, // bottom
            { id: 2, position: {x: 5, y: 0} }, // top
        ],
        click: {x: 2.5, y: 0},
        expectedId: 2
    },
    {
        name: "Proximity hit picks closest",
        persons: [
            { id: 1, position: {x: 0, y: 0} }, // bottom, dist 15
            { id: 2, position: {x: 30, y: 0} }, // top, dist 15
        ],
        click: {x: 15, y: 0},
        expectedId: 2 // equal distance, top picked
    },
    {
        name: "Proximity hit picks closest (bottom is closer)",
        persons: [
            { id: 1, position: {x: 0, y: 0} }, // bottom, dist 14
            { id: 2, position: {x: 30, y: 0} }, // top, dist 16
        ],
        click: {x: 14, y: 0},
        expectedId: 1
    },
    {
        name: "Direct hit overrides earlier proximity hit",
        persons: [
            { id: 1, position: {x: 0, y: 0} }, // bottom, dist 10 (direct)
            { id: 2, position: {x: 20, y: 0} }, // top, dist 20 (proximity)
        ],
        click: {x: 0, y: 0}, // distance to 1 is 0, to 2 is 20
        expectedId: 1
    }
];

let failed = false;
for (const t of tests) {
    const result = testClick(t.persons, t.click);
    if ((result ? result.id : null) !== t.expectedId) {
        console.error(`Test failed: ${t.name}. Expected ${t.expectedId}, got ${result ? result.id : null}`);
        failed = true;
    }
}

if (!failed) {
    console.log("All tests passed.");
}
