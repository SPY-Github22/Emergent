/**
 * components.js
 * Definitions for initial ECS components.
 */

class Position {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}

class Velocity {
    constructor(vx = 0, vy = 0) {
        this.vx = vx;
        this.vy = vy;
    }
}

class Renderable {
    constructor(color = '#FFFFFF', radius = 5) {
        this.color = color;
        this.radius = radius;
    }
}

class OrganismStats {
    constructor(energy = 100, health = 100) {
        this.energy = energy;
        this.health = health;
        this.age = 0;
    }
}

class NeuralBrain {
    constructor(network = null) {
        // Can hold a neural network instance or its configuration
        this.network = network; 
        
        // Caching inputs/outputs arrays to avoid GC
        this.inputs = [];
        this.outputs = [];
    }
}

class TerrainTile {
    constructor(type = 'grass') {
        this.type = type;
    }
}

// Export to global scope
window.Position = Position;
window.Velocity = Velocity;
window.Renderable = Renderable;
window.OrganismStats = OrganismStats;
window.NeuralBrain = NeuralBrain;
window.TerrainTile = TerrainTile;
