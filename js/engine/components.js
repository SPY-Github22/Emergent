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
    constructor(color = '#ffffff', radius = 10) {
        this.color = color;
        this.radius = radius;
        this.shape = Math.floor(Math.random() * 3); // 0, 1, or 2
    }
}

class OrganismStats {
    constructor() {
        this.age = 0;
        this.maxAge = 60 + Math.random() * 40; // 60 to 100 seconds
        this.energy = 100;
        this.health = 100;
        
        this.actionTimer = 0;
        this.actionTarget = null;
        
        // Genetics & Reproduction (Phase 10)
        this.generation = 1;
        this.matingCooldown = 0;
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

class Path {
    constructor() {
        this.waypoints = [];
        this.currentWaypointIndex = 0;
    }
}

class Food {
    constructor(energyValue = 15, capacity = 3) {
        this.energyValue = energyValue;
        this.capacity = capacity;
        this.maxCapacity = capacity;
    }
}

class Particle {
    constructor(text = "+30", color = "#4ade80", lifetime = 1.0) {
        this.text = text;
        this.color = color;
        this.maxLifetime = lifetime;
        this.lifetime = lifetime;
    }
}

// Export to global scope
window.Position = Position;
window.Velocity = Velocity;
window.Renderable = Renderable;
window.OrganismStats = OrganismStats;
window.NeuralBrain = NeuralBrain;
window.TerrainTile = TerrainTile;
window.Path = Path;
window.Food = Food;
window.Particle = Particle;
