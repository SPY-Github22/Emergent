/**
 * game.js
 * Bootstraps the ECS and Isometric Renderer to verify Phase 1 & 2.
 */

'use strict';

// Globals
let world, renderer, isoMath, terrain, astar;
let lastTime = performance.now();
let frameCount = 0;
let lastFpsTime = performance.now();
let selectedEntityId = null;

// Handles Time & Environment (Phase 5)
class TimeSystem extends System {
    update(world, dt) {
        // 1 full day = 60 seconds of real time
        world.time += dt / 60.0;
        if (world.time >= 1.0) world.time = 0;
        
        // Update UI Clock
        const hours = Math.floor(world.time * 24);
        const mins = Math.floor((world.time * 24 * 60) % 60);
        const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        
        let timeEl = document.getElementById('world-clock');
        if (!timeEl) {
            timeEl = document.createElement('span');
            timeEl.id = 'world-clock';
            document.getElementById('stats-pill').appendChild(timeEl);
        }
        timeEl.innerHTML = ` | Time: <span>${timeStr}</span>`;
    }
}

// Biology System: Handles Energy, Health, and Aging (Phases 6 & 7)
class BiologySystem extends System {
    update(world, dt) {
        const entities = world.query([OrganismStats], this.queryResults);
        
        for (const entityId of entities) {
            const stats = world.getComponent(entityId, OrganismStats);
            
            // Action Timer (Phase 9 tweaks)
            if (stats.actionTimer > 0) {
                stats.actionTimer -= dt;
                
                // If we are eating something, but it was destroyed by another agent, abort!
                if (stats.actionTarget !== null && world.getComponent(stats.actionTarget, Position) === undefined) {
                    stats.actionTimer = 0;
                    stats.actionTarget = null;
                }
            }
            
            // Aging
            stats.age += dt;
            
            // Energy depletion (burn 5 energy per second)
            stats.energy -= 5 * dt;
            
            // Starvation: if no energy, lose health
            if (stats.energy <= 0) {
                stats.energy = 0;
                stats.health -= 2 * dt;
            } else if (stats.energy > 50 && stats.health < 100) {
                // Natural healing if well fed
                stats.health += 1 * dt;
            }
            
            // Death condition
            if (stats.health <= 0 || stats.age >= stats.maxAge) {
                if (selectedEntityId === entityId) {
                    selectedEntityId = null;
                    document.getElementById('inspector-panel').classList.remove('active');
                }
                const brain = world.getComponent(entityId, NeuralBrain);
                if (brain && brain.model) {
                    brain.model.dispose(); // Prevent Memory Leak
                }
                world.destroyEntity(entityId);
            }
        }
        
        // Extinction Failsafe
        // If the population crashes because Generation 1 is too stupid to eat,
        // we inject fresh randomized agents to keep evolution going!
        let aliveCount = world.query([OrganismStats], []).length;
        if (aliveCount < 5) {
            console.log("Extinction Failsafe! Spawning 5 new random agents...");
            for (let i = 0; i < 5; i++) {
                spawnAgent();
            }
        }
    }
}

// Interaction System: Updates the UI Inspector (Phase 9)
class InteractionSystem extends System {
    update(world, dt) {
        const panel = document.getElementById('inspector-panel');
        if (selectedEntityId === null) {
            panel.classList.remove('active');
            return;
        }

        const pos = world.getComponent(selectedEntityId, Position);
        if (!pos) return;

        const isFood = world.getComponent(selectedEntityId, Food);
        const stats = world.getComponent(selectedEntityId, OrganismStats);

        if (!stats && !isFood) {
            panel.classList.remove('active');
            return;
        }

        panel.classList.add('active');

        if (stats) {
            document.querySelector('.insp-header h3').textContent = `Agent (Gen ${stats.generation})`;
            document.getElementById('insp-age').textContent = `Age: ${Math.floor(stats.age)}`;
            document.getElementById('insp-health').parentElement.parentElement.style.display = 'block';
            document.getElementById('insp-health').style.width = `${Math.max(0, stats.health)}%`;
            document.getElementById('insp-energy').parentElement.parentElement.style.display = 'block';
            document.getElementById('insp-energy').style.width = `${Math.max(0, stats.energy)}%`;
        } else if (isFood) {
            document.querySelector('.insp-header h3').textContent = 'Resource: Food';
            document.getElementById('insp-age').textContent = `+${isFood.energyValue} Energy`;
            document.getElementById('insp-health').parentElement.parentElement.style.display = 'none';
            document.getElementById('insp-energy').parentElement.parentElement.style.display = 'none';
        }
        
        // Dynamic diegetic positioning (follow entity on screen)
        // Convert world pos to screen pos
        const screenPos = renderer.isoMath.worldToScreen(pos.x, pos.y, 0);
        
        // Apply camera transforms
        const centerX = renderer.canvas.width / 2;
        const centerY = renderer.canvas.height / 2;
        
        let x = (screenPos.x - renderer.camera.x) * renderer.camera.zoom + centerX;
        let y = (screenPos.y - renderer.camera.y) * renderer.camera.zoom + centerY;
        
        // Offset panel to sit next to the entity
        panel.style.left = `${x + 30}px`;
        panel.style.top = `${y - 100}px`;
    }
}

