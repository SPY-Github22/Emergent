/**
 * pathfinding.js
 * A* Pathfinding for Isometric Grid
 */

class AStar {
    constructor(terrainManager) {
        this.terrain = terrainManager;
        this.gridSize = terrainManager.width; // Assuming square grid 30x30
        this.halfWidth = this.gridSize / 2;
        this.halfHeight = terrainManager.height / 2;
        
        // Cache tiles in a Map for O(1) lookups
        this.tileMap = new Map();
        for (const t of this.terrain.tiles) {
            this.tileMap.set(`${t.worldX},${t.worldY}`, t);
        }
    }

    _getTile(x, y) {
        return this.tileMap.get(`${x},${y}`);
    }

    _isWalkable(x, y) {
        if (x < -this.halfWidth || x >= this.halfWidth || y < -this.halfHeight || y >= this.halfHeight) return false;
        const t = this._getTile(x, y);
        if (!t) return false;
        return t.type !== 'water'; // Only water is impassable for now
    }

    findPath(startX, startY, endX, endY) {
        // Round to nearest tile
        startX = Math.round(startX);
        startY = Math.round(startY);
        endX = Math.round(endX);
        endY = Math.round(endY);

        if (!this._isWalkable(endX, endY)) return null;

        const openSet = [];
        const closedSet = new Set();
        
        const startNode = { x: startX, y: startY, g: 0, h: this._heuristic(startX, startY, endX, endY), parent: null };
        openSet.push(startNode);

        while (openSet.length > 0) {
            // Get node with lowest f score
            openSet.sort((a, b) => (a.g + a.h) - (b.g + b.h));
            const current = openSet.shift();

            if (current.x === endX && current.y === endY) {
                return this._reconstructPath(current);
            }

            closedSet.add(`${current.x},${current.y}`);

            // Check 4 neighbors
            const neighbors = [
                { x: current.x + 1, y: current.y },
                { x: current.x - 1, y: current.y },
                { x: current.x, y: current.y + 1 },
                { x: current.x, y: current.y - 1 }
            ];

            for (const neighbor of neighbors) {
                if (!this._isWalkable(neighbor.x, neighbor.y)) continue;
                if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

                // Penalty for height differences could be added to g
                let gScore = current.g + 1;
                
                const existingNode = openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
                if (!existingNode) {
                    openSet.push({
                        x: neighbor.x,
                        y: neighbor.y,
                        g: gScore,
                        h: this._heuristic(neighbor.x, neighbor.y, endX, endY),
                        parent: current
                    });
                } else if (gScore < existingNode.g) {
                    existingNode.g = gScore;
                    existingNode.parent = current;
                }
            }
        }

        return null; // No path found
    }

    _heuristic(x1, y1, x2, y2) {
        // Manhattan distance for 4-way movement
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    _reconstructPath(node) {
        const path = [];
        let curr = node;
        while (curr !== null) {
            path.push({ x: curr.x, y: curr.y });
            curr = curr.parent;
        }
        return path.reverse();
    }
}

window.AStar = AStar;
