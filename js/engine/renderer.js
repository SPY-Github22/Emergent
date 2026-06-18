class Renderer {
    /**
     * @param {HTMLCanvasElement} canvas 
     * @param {IsometricMath} isoMath 
     */
    constructor(canvas, isoMath) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.isoMath = isoMath || new IsometricMath();
        
        // Camera properties
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1.0
        };

        // Render list
        this.entities = [];
    }

    /**
     * Set camera position and zoom
     * @param {number} x - Camera focal point X (in screen space)
     * @param {number} y - Camera focal point Y (in screen space)
     * @param {number} zoom - Zoom scale factor
     */
    setCamera(x, y, zoom = 1.0) {
        this.camera.x = x;
        this.camera.y = y;
        this.camera.zoom = zoom;
    }

    /**
     * Clear the render list for the current frame
     */
    clearEntities() {
        this.entities = [];
    }

    /**
     * Add an entity to the render queue
     * @param {Object} entity - Should contain {worldX, worldY, worldZ, draw(ctx)}
     */
    addEntity(entity) {
        this.entities.push(entity);
    }

    /**
     * Sorts entities by depth for proper isometric rendering
     * Uses X + Y + Z depth metric standard for isometric tiles/sprites.
     */
    sortEntities() {
        this.entities.sort((a, b) => {
            const zA = a.worldZ || 0;
            const zB = b.worldZ || 0;
            
            // Primary sort by (worldX + worldY) which correlates to screenY depth.
            // Secondary adjustment for Z to render higher objects over lower ones in the same cell.
            const depthA = a.worldX + a.worldY + zA * 0.1;
            const depthB = b.worldX + b.worldY + zB * 0.1;
            
            return depthA - depthB;
        });
    }

    /**
     * Main render loop method
     * Call this every frame after adding all entities
     */
    render(world) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Apply camera transforms
        this.ctx.save();
        
        // Center the camera on the canvas
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        this.ctx.translate(centerX, centerY);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // Sort entities by depth to ensure proper overlap (Z-sorting/Y-sorting)
        this.sortEntities();

        // Draw all entities
        for (const entity of this.entities) {
            const screenPos = this.isoMath.worldToScreen(entity.worldX, entity.worldY, entity.worldZ || 0);
            
            if (typeof entity.draw === 'function') {
                this.ctx.save();
                // Translate context to the entity's screen coordinate
                this.ctx.translate(screenPos.x, screenPos.y);
                entity.draw(this.ctx);
                this.ctx.restore();
            }
        }

        this.ctx.restore();

        // Ambient Light Overlay for Day/Night cycle
        if (world && world.time !== undefined) {
            let darkness = 0;
            // 0 to 0.25 is morning, 0.25 to 0.5 is day, 0.5 to 0.75 is evening, 0.75 to 1.0 is night
            if (world.time > 0.5) {
                // Ramps from 0 to 0.7 darkness
                darkness = Math.sin((world.time - 0.5) * Math.PI) * 0.7;
            }
            if (darkness > 0) {
                this.ctx.fillStyle = `rgba(5, 10, 30, ${darkness})`;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
        }
    }

    /**
     * Convert mouse event screen coordinates to 3D world coordinates (Z=0)
     */
    getMouseWorldCoordinates(clientX, clientY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        let x = clientX - centerX;
        let y = clientY - centerY;

        x /= this.camera.zoom;
        y /= this.camera.zoom;

        x += this.camera.x;
        y += this.camera.y;

        return this.isoMath.screenToWorld(x, y);
    }
}

// Expose to global scope (no ES6 modules to avoid file:// CORS issues)
window.Renderer = Renderer;