// Foraging System: Agents look for food and eat it (Phase 9)
class ForagingSystem extends System {
    update(world, dt) {
        const agents = world.query([Position, OrganismStats, Velocity], this.queryResults);
        // Use a separate array for food to not clobber queryResults
        const allFoods = world.query([Position, Food], []);
        
        for (const agentId of agents) {
            const stats = world.getComponent(agentId, OrganismStats);
            const pos = world.getComponent(agentId, Position);
            const vel = world.getComponent(agentId, Velocity);
            
            // Only eat if hungry, food exists, AND the Brain specifically chose to activate its mouth!
            if (stats.energy < 80 && allFoods.length > 0 && stats.wantToEat) {
                let closestFoodId = null;
                let closestDist = Infinity;
                
                // Find closest food
                for (const foodId of allFoods) {
                    const foodPos = world.getComponent(foodId, Position);
                    const dist = Math.hypot(foodPos.x - pos.x, foodPos.y - pos.y);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestFoodId = foodId;
                    }
                }
                
                if (closestFoodId !== null) {
                    const foodPos = world.getComponent(closestFoodId, Position);
                    
                    // If we reached the food, eat it (Takes 2 seconds)
                    if (closestDist < 1.0) {
                        // Check if we are already eating
                        if (stats.actionTimer <= 0 && stats.actionTarget !== closestFoodId) {
                            stats.actionTimer = 2.0; // Stop and eat for 2 seconds
                            stats.actionTarget = closestFoodId;
                        } else if (stats.actionTimer <= 0 && stats.actionTarget === closestFoodId) {
                            // Timer finished! Consume!
                            const food = world.getComponent(closestFoodId, Food);
                            const foodRend = world.getComponent(closestFoodId, Renderable);
                            
                            if (food) {
                                // Spawn floating text particle
                                const particleId = world.createEntity();
                                world.addComponent(particleId, new Position(foodPos.x, foodPos.y));
                                world.addComponent(particleId, new Particle(`+${food.energyValue}`, '#4ade80', 1.5));

                                stats.energy = Math.min(100, stats.energy + food.energyValue);
                                
                                food.capacity -= 1;
                                
                                if (food.capacity <= 0) {
                                    world.destroyEntity(closestFoodId); // Consume fully
                                    // Remove from local array so others don't target it
                                    const index = allFoods.indexOf(closestFoodId);
                                    if (index > -1) allFoods.splice(index, 1);
                                } else if (foodRend) {
                                    // Visually shrink the food
                                    foodRend.radius = 4 + (food.capacity / food.maxCapacity) * 4;
                                }
                            }
                            stats.actionTarget = null;
                        }
                    } else {
                        // Option B: No pathfinding! Brain handles movement.
                    }
                }
            }
        }
    }
}

