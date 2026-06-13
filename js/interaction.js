

class Interaction {
    constructor(canvasId, world) {
        this.canvas = document.getElementById(canvasId);
        this.world = world;
        
        this.state = {
            radialMenu: {
                isOpen: false,
                x: 0,
                y: 0,
                targetId: null,
                options: ['Feed', 'Connect', 'Guide', 'Approve', 'Correct'],
                hoveredIndex: -1
            }
        };

        if (this.canvas) {
            // Using pointer events for both mouse and touch support
            this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
            this.canvas.addEventListener('pointermove', this.handlePointerMove.bind(this));
            
            // Prevent context menu from appearing when right-clicking on canvas
            this.canvas.addEventListener('contextmenu', e => e.preventDefault());
        }
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    handlePointerDown(e) {
        // e.button === 0 is left click, e.button === 2 is right click
        // Assuming we only care about left clicks for radial menu
        if (e.button !== 0) return;

        const pos = this.getPointerPos(e);
        const menu = this.state.radialMenu;

        if (menu.isOpen) {
            // Check if clicked inside a valid option of the open menu
            if (menu.hoveredIndex !== -1) {
                const action = menu.options[menu.hoveredIndex];
                const targetPerson = this.world.persons.find(p => p.id === menu.targetId);
                
                if (targetPerson) {
                    events.emit('ACTION_TAKEN', {
                        action: action,
                        target: targetPerson.id,
                        stateSnapshot: targetPerson.getState()
                    });
                }
            }
            // Always close the menu on click if it was open
            menu.isOpen = false;
            menu.targetId = null;
            menu.hoveredIndex = -1;
        } else {
            // Check if user clicked on an agent to open the menu
            const clickRadius = 25; // Slightly larger than agent radius for easier clicking
            const visualRadius = 12; // Agent visual radius
            let bestAgent = null;
            let minDistance = Infinity;

            for (let i = this.world.persons.length - 1; i >= 0; i--) {
                const person = this.world.persons[i];
                const dx = pos.x - person.position.x;
                const dy = pos.y - person.position.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= visualRadius) {
                    // Direct hit, respect Z-order
                    bestAgent = person;
                    break;
                } else if (dist <= clickRadius) {
                    // Proximity hit, find closest
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestAgent = person;
                    }
                }
            }

            if (bestAgent) {
                // Open menu for this agent
                menu.isOpen = true;
                menu.x = bestAgent.position.x;
                menu.y = bestAgent.position.y;
                menu.targetId = bestAgent.id;
                menu.hoveredIndex = -1;
            }
        }
    }

    handlePointerMove(e) {
        const pos = this.getPointerPos(e);
        const menu = this.state.radialMenu;

        if (menu.isOpen) {
            const dx = pos.x - menu.x;
            const dy = pos.y - menu.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            const radius = 65;
            const innerRadius = 25;

            if (dist >= innerRadius && dist <= radius) {
                // Calculate angle from -pi/2 (top)
                let angle = Math.atan2(dy, dx);
                // Shift angle so 0 is at top (-pi/2)
                angle += Math.PI / 2;
                if (angle < 0) angle += 2 * Math.PI;

                const numOptions = menu.options.length;
                const sliceAngle = (2 * Math.PI) / numOptions;
                
                menu.hoveredIndex = Math.floor(angle / sliceAngle);
            } else {
                menu.hoveredIndex = -1; // Pointer outside ring
            }
        }
    }
}
