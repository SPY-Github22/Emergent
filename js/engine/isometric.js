class IsometricMath {
    /**
     * @param {number} tileWidth - The width of a single isometric tile in pixels
     * @param {number} tileHeight - The height of a single isometric tile in pixels
     * @param {number} heightFactor - How many pixels represents 1 unit of Z height
     */
    constructor(tileWidth = 64, tileHeight = 32, heightFactor = 32) {
        this.tileWidth = tileWidth;
        this.tileHeight = tileHeight;
        this.heightFactor = heightFactor;
    }

    /**
     * Converts 3D Cartesian world coordinates to 2D screen coordinates
     * @param {number} worldX 
     * @param {number} worldY 
     * @param {number} worldZ 
     * @returns {Object} {x, y} screen coordinates
     */
    worldToScreen(worldX, worldY, worldZ = 0) {
        const screenX = (worldX - worldY) * (this.tileWidth / 2);
        const screenY = (worldX + worldY) * (this.tileHeight / 2) - (worldZ * this.heightFactor);
        return { x: screenX, y: screenY };
    }

    /**
     * Converts 2D screen coordinates back to 3D Cartesian world coordinates (assuming Z = 0)
     * @param {number} screenX 
     * @param {number} screenY 
     * @returns {Object} {x, y} world coordinates
     */
    screenToWorld(screenX, screenY) {
        const tw_half = this.tileWidth / 2;
        const th_half = this.tileHeight / 2;

        const worldX = (screenX / tw_half + screenY / th_half) / 2;
        const worldY = (screenY / th_half - screenX / tw_half) / 2;

        return { x: worldX, y: worldY };
    }
}

// Expose to global scope (no ES6 modules to avoid file:// CORS issues)
window.IsometricMath = IsometricMath;