// Brain System (Phase 11: Option B)
class BrainSystem extends System {
    update(world, dt) {
        const agents = world.query([Position, Velocity, OrganismStats, NeuralBrain], this.queryResults);
        const allFoods = world.query([Position, Food], []);
        
        // Batch predictions for performance
        // But for simplicity in JS without proper batching setup, we'll do individual predictions
        // tf.tidy is crucial here to prevent memory leaks!
        
        for (const entityId of agents) {
            const pos = world.getComponent(entityId, Position);
            const vel = world.getComponent(entityId, Velocity);
            const stats = world.getComponent(entityId, OrganismStats);
            const brain = world.getComponent(entityId, NeuralBrain);
            
            // If busy, don't think
            if (stats.actionTimer > 0) continue;
            
            // Limit thinking to 4 times a second (0.25s) to prevent FPS lag!
            if (stats.thinkTimer === undefined) stats.thinkTimer = Math.random() * 0.25;
            stats.thinkTimer -= dt;
            if (stats.thinkTimer > 0) continue;
            stats.thinkTimer = 0.25;
                
                // Find nearest food
                let dxFood = 0, dyFood = 0, distFood = 100;
                if (allFoods.length > 0) {
                    let closestFoodDistSq = Infinity;
                    let closestFoodId = null;
                    for (const foodId of allFoods) {
                        const fPos = world.getComponent(foodId, Position);
                        const dSq = Math.pow(fPos.x - pos.x, 2) + Math.pow(fPos.y - pos.y, 2);
                        if (dSq < closestFoodDistSq) {
                            closestFoodDistSq = dSq;
                            closestFoodId = foodId;
                        }
                    }
                    if (closestFoodId !== null) {
                        const fPos = world.getComponent(closestFoodId, Position);
                        distFood = Math.sqrt(closestFoodDistSq);
                        if (distFood > 10.0) { // SIGHT RADIUS
                            distFood = 10.0;
                            dxFood = 0;
                            dyFood = 0;
                        } else if (distFood > 0) {
                            dxFood = (fPos.x - pos.x) / distFood; // Normalized direction
                            dyFood = (fPos.y - pos.y) / distFood;
                        }
                        // Normalize distance roughly 0 to 1 (max 10 tiles)
                        distFood = Math.min(1.0, distFood / 10.0); 
                    }
                }
                
                // Find nearest mate (other agent)
                let dxMate = 0, dyMate = 0, distMate = 1;
                let closestMateDistSq = Infinity;
                for (const otherId of agents) {
                    if (otherId === entityId) continue;
                    const oStats = world.getComponent(otherId, OrganismStats);
                    if (oStats.age > 5 && oStats.energy > 60 && oStats.matingCooldown <= 0) {
                        const oPos = world.getComponent(otherId, Position);
                        const dSq = Math.pow(oPos.x - pos.x, 2) + Math.pow(oPos.y - pos.y, 2);
                        if (dSq < closestMateDistSq) {
                            closestMateDistSq = dSq;
                            dxMate = oPos.x - pos.x;
                            dyMate = oPos.y - pos.y;
                        }
                    }
                }
                if (closestMateDistSq !== Infinity) {
                    const d = Math.sqrt(closestMateDistSq);
                    if (d > 10.0) { // SIGHT RADIUS
                        distMate = 1.0;
                        dxMate = 0;
                        dyMate = 0;
                    } else if (d > 0) {
                        dxMate /= d;
                        dyMate /= d;
                        distMate = Math.min(1.0, d / 10.0);
                    }
                }
                
                tf.tidy(() => {
                    const inputArray = [
                        dxFood, dyFood, dxMate, dyMate,
                        stats.energy / 100.0,
                        Math.min(1.0, stats.age / stats.maxAge)
                    ];
                    const inputs = tf.tensor2d([inputArray]);
                    
                    // Predict
                    const output = brain.model.predict(inputs);
                    const data = output.dataSync();
                    
                    // Short Term Memory for RL
                    brain.memory = {
                        inputs: inputArray,
                        outputs: Array.from(data)
                    };
                    
                    // Output gives target velocity in range -1 to 1 (tanh)
                    const speed = 2.0;
                    vel.targetVx = data[0] * speed;
                    vel.targetVy = data[1] * speed;
                    
                    // Output 3 is mouth activation. > 0 means trying to eat.
                    stats.wantToEat = data[2] > 0;
                });
            }
    }
}

/// Movement System (Phase 11 Option B: Pure Muscle)
class MovementSystem extends System {
    update(world, dt) {
        const entities = world.query([Position, Velocity, OrganismStats], this.queryResults);
        
        for (const entityId of entities) {
            const pos = world.getComponent(entityId, Position);
            const vel = world.getComponent(entityId, Velocity);
            const stats = world.getComponent(entityId, OrganismStats);
            
            // If they are busy eating or doing an action, DO NOT move.
            if (stats && stats.actionTimer > 0) {
                vel.vx = 0;
                vel.vy = 0;
                vel.targetVx = 0;
                vel.targetVy = 0;
                continue;
            }
            
            // Momentum (Lerp velocity towards target)
            vel.vx += (vel.targetVx - vel.vx) * 5.0 * dt;
            vel.vy += (vel.targetVy - vel.vy) * 5.0 * dt;
            
            // Apply neural network velocity
            let nextX = pos.x + vel.vx * dt;
            let nextY = pos.y + vel.vy * dt;
            
            // Obstacle handling: The brain has to learn! 
            // If they hit water, they just stop moving. No magical wall sliding!
            if (astar && !astar._isWalkable(Math.round(nextX), Math.round(nextY))) {
                vel.vx = 0;
                vel.vy = 0;
                // Penalize energy for walking into walls? (Optional)
                // stats.energy -= 0.1; 
            } else {
                pos.x = nextX;
                pos.y = nextY;
            }
            
            // Boundary enforcement
            if (pos.x > 14) { pos.x = 14; vel.vx = 0; }
            if (pos.x < -14) { pos.x = -14; vel.vx = 0; }
            if (pos.y > 14) { pos.y = 14; vel.vy = 0; }
            if (pos.y < -14) { pos.y = -14; vel.vy = 0; }
        }
    }
}

