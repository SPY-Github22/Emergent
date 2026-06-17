/**
 * ecs.js
 * Core Entity-Component-System manager.
 * Highly performant, zero dependencies.
 */

class World {
    constructor() {
        this.entities = [];
        this.nextEntityId = 1;
        
        // Maps component constructor names to Maps of EntityID -> ComponentInstance
        this.components = new Map(); 
        
        // Maps entity ID to bitmask (fast querying)
        this.entityMasks = new Map();
        
        // Component to bit index
        this.componentMasks = new Map();
        this.nextComponentBit = 0;

        // Active systems
        this.systems = [];
        
        // To reuse entity IDs and avoid GC
        this.freeEntities = [];
        
        // Global state
        this.time = 0; // 0 to 1 for day progress
    }

    // Register a component class explicitly
    registerComponent(componentClass) {
        if (!this.componentMasks.has(componentClass.name)) {
            if (this.nextComponentBit >= 31) {
                console.warn("World has reached 31 components. Bitmasking may behave unexpectedly.");
            }
            this.componentMasks.set(componentClass.name, 1 << this.nextComponentBit);
            this.nextComponentBit++;
            this.components.set(componentClass.name, new Map());
        }
    }

    createEntity() {
        const id = this.freeEntities.length > 0 ? this.freeEntities.pop() : this.nextEntityId++;
        this.entities.push(id);
        this.entityMasks.set(id, 0);
        return id;
    }

    destroyEntity(entityId) {
        const index = this.entities.indexOf(entityId);
        if (index !== -1) {
            // Fast remove from array by swapping with last element
            const last = this.entities[this.entities.length - 1];
            this.entities[index] = last;
            this.entities.pop();
        }
        this.entityMasks.delete(entityId);
        
        // Remove all components for this entity
        for (const map of this.components.values()) {
            map.delete(entityId);
        }
        
        this.freeEntities.push(entityId);
    }

    addComponent(entityId, component) {
        const compName = component.constructor.name;
        if (!this.componentMasks.has(compName)) {
            this.registerComponent(component.constructor);
        }

        const map = this.components.get(compName);
        map.set(entityId, component);

        const currentMask = this.entityMasks.get(entityId) || 0;
        this.entityMasks.set(entityId, currentMask | this.componentMasks.get(compName));
    }

    removeComponent(entityId, componentClass) {
        const compName = componentClass.name;
        const map = this.components.get(compName);
        if (map) {
            map.delete(entityId);
        }

        if (this.componentMasks.has(compName)) {
            const currentMask = this.entityMasks.get(entityId) || 0;
            this.entityMasks.set(entityId, currentMask & ~this.componentMasks.get(compName));
        }
    }

    getComponent(entityId, componentClass) {
        const compName = componentClass.name;
        const map = this.components.get(compName);
        return map ? map.get(entityId) : undefined;
    }

    /**
     * Query entities that have a specific set of components.
     * Optionally takes an outArray to reuse an existing array and avoid GC overhead.
     */
    query(componentClasses, outArray = []) {
        outArray.length = 0; // Clear without reallocation
        let queryMask = 0;
        
        for (let i = 0; i < componentClasses.length; i++) {
            const compName = componentClasses[i].name;
            if (!this.componentMasks.has(compName)) {
                return outArray; // Missing unregistered component, matches nothing
            }
            queryMask |= this.componentMasks.get(compName);
        }

        for (let i = 0; i < this.entities.length; i++) {
            const entityId = this.entities[i];
            const mask = this.entityMasks.get(entityId);
            if ((mask & queryMask) === queryMask) {
                outArray.push(entityId);
            }
        }
        
        return outArray;
    }

    addSystem(system) {
        this.systems.push(system);
    }

    update(dt) {
        for (let i = 0; i < this.systems.length; i++) {
            this.systems[i].update(this, dt);
        }
    }
}

class System {
    constructor() {
        // Optional pre-allocated array for queries to minimize GC
        this.queryResults = [];
    }
    
    update(world, dt) {
        // To be overridden by subclasses
    }
}

// Export to global scope
window.World = World;
window.System = System;
