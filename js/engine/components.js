/**
 * components.js
 * Definitions for initial ECS components.
 */

const SYLLABLES = ["ka", "ro", "li", "mi", "na", "so", "tu", "vi", "za", "el", "ar", "om", "ix", "un", "og"];
function generateName() {
    const len = Math.floor(Math.random() * 2) + 2; // 2 or 3 syllables
    let name = "";
    for(let i=0; i<len; i++) name += SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)];
    return name.charAt(0).toUpperCase() + name.slice(1);
}

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
        this.targetVx = 0;
        this.targetVy = 0;
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
    constructor(generation = 1) {
        this.name = generateName();
        this.age = 0;
        this.maxAge = 60 + Math.random() * 40; // 60 to 100 seconds
        this.energy = 100;
        this.health = 100;
        
        this.actionTimer = 0;
        this.actionTarget = null;
        
        // Genetics & Reproduction
        this.generation = 1;
        this.matingCooldown = 0;
        
        // Conscious Actions (Phase 11 Update)
        this.wantToEat = false;
    }
}



class TerrainTile {
    constructor(type = 'grass') {
        this.type = type;
    }
}

// Neural Brain for Phase 11
class NeuralBrain {
    constructor(parentModelA = null, parentModelB = null) {
        this.memory = null;
        this.compiled = false;
        
        if (parentModelA && parentModelB) {
            // Neuroevolution: Inherit and mutate
            this.model = this.crossoverAndMutate(parentModelA, parentModelB);
        } else {
            // Random initialization
            this.model = tf.sequential();
            this.model.add(tf.layers.dense({ units: 8, inputShape: [6], activation: 'relu' }));
            this.model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
            this.model.add(tf.layers.dense({ units: 3, activation: 'tanh' })); // Outputs: vx, vy, wantToEat
        }
    }
    
    crossoverAndMutate(parentA, parentB) {
        return tf.tidy(() => {
            const childModel = tf.sequential();
            childModel.add(tf.layers.dense({ units: 8, inputShape: [6], activation: 'relu' }));
            childModel.add(tf.layers.dense({ units: 8, activation: 'relu' }));
            childModel.add(tf.layers.dense({ units: 3, activation: 'tanh' }));
            
            const weightsA = parentA.getWeights();
            const weightsB = parentB.getWeights();
            const childWeights = [];
            
            for (let i = 0; i < weightsA.length; i++) {
                const shape = weightsA[i].shape;
                const flatA = weightsA[i].dataSync();
                const flatB = weightsB[i].dataSync();
                const childData = new Float32Array(flatA.length);
                
                for (let j = 0; j < flatA.length; j++) {
                    // 50% chance to take from Parent A or B
                    childData[j] = Math.random() > 0.5 ? flatA[j] : flatB[j];
                    
                    // 5% chance of mutation (Gaussian noise)
                    if (Math.random() < 0.05) {
                        // Box-Muller transform for normal distribution
                        let u = 0, v = 0;
                        while(u === 0) u = Math.random();
                        while(v === 0) v = Math.random();
                        let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
                        childData[j] += num * 0.5; // Mutation severity
                    }
                }
                childWeights.push(tf.tensor(childData, shape));
            }
            
            childModel.setWeights(childWeights);
            return childModel;
        });
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
    constructor(text = "+30", color = "#4ade80", lifetime = 1.0, isText = true) {
        this.text = text;
        this.color = color;
        this.maxLifetime = lifetime;
        this.lifetime = lifetime;
        this.isText = isText;
        this.vx = (Math.random() - 0.5) * 40;
        this.vy = (Math.random() - 0.5) * 40;
    }
}

// Export to global scope
window.Position = Position;
window.Velocity = Velocity;
window.Renderable = Renderable;
window.OrganismStats = OrganismStats;
window.NeuralBrain = NeuralBrain;
window.TerrainTile = TerrainTile;
window.Food = Food;
window.Particle = Particle;