// Reproduction System (Phase 10)
class ReproductionSystem extends System {
    update(world, dt) {
        const agents = world.query([Position, OrganismStats, Renderable], this.queryResults);
        
        // Tick down cooldowns
        for (const entityId of agents) {
            const stats = world.getComponent(entityId, OrganismStats);
            if (stats.matingCooldown > 0) {
                stats.matingCooldown -= dt;
            }
        }
        
        // Find mates
        for (let i = 0; i < agents.length; i++) {
            const idA = agents[i];
            const statsA = world.getComponent(idA, OrganismStats);
            
            if (statsA.age < 5 || statsA.energy < 60 || statsA.matingCooldown > 0) continue;
            
            const posA = world.getComponent(idA, Position);
            
            for (let j = i + 1; j < agents.length; j++) {
                const idB = agents[j];
                const statsB = world.getComponent(idB, OrganismStats);
                
                if (statsB.age < 5 || statsB.energy < 60 || statsB.matingCooldown > 0) continue;
                
                const posB = world.getComponent(idB, Position);
                const distSq = Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2);
                
                // Mating occurs if within 1 tile!
                if (distSq < 1.0) {
                    // Mating costs 30 energy and triggers a 10s cooldown
                    statsA.energy -= 30;
                    statsB.energy -= 30;
                    statsA.matingCooldown = 10;
                    statsB.matingCooldown = 10;
                    
                    // Spawn Heart Particles
                    const partA = world.createEntity();
                    world.addComponent(partA, new Position(posA.x, posA.y));
                    world.addComponent(partA, new Particle('♥', '#ff69b4', 2.0));
                    
                    const partB = world.createEntity();
                    world.addComponent(partB, new Position(posB.x, posB.y));
                    world.addComponent(partB, new Particle('♥', '#ff69b4', 2.0));
                    
                    // Spawn offspring!
                    spawnOffspring(idA, idB, (posA.x + posB.x) / 2, (posA.y + posB.y) / 2);
                    
                    break; // A only mates once per frame
                }
            }
        }
    }
}

// Particle System for floating VFX
class ParticleSystem extends System {
    update(world, dt) {
        const particles = world.query([Position, Particle], this.queryResults);
        for (const entityId of particles) {
            const part = world.getComponent(entityId, Particle);
            part.lifetime -= dt;
            if (part.lifetime <= 0) {
                world.destroyEntity(entityId);
            }
        }
    }
}

// Render System bridges ECS and Renderer
class RenderSystem extends System {
    constructor(renderer) {
        super();
        this.renderer = renderer;
    }

