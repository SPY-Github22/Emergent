class Person {
    constructor(id, x, y) {
        this.id = id;
        this.position = { x, y };
        this.direction = { x: 0, y: 0 }; // Direction vector
        
        this.hunger = 0;    // 0 to 100
        this.social = 100;  // 100 to 0
    }

    /**
     * Update agent state over time.
     * @param {number} dt Delta time in milliseconds
     */
    update(dt) {
        // Simulate stat drift
        this.hunger = Math.min(100, this.hunger + dt * 0.005);
        this.social = Math.max(0, this.social - dt * 0.002);
    }

    /**
     * Get a snapshot of the current state.
     */
    getState() {
        return {
            id: this.id,
            position: { ...this.position },
            direction: { ...this.direction },
            hunger: this.hunger,
            social: this.social
        };
    }
    
    /**
     * Serialize the agent state.
     */
    serialize() {
        return JSON.stringify(this.getState());
    }
}
