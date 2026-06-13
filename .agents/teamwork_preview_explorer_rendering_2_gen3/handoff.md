# Handoff Report: Hitbox Stealing Bug in interaction.js

## Observation

1. **Visual Radius**: `renderer.js` draws agents with a fixed radius of `12` pixels.
   * `renderer.js:29`: `this.ctx.arc(x, y, 12, 0, Math.PI * 2);`
2. **Current Interaction Logic**: `interaction.js` checks for clicks using a radius of `25` pixels and breaks on the *first* matching agent while iterating backwards through the `world.persons` array.
   * `interaction.js:67`: `const clickRadius = 25;`
   * `interaction.js:68-83`:
     ```javascript
     for (let i = this.world.persons.length - 1; i >= 0; i--) {
         // ... calculate dist ...
         if (dist <= clickRadius) {
             // Open menu for this agent
             // ...
             break; // Only open for the first agent found
         }
     }
     ```

## Logic Chain

1. Because `interaction.js` iterates backwards, it inherently prioritizes agents with a higher Z-order (drawn last/on top).
2. However, because it accepts *any* agent within `25` pixels, an agent that is barely within the click area (e.g., 24px away, visually not clicked) but has a higher Z-order will "steal" the click from an agent that was clicked directly (e.g., 2px away) but has a lower Z-order.
3. The specification requires prioritizing direct visual hits (distance `<= 12`) and falling back to the closest agent within the `clickRadius` (`<= 25`).
4. To fix this, the agent search loop must be modified to differentiate between a "direct hit" (`dist <= 12`) and a "proximity hit" (`dist <= 25`).
5. **Fix Strategy**:
   - Initialize variables to track the best match (`bestAgent = null`, `minDistance = Infinity`).
   - Iterate backwards over `world.persons`.
   - If `dist <= 12`, we have a direct hit. Since we are going backwards, this is the top-most direct hit. Set `bestAgent = person` and immediately `break`.
   - If `12 < dist <= 25`, check if `dist < minDistance`. If so, update `minDistance = dist` and `bestAgent = person`.
   - After the loop, if `bestAgent` is not null, open the menu for `bestAgent`.

## Caveats

- We assume that `visualRadius` can be hardcoded as `12` in `interaction.js` to match the hardcoded `12` in `renderer.js`. If agent sizes become dynamic later, this value will need to be passed down or read from the agent state.
- "Prioritize closest" for proximity hits means that Z-order is ignored if neither agent is directly clicked; distance becomes the sole tiebreaker. This matches the requested fix.

## Conclusion

The bug is caused by a greedy Z-order check that treats the entire 25px fuzzy click area equally. 

**Proposed Code Change (`interaction.js:66-84`):**
```javascript
            // Check if user clicked on an agent to open the menu
            const clickRadius = 25; // Fuzzy clicking area
            const visualRadius = 12; // Actual drawn radius
            
            let bestAgent = null;
            let minDistance = Infinity;

            for (let i = this.world.persons.length - 1; i >= 0; i--) {
                const person = this.world.persons[i];
                const dx = pos.x - person.position.x;
                const dy = pos.y - person.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= visualRadius) {
                    // Direct visual hit! Prioritize Z-order by breaking immediately.
                    bestAgent = person;
                    break;
                } else if (dist <= clickRadius && dist < minDistance) {
                    // Proximity hit. Keep track of the closest one.
                    minDistance = dist;
                    bestAgent = person;
                }
            }

            if (bestAgent) {
                // Open menu for this agent
                menu.isOpen = true;
                menu.x = bestAgent.position.x;
                menu.y = bestAgent.position.y;
                menu.targetId = bestAgent.id;
                menu.hoveredIndex = -1;
            }
```

## Verification Method

1. Apply the proposed change to `interaction.js`.
2. Spawn two overlapping agents in `world.persons` where Agent A is at index 0 and Agent B is at index 1. Place them 15 pixels apart.
3. Click exactly on Agent A's center.
   - **Expectation**: Agent A is selected because `dist <= 12` triggers a direct hit break, ignoring Agent B which is 15px away (proximity hit).
4. Click exactly between them, but slightly closer to Agent A (e.g., dist to A is 16, dist to B is 20).
   - **Expectation**: Agent A is selected because it is the closest proximity hit, even though B has a higher Z-order.