    update(world, dt) {
        this.renderer.clearEntities();
        
        // 1. Render Terrain Tiles
        const terrainEntities = world.query([Position, TerrainTile, {name: 'IsometricBlock'}], this.queryResults);
        for (const entityId of terrainEntities) {
            const pos = world.getComponent(entityId, Position);
            const block = world.getComponent(entityId, {name: 'IsometricBlock'});
            
            this.renderer.addEntity({
                worldX: pos.x,
                worldY: pos.y,
                worldZ: block.worldZ,
                draw: block.draw
            });
        }

        // 2. Render Dynamic Agents
        const agentEntities = world.query([Position, Renderable], this.queryResults);
        document.getElementById('entity-count').textContent = terrainEntities.length + agentEntities.length;
        
        for (const entityId of agentEntities) {
            const pos = world.getComponent(entityId, Position);
            const rend = world.getComponent(entityId, Renderable);
            
            // Smoothly interpolate terrain height for Z-sorting and rendering
            let zOffset = 0;
            if (astar) {
                const x0 = Math.floor(pos.x);
                const y0 = Math.floor(pos.y);
                const x1 = x0 + 1;
                const y1 = y0 + 1;

                const tx = pos.x - x0;
                const ty = pos.y - y0;

                const z00 = astar._getTile(x0, y0)?.worldZ || 0;
                const z10 = astar._getTile(x1, y0)?.worldZ || 0;
                const z01 = astar._getTile(x0, y1)?.worldZ || 0;
                const z11 = astar._getTile(x1, y1)?.worldZ || 0;

                // Bilinear interpolation
                const z0 = z00 * (1 - tx) + z10 * tx;
                const z1 = z01 * (1 - tx) + z11 * tx;
                zOffset = z0 * (1 - ty) + z1 * ty;
            }
            
            // Push to renderer
            this.renderer.addEntity({
                worldX: pos.x,
                worldY: pos.y,
                worldZ: zOffset + 0.1, // Float slightly above terrain tile
                draw: (ctx) => {
                    ctx.beginPath();
                    
                    // Highlight if selected
                    if (entityId === selectedEntityId) {
                        ctx.beginPath();
                        ctx.ellipse(0, 5, rend.radius * 1.5, rend.radius * 0.75, 0, 0, Math.PI * 2);
                        ctx.strokeStyle = '#000000'; // Black selection ring
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        
                        // Small bounce animation for selection
                        const bounce = Math.sin(performance.now() / 150) * 5;
                        ctx.translate(0, bounce - 5);
                    }

                    // Reset path for the main entity shape so it doesn't color the selection ring!
                    ctx.beginPath();

                    // Draw different shapes
                    const shapeType = rend.shape;

                    if (shapeType === 'food') {
                        // Draw a diamond
                        ctx.moveTo(0, -rend.radius);
                        ctx.lineTo(rend.radius, 0);
                        ctx.lineTo(0, rend.radius);
                        ctx.lineTo(-rend.radius, 0);
                        ctx.closePath();
                    } else if (shapeType === 0) {
                        // Prism
                        ctx.ellipse(0, 0, rend.radius, rend.radius * 0.5, 0, 0, Math.PI * 2);
                        ctx.fillStyle = rend.color;
                        ctx.fill();
                        ctx.beginPath();
                        ctx.moveTo(-rend.radius, 0);
                        ctx.lineTo(-rend.radius, -rend.radius * 2);
                        ctx.lineTo(0, -rend.radius * 2.5);
                        ctx.lineTo(rend.radius, -rend.radius * 2);
                        ctx.lineTo(rend.radius, 0);
                        ctx.lineTo(0, rend.radius * 0.5);
                        ctx.closePath();
                    } else if (shapeType === 1) {
                        // Sphere-like
                        ctx.arc(0, -rend.radius, rend.radius, 0, Math.PI * 2);
                    } else {
                        // Pyramid-like
                        ctx.moveTo(-rend.radius, 0);
                        ctx.lineTo(rend.radius, 0);
                        ctx.lineTo(0, rend.radius * 0.5);
                        ctx.fill();
                        ctx.beginPath();
                        ctx.moveTo(-rend.radius, 0);
                        ctx.lineTo(0, -rend.radius * 2.5);
                        ctx.lineTo(rend.radius, 0);
                        ctx.lineTo(0, rend.radius * 0.5);
                        ctx.closePath();
                    }
                    
                    ctx.fillStyle = rend.color + (shapeType === 'food' ? '' : 'AA'); // Food is opaque
                    ctx.fill();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1;
                    ctx.stroke();

                    // Draw a tiny plus sign inside food
                    if (shapeType === 'food') {
                        ctx.beginPath();
                        ctx.moveTo(-3, 0);
                        ctx.lineTo(3, 0);
                        ctx.moveTo(0, -3);
                        ctx.lineTo(0, 3);
                        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    }
                }
            });
        }
        
        // 3. Render Particles
        const particleEntities = world.query([Position, Particle], this.queryResults);
        for (const entityId of particleEntities) {
            const pos = world.getComponent(entityId, Position);
            const part = world.getComponent(entityId, Particle);
            
            let zOffset = 0;
            if (astar) {
                const tile = astar._getTile(Math.floor(pos.x), Math.floor(pos.y));
                if (tile) zOffset = tile.worldZ;
            }
            
            // Float higher over time
            const floatZ = (part.maxLifetime - part.lifetime) * 2.0;

            this.renderer.addEntity({
                worldX: pos.x,
                worldY: pos.y,
                worldZ: zOffset + floatZ + 0.5,
                draw: (ctx) => {
                    ctx.fillStyle = part.color;
                    ctx.globalAlpha = Math.max(0, part.lifetime / part.maxLifetime);
                    ctx.font = 'bold 16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(part.text, 0, -10);
                    ctx.globalAlpha = 1.0;
                }
            });
        }
        
        this.renderer.render(world);
    }
}

