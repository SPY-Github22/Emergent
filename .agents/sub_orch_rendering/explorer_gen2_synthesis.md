# Iteration 2 Synthesis

## Consensus
All fixes are straightforward:
1. **Interface Contract**: In `interaction.js`, change the emitted event payload key from `targetId` to `target`.
2. **Visual Obscuration**: In `renderer.js`, draw the radial menu slices as true donut sectors.
   ```javascript
   this.ctx.beginPath();
   this.ctx.arc(x, y, radius, startAngle, endAngle, false);
   this.ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
   this.ctx.closePath();
   ```
   Remove the code that draws the solid background circle in the center.
3. **Z-Index Picking**: In `interaction.js`, iterate `this.world.persons` in reverse order for hit detection:
   ```javascript
   for (let i = this.world.persons.length - 1; i >= 0; i--) {
       const person = this.world.persons[i];
       // ... hit detection ...
   }
   ```

## Actionable Strategy
Provide this synthesis to the Worker to edit `renderer.js` and `interaction.js`.
