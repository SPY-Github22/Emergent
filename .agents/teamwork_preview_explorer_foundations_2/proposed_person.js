/**
 * person.js
 * Agent representation.
 */

export class Person {
    constructor(id, x, y) {
        this.id = id;
        this.position = { x, y };
        this.direction = 0; // Angle in radians
        
        // Agent state exposed to the neural network
        this.state = {
            hunger: 0,   // 0 (full) to 100 (starving)
            social: 100  // 0 (lonely) to 100 (fulfilled)
        };
        
        // Placeholder for fully illustrated visual asset management
        this.visuals = {
            type: 'illustrated',
            assetId: `agent_${id}_asset`
        };
    }

    /**
     * Update agent state over time.
     * @param {number} dt Delta time in milliseconds
     */
    update(dt) {
        // Simple state changes over time
        this.state.hunger = Math.min(100, this.state.hunger + dt * 0.005);
        this.state.social = Math.max(0, this.state.social - dt * 0.002);
    }

    /**
     * Get a snapshot of the current state for the NN or saving.
     */
    getStateSnapshot() {
        return {
            id: this.id,
            x: this.position.x,
            y: this.position.y,
            direction: this.direction,
            hunger: this.state.hunger,
            social: this.state.social
        };
    }
    
    /**
     * Load state from a snapshot (e.g. from IndexedDB)
     */
    loadStateSnapshot(snapshot) {
        this.position.x = snapshot.x;
        this.position.y = snapshot.y;
        this.direction = snapshot.direction;
        this.state.hunger = snapshot.hunger;
        this.state.social = snapshot.social;
    }
}