function boot() {
    console.log("Booting Emergent v2.0...");
    
    // For very tiny models (like our 6-8-8-2 network), the CPU backend is actually 
    // MUCH faster than WebGL because it avoids the massive overhead of uploading/downloading 
    // tiny arrays to the GPU every frame!
    tf.setBackend('cpu').then(() => {
        console.log("TensorFlow.js using CPU backend for tiny model performance.");
    });

    // Initialize Game
    const canvas = document.getElementById('game-canvas');
    const world = new ECS();
    const renderer = new IsometricRenderer(canvas);
    let astar = null;

    // Game State Controls (Phase 12)
    let isPaused = false;
    let gameSpeed = 1;

    // Setup Terrain
    let terrainGrid = [];

    // Handle resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    // 2. Initialize Engine
    isoMath = new IsometricMath(64, 32, 32);
    renderer = new Renderer(canvas, isoMath);
    
    // Start camera (Phase 4 camera foundation)
    renderer.setCamera(0, 0, 0.5);

    // Mouse Panning & Zooming
    let isDragging = false;
    let lastMouse = { x: 0, y: 0 };
    
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        lastMouse = { x: e.clientX, y: e.clientY };
    });
    
    window.addEventListener('mouseup', () => isDragging = false);
    
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastMouse.x;
        const dy = e.clientY - lastMouse.y;
        lastMouse = { x: e.clientX, y: e.clientY };
        
        // Move camera inversely to drag, scaled by zoom
        renderer.camera.x -= dx / renderer.camera.zoom;
        renderer.camera.y -= dy / renderer.camera.zoom;
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        renderer.camera.zoom = Math.max(0.2, Math.min(3.0, renderer.camera.zoom * zoomDelta));
    }, { passive: false });

    // Click to select entities (Phase 9)
    canvas.addEventListener('click', (e) => {
        // Did we drag? If so, ignore click
        if (Math.abs(e.clientX - lastMouse.x) > 5 || Math.abs(e.clientY - lastMouse.y) > 5) return;

        const worldCoords = renderer.getMouseWorldCoordinates(e.clientX, e.clientY);
        
        // Find closest entity
        const entities = world.query([Position, Renderable], world.systems.find(s => s instanceof RenderSystem).queryResults);
        
        let closestId = null;
        let closestDist = 2; // Selection radius (2 tiles)

        for (const entityId of entities) {
            const pos = world.getComponent(entityId, Position);
            const dist = Math.hypot(pos.x - worldCoords.x, pos.y - worldCoords.y);
            
            if (dist < closestDist) {
                closestDist = dist;
                closestId = entityId;
            }
        }

        selectedEntityId = closestId;
    });

    // 3. Initialize ECS
    world = new World();
    
    // Add Systems
    world.addSystem(new TimeSystem());
    world.addSystem(new BiologySystem());
    world.addSystem(new BrainSystem());
    world.addSystem(new ForagingSystem());
    world.addSystem(new MovementSystem());
    world.addSystem(new ReproductionSystem());
    world.addSystem(new InteractionSystem());
    world.addSystem(new ParticleSystem());
    world.addSystem(new RenderSystem(renderer));

    // 4. Generate Terrain (Phase 3)
    console.log("Generating Procedural Isometric Terrain...");
    terrain = new TerrainManager(30, 30); // 30x30 grid
    terrain.generate();
    terrain.createEntities(world, isoMath);

    // Initialize Pathfinding (Phase 7)
    astar = new AStar(terrain);

    // Initial Food Spawning
    spawnFood(30);
    // Periodically spawn food
    setInterval(() => spawnFood(5), 10000);

    // 5. Spawn Test Entities
    for (let i = 0; i < 50; i++) {
        spawnAgent();
    }

    // 5. Start Game Loop
    requestAnimationFrame(gameLoop);
}

function spawnFood(count) {
    if (!astar) return;
    const allFoods = world.query([Position, Food], []);
    
    for (let i = 0; i < count; i++) {
        let x = 0, y = 0;
        let attempts = 0;
        let isOccupied = false;
        
        do {
            x = Math.floor((Math.random() - 0.5) * 20);
            y = Math.floor((Math.random() - 0.5) * 20);
            
            isOccupied = false;
            for (const fId of allFoods) {
                const fPos = world.getComponent(fId, Position);
                if (fPos && fPos.x === x && fPos.y === y) {
                    isOccupied = true;
                    break;
                }
            }
            
            attempts++;
        } while ((!astar._isWalkable(x, y) || isOccupied) && attempts < 100);

        if (attempts < 100) {
            const foodId = world.createEntity();
            world.addComponent(foodId, new Position(x, y));
            world.addComponent(foodId, new Food(15, 3)); // 3 bites, 15 energy each
            // Render as a medium bright yellow diamond
            const rend = new Renderable('#fbbf24', 8);
            rend.shape = 'food'; // New shape type
            world.addComponent(foodId, rend);
            
            // Add to our local array so the next loop iteration knows it's occupied
            allFoods.push(foodId);
        }
    }
}

function spawnOffspring(parentAId, parentBId, spawnX, spawnY) {
    const statsA = world.getComponent(parentAId, OrganismStats);
    const statsB = world.getComponent(parentBId, OrganismStats);
    const rendA = world.getComponent(parentAId, Renderable);
    const rendB = world.getComponent(parentBId, Renderable);
    
    const childId = world.createEntity();
    
    // Failsafe if center is in water
    if (astar && !astar._isWalkable(Math.round(spawnX), Math.round(spawnY))) {
        const posA = world.getComponent(parentAId, Position);
        spawnX = posA.x;
        spawnY = posA.y;
    }
    
    world.addComponent(childId, new Position(spawnX, spawnY));
    world.addComponent(childId, new Velocity(0, 0));
    
    // Pass parent brains to crossover
    const brainA = world.getComponent(parentAId, NeuralBrain);
    const brainB = world.getComponent(parentBId, NeuralBrain);
    world.addComponent(childId, new NeuralBrain(brainA.model, brainB.model));
    
    // Genetics: Blend Colors
    const rA = parseInt(rendA.color.slice(1, 3), 16);
    const gA = parseInt(rendA.color.slice(3, 5), 16);
    const bA = parseInt(rendA.color.slice(5, 7), 16);
    const rB = parseInt(rendB.color.slice(1, 3), 16);
    const gB = parseInt(rendB.color.slice(3, 5), 16);
    const bB = parseInt(rendB.color.slice(5, 7), 16);
    
    // 50/50 blend with minor mutation
    let rC = Math.round((rA + rB) / 2 + (Math.random() - 0.5) * 40);
    let gC = Math.round((gA + gB) / 2 + (Math.random() - 0.5) * 40);
    let bC = Math.round((bA + bB) / 2 + (Math.random() - 0.5) * 40);
    
    rC = Math.max(0, Math.min(255, rC));
    gC = Math.max(0, Math.min(255, gC));
    bC = Math.max(0, Math.min(255, bC));
    
    const colorC = `#${rC.toString(16).padStart(2, '0')}${gC.toString(16).padStart(2, '0')}${bC.toString(16).padStart(2, '0')}`;
    
    // Inheritance: Shape
    const childShape = Math.random() > 0.5 ? rendA.shape : rendB.shape;
    const childRadius = (rendA.radius + rendB.radius) / 2 + (Math.random() - 0.5) * 2;
    
    const childRend = new Renderable(colorC, Math.max(8, childRadius));
    childRend.shape = childShape;
    world.addComponent(childId, childRend);
    
    // Inheritance: Stats
    const childStats = new OrganismStats();
    childStats.maxAge = (statsA.maxAge + statsB.maxAge) / 2 + (Math.random() - 0.5) * 10;
    childStats.generation = Math.max(statsA.generation, statsB.generation) + 1;
    childStats.energy = 60; // Born with some energy
    
    world.addComponent(childId, childStats);
}

