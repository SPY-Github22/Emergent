/**
 * terrain.js
 * Procedural Isometric Terrain Generation
 */

'use strict';

// Very simple 2D Value Noise for heightmaps
class ValueNoise {
    constructor(seed = Math.random()) {
        this.seed = seed;
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) {
            this.p[i] = Math.floor((Math.random() * 256));
        }
    }

    _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    _lerp(t, a, b) { return a + t * (b - a); }

    _hash(x, y) {
        return this.p[(this.p[x & 255] + y) & 255] / 255;
    }

    noise2D(x, y) {
        let ix = Math.floor(x);
        let iy = Math.floor(y);
        let fx = x - ix;
        let fy = y - iy;

        let h00 = this._hash(ix, iy);
        let h10 = this._hash(ix + 1, iy);
        let h01 = this._hash(ix, iy + 1);
        let h11 = this._hash(ix + 1, iy + 1);

        let sx = this._fade(fx);
        let sy = this._fade(fy);

        let nx0 = this._lerp(sx, h00, h10);
        let nx1 = this._lerp(sx, h01, h11);
        return this._lerp(sy, nx0, nx1);
    }
}

// Generates and holds the grid of tiles
class TerrainManager {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.noise = new ValueNoise();
        
        this.WATER_LEVEL = 0.3;
        this.SAND_LEVEL = 0.35;
        this.GRASS_LEVEL = 0.7;
        this.ROCK_LEVEL = 0.85;
    }

    generate() {
        this.tiles = [];
        for (let x = -this.width / 2; x < this.width / 2; x++) {
            for (let y = -this.height / 2; y < this.height / 2; y++) {
                
                // Fractal noise (multiple octaves)
                const scale1 = 0.05;
                const scale2 = 0.15;
                let n = this.noise.noise2D(x * scale1, y * scale1) * 0.7 + 
                        this.noise.noise2D(x * scale2, y * scale2) * 0.3;

                // Determine biome/color and actual Z height
                let z = 0;
                let type = 'water';
                let color = '#3b82f6'; // deep water
                
                if (n < this.WATER_LEVEL) {
                    type = 'water';
                    z = 0; // Water is flat
                    // shallow water
                    if (n > this.WATER_LEVEL - 0.05) color = '#60a5fa'; 
                } else if (n < this.SAND_LEVEL) {
                    type = 'sand';
                    z = 0.2;
                    color = '#fde047';
                } else if (n < this.GRASS_LEVEL) {
                    type = 'grass';
                    z = (n - this.SAND_LEVEL) * 2; // Grass builds height
                    color = '#4ade80';
                    if (n > this.GRASS_LEVEL - 0.15) color = '#22c55e'; // dark grass
                } else if (n < this.ROCK_LEVEL) {
                    type = 'rock';
                    z = (n - this.SAND_LEVEL) * 3; // Rocks are taller
                    color = '#94a3b8';
                } else {
                    type = 'snow';
                    z = (n - this.SAND_LEVEL) * 4; // Peaks
                    color = '#f8fafc';
                }

                // Add to grid
                this.tiles.push({
                    worldX: x,
                    worldY: y,
                    worldZ: z,
                    type: type,
                    color: color
                });
            }
        }
    }

    // Create ECS entities for the tiles
    createEntities(world, isoMath) {
        for (const t of this.tiles) {
            const entityId = world.createEntity();
            world.addComponent(entityId, new Position(t.worldX, t.worldY));
            world.addComponent(entityId, new TerrainTile(t.type));
            
            // Assign a custom renderable
            world.addComponent(entityId, {
                constructor: { name: 'IsometricBlock' },
                worldZ: t.worldZ,
                draw: (ctx) => {
                    const tw = isoMath.tileWidth;
                    const th = isoMath.tileHeight;

                    ctx.beginPath();
                    ctx.moveTo(0, -th/2);
                    ctx.lineTo(tw/2, 0);
                    ctx.lineTo(0, th/2);
                    ctx.lineTo(-tw/2, 0);
                    ctx.closePath();
                    ctx.fillStyle = t.color;
                    ctx.fill();
                    
                    if (t.type !== 'water') {
                        ctx.beginPath();
                        ctx.moveTo(-tw/2, 0);
                        ctx.lineTo(0, th/2);
                        ctx.lineTo(0, th/2 + th/2);
                        ctx.lineTo(-tw/2, th/2);
                        ctx.closePath();
                        ctx.fillStyle = this._darken(t.color, 0.2);
                        ctx.fill();

                        ctx.beginPath();
                        ctx.moveTo(0, th/2);
                        ctx.lineTo(tw/2, 0);
                        ctx.lineTo(tw/2, th/2);
                        ctx.lineTo(0, th/2 + th/2);
                        ctx.closePath();
                        ctx.fillStyle = this._darken(t.color, 0.4);
                        ctx.fill();
                    }
                }
            });
            
            // Register IsometricBlock in ECS manually since we used an anonymous object
            if (!world.componentMasks.has('IsometricBlock')) {
                 world.registerComponent({name: 'IsometricBlock'});
                 world.components.get('IsometricBlock').set(entityId, world.getComponent(entityId, {name: 'IsometricBlock'}));
            }
        }
    }
    _darken(hex, amt) {
        // Very rough darken for hex strings (e.g. #4ade80)
        let r = parseInt(hex.substring(1,3), 16);
        let g = parseInt(hex.substring(3,5), 16);
        let b = parseInt(hex.substring(5,7), 16);
        
        r = Math.floor(r * (1 - amt));
        g = Math.floor(g * (1 - amt));
        b = Math.floor(b * (1 - amt));
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}

window.TerrainManager = TerrainManager;
