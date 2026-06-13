# Explorer Synthesis - Hitbox Stealing Bug

## Consensus
All Explorers agree that the "hitbox stealing bug" in `interaction.js` is caused by a greedy search that accepts any agent within 25 pixels, prioritizing Z-order even when one agent is clicked directly but has a lower Z-order. 

The fix involves distinguishing between a "direct hit" (within the visual radius of 12) and a "proximity hit" (within the click radius of 25).

## Fix Strategy
1. Initialize `bestAgent = null` and `minDistance = Infinity`.
2. Iterate backwards over `world.persons`.
3. If `dist <= 12`, it's a direct hit. Since iteration is backwards, this respects Z-order for direct hits. Set `bestAgent = person` and immediately `break`.
4. If `12 < dist <= 25`, it's a proximity hit. Check if `dist < minDistance`. If so, update `minDistance = dist` and `bestAgent = person`.
5. After the loop, if `bestAgent` is found, open the menu for `bestAgent`.

This ensures direct visual hits are prioritized, and for proximity hits, the closest agent is selected.