function spawnAgent(startX = null, startY = null) {
    const entityId = world.createEntity();
    
    let x = 0, y = 0;
    if (startX !== null && startY !== null) {
        x = startX;
        y = startY;
    } else {
        let attempts = 0;
        do {
            x = Math.floor((Math.random() - 0.5) * 20);
            y = Math.floor((Math.random() - 0.5) * 20);
            attempts++;
        } while (astar && !astar._isWalkable(x, y) && attempts < 100);
    }

    world.addComponent(entityId, new Position(x, y));
    world.addComponent(entityId, new Velocity(0, 0));
    world.addComponent(entityId, new OrganismStats());
    world.addComponent(entityId, new NeuralBrain());
    
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    world.addComponent(entityId, new Renderable(color, 15 + Math.random() * 15));
    return entityId;
}

let lastTime = performance.now();
function gameLoop(now) {
    let dtMs = now - lastTime;
    lastTime = now;
    
    // Cap dt to prevent massive jumps if tab is inactive
    if (dtMs > 100) dtMs = 100;
    
    // Fixed physics step
    const dt = 1.0 / 60.0;
    
    if (!isPaused) {
        for (let i = 0; i < gameSpeed; i++) {
            world.update(dt);
        }
    }
    
    // Render happens exactly once per frame
    renderer.render(world);
    
    // FPS Counter
    if (now - lastFpsTime >= 1000) {
        document.getElementById('fps-counter').textContent = frameCount;
        frameCount = 0;
        lastFpsTime = now;
    }
    
// Phase 12: UI Control Bindings
document.getElementById('btn-play-pause').addEventListener('click', (e) => {
    isPaused = !isPaused;
    e.target.textContent = isPaused ? '▶️ Play' : '⏸️ Pause';
});

function setSpeed(speed, btnId) {
    gameSpeed = speed;
    ['btn-speed-1x', 'btn-speed-2x', 'btn-speed-5x'].forEach(id => {
        document.getElementById(id).classList.remove('active');
    });
    document.getElementById(btnId).classList.add('active');
}

document.getElementById('btn-speed-1x').addEventListener('click', () => setSpeed(1, 'btn-speed-1x'));
document.getElementById('btn-speed-2x').addEventListener('click', () => setSpeed(2, 'btn-speed-2x'));
document.getElementById('btn-speed-5x').addEventListener('click', () => setSpeed(5, 'btn-speed-5x'));

// "God Mode" Interactions
canvas.addEventListener('contextmenu', e => e.preventDefault()); // Prevent right click menu
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Reverse camera transform
    const screenPosX = (mouseX - centerX) / renderer.camera.zoom + renderer.camera.x;
    const screenPosY = (mouseY - centerY) / renderer.camera.zoom + renderer.camera.y;
    
    const worldPos = renderer.isoMath.screenToWorld(screenPosX, screenPosY);
    
    // Find if we clicked an agent
    const agents = world.query([Position, OrganismStats]);
    let clickedAgent = null;
    for (const id of agents) {
        const pos = world.getComponent(id, Position);
        const dist = Math.hypot(pos.x - worldPos.x, pos.y - worldPos.y);
        if (dist < 1.5) {
            clickedAgent = id;
            break;
        }
    }
    
    if (clickedAgent !== null) {
        const stats = world.getComponent(clickedAgent, OrganismStats);
        const pos = world.getComponent(clickedAgent, Position);
        if (e.button === 0) {
            // Left click agent: REWARD (Bless + RL)
            stats.energy = 100;
            stats.health = 100;
            applyReinforcement(clickedAgent, true);
            
            const pId = world.createEntity();
            world.addComponent(pId, new Position(pos.x, pos.y));
            world.addComponent(pId, new Particle("REWARD!", '#4ade80', 2.0));
        } else if (e.button === 2) {
            // Right click agent: PUNISH (Zap + RL)
            // Non-lethal punishment: they can survive if they learn their lesson!
            stats.energy = Math.max(0, stats.energy - 20);
            stats.health = Math.max(10, stats.health - 10);
            applyReinforcement(clickedAgent, false);
            
            const pId = world.createEntity();
            world.addComponent(pId, new Position(pos.x, pos.y));
            world.addComponent(pId, new Particle("PUNISH!", '#ef4444', 2.0));
        }
    } else {
        if (e.button === 0) {
            // Left click empty: Spawn Food
            const foodId = world.createEntity();
            world.addComponent(foodId, new Position(worldPos.x, worldPos.y));
            world.addComponent(foodId, new Food(15, 3));
            world.addComponent(foodId, new Renderable('#facc15', 10));
            world.getComponent(foodId, Renderable).shape = 'food';
        } else if (e.button === 2) {
            // Right click empty: Spawn Agent
            spawnAgent(worldPos.x, worldPos.y);
        }
    }
});

