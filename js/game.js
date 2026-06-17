/**
 * game.js
 * Bootstraps the ECS and Isometric Renderer to verify Phase 1 & 2.
 */

'use strict';

// Globals
let world, renderer, isoMath;
let lastTime = performance.now();
let frameCount = 0;
let lastFpsTime = performance.now();

// Updates global time (Phase 5)
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

// Very simple test system to move entities around
class MovementSystem extends System {
    update(world, dt) {
        // Query entities with Position and Velocity
        const entities = world.query([Position, Velocity], this.queryResults);
        
        for (const entityId of entities) {
            const pos = world.getComponent(entityId, Position);
            const vel = world.getComponent(entityId, Velocity);
            
            pos.x += vel.vx * dt;
            pos.y += vel.vy * dt;
            
            // Bounce off boundaries (world coordinates - tiles)
            if (pos.x > 14) { pos.x = 14; vel.vx *= -1; }
            if (pos.x < -14) { pos.x = -14; vel.vx *= -1; }
            if (pos.y > 14) { pos.y = 14; vel.vy *= -1; }
            if (pos.y < -14) { pos.y = -14; vel.vy *= -1; }
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
            
            // Push to renderer
            this.renderer.addEntity({
                worldX: pos.x,
                worldY: pos.y,
                worldZ: 0,
                draw: (ctx) => {
                    ctx.beginPath();
                    // Draw different shapes based on a hash of the color string
                    const shapeType = rend.color.length % 3; // 0, 1, or 2

                    if (shapeType === 0) {
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
                    
                    ctx.fillStyle = rend.color + 'AA'; // Add some transparency
                    ctx.fill();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });
        }
        
        this.renderer.render(world);
    }
}

function boot() {
    console.log("Booting Emergent v2.0...");
    
    // 1. Setup Canvas
    const canvas = document.getElementById('game-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
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

    // 3. Initialize ECS
    world = new World();
    
    // Add Systems
    world.addSystem(new TimeSystem());
    world.addSystem(new MovementSystem());
    world.addSystem(new RenderSystem(renderer));

    // 4. Generate Terrain (Phase 3)
    console.log("Generating Procedural Isometric Terrain...");
    const terrain = new TerrainManager(30, 30); // 30x30 grid
    terrain.generate();
    terrain.createEntities(world, isoMath);

    // 5. Spawn Test Entities
    for (let i = 0; i < 50; i++) {
        const entityId = world.createEntity();
        
        // Random world coordinates (-10 to 10 tiles)
        const x = (Math.random() - 0.5) * 20;
        const y = (Math.random() - 0.5) * 20;
        world.addComponent(entityId, new Position(x, y));
        
        // Random velocities (tiles per second)
        const vx = (Math.random() - 0.5) * 4;
        const vy = (Math.random() - 0.5) * 4;
        world.addComponent(entityId, new Velocity(vx, vy));
        
        // Random color
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        world.addComponent(entityId, new Renderable(color, 15 + Math.random() * 15));
    }

    // 5. Start Game Loop
    requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
    const dtMs = now - lastTime;
    lastTime = now;
    
    // Cap dt to prevent massive jumps when tab is inactive
    const dt = Math.min(dtMs / 1000, 0.1); 

    // Update ECS
    world.update(dt);
    
    // FPS Counter
    frameCount++;
    if (now - lastFpsTime >= 1000) {
        document.getElementById('fps-counter').textContent = frameCount;
        frameCount = 0;
        lastFpsTime = now;
    }

    requestAnimationFrame(gameLoop);
}

// Start
window.onload = boot;