// JSON Brain Export/Import
document.getElementById('btn-save-brain').addEventListener('click', async () => {
    // Find oldest living agent
    const agents = world.query([OrganismStats, NeuralBrain]);
    if (agents.length === 0) return alert("No agents alive to save!");
    
    let bestAgent = null;
    let maxAge = -1;
    for (const id of agents) {
        const stats = world.getComponent(id, OrganismStats);
        if (stats.age > maxAge) {
            maxAge = stats.age;
            bestAgent = id;
        }
    }
    
    const brain = world.getComponent(bestAgent, NeuralBrain);
    const result = await brain.model.save(tf.io.withSaveHandler(async artifacts => artifacts));
    
    const brainData = {
        modelTopology: result.modelTopology,
        weightSpecs: result.weightSpecs,
        weightData: Array.from(new Uint8Array(result.weightData)) // convert ArrayBuffer
    };
    
    const blob = new Blob([JSON.stringify(brainData)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `champion_gen${world.getComponent(bestAgent, OrganismStats).generation}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('btn-load-brain').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const json = JSON.parse(ev.target.result);
        const weightData = new Uint8Array(json.weightData).buffer;
        
        const model = await tf.loadLayersModel(tf.io.fromMemory(
            json.modelTopology, json.weightSpecs, weightData
        ));
        
        // Spawn 5 agents with this exact brain
        for (let i = 0; i < 5; i++) {
            const newId = spawnAgent();
            const brain = world.getComponent(newId, NeuralBrain);
            brain.model.dispose(); // dispose the random one
            
            // Clone the loaded model so they don't share references
            const clone = tf.sequential();
            clone.add(tf.layers.dense({ units: 8, inputShape: [6], activation: 'relu' }));
            clone.add(tf.layers.dense({ units: 8, activation: 'relu' }));
            clone.add(tf.layers.dense({ units: 3, activation: 'tanh' }));
            
            // Copy weights
            const weights = model.getWeights();
            const clonedWeights = weights.map(w => w.clone());
            clone.setWeights(clonedWeights);
            clonedWeights.forEach(t => t.dispose());
            
            world.addComponent(newId, new NeuralBrain(clone, clone)); // Pass it to constructor
            // Wait, NeuralBrain constructor expects parentModelA and B for crossover.
            // Let's just set the model directly.
            const newBrain = world.getComponent(newId, NeuralBrain);
            newBrain.model.dispose();
            newBrain.model = clone;
        }
        model.dispose();
        alert("Loaded 5 clones of the Champion Brain!");
    };
    reader.readAsText(file);
});

// Phase 13: God-Triggered RL Backpropagation
async function applyReinforcement(agentId, isReward) {
    const brain = world.getComponent(agentId, NeuralBrain);
    if (!brain || !brain.memory) return;
    
    const { inputs, outputs } = brain.memory;
    
    // Calculate new target for Stochastic Gradient Descent
    const targetArray = outputs.map(val => {
        if (isReward) {
            // Push output further towards its current extreme
            return Math.max(-1, Math.min(1, val * 1.5 + Math.sign(val) * 0.1));
        } else {
            // Do the exact opposite!
            return -val; 
        }
    });
    
    const inputTensor = tf.tensor2d([inputs]);
    const targetTensor = tf.tensor2d([targetArray]);
    
    // Compile on first use
    if (!brain.compiled) {
        brain.model.compile({ optimizer: tf.train.sgd(0.2), loss: 'meanSquaredError' });
        brain.compiled = true;
    }
    
    // 1-epoch background training step
    await brain.model.fit(inputTensor, targetTensor, { epochs: 1, verbose: 0 });
    
    inputTensor.dispose();
    targetTensor.dispose();
}

requestAnimationFrame(gameLoop);

window.onload = boot;
