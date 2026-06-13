export class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`Canvas with id ${canvasId} not found`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        // Match world dimensions
        this.canvas.width = 800;
        this.canvas.height = 600;
    }

    render(world, interactionState) {
        if (!this.ctx) return;

        // Layer 1: Background
        this.ctx.fillStyle = world.isDay ? '#1a1d2e' : '#0a0c16'; // Deep space aesthetic
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Layer 2: Entities
        for (const person of world.persons) {
            const x = person.position.x;
            const y = person.position.y;
            
            // Draw Agent
            this.ctx.beginPath();
            this.ctx.arc(x, y, 12, 0, Math.PI * 2);
            this.ctx.fillStyle = '#00d4ff'; // Cyan from CSS
            this.ctx.fill();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();

            // Draw UI bars for hunger and social
            const barWidth = 24;
            const barHeight = 3;
            const barX = x - barWidth / 2;
            const barYOffset = 18;

            // Hunger bar (0 to 100) -> Red
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillRect(barX, y + barYOffset, barWidth * (person.hunger / 100), barHeight);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.strokeRect(barX, y + barYOffset, barWidth, barHeight);

            // Social bar (0 to 100) -> Emerald
            this.ctx.fillStyle = '#10b981';
            this.ctx.fillRect(barX, y + barYOffset + barHeight + 2, barWidth * (person.social / 100), barHeight);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.strokeRect(barX, y + barYOffset + barHeight + 2, barWidth, barHeight);
        }

        // Layer 3: Effects (Halos)
        if (interactionState && interactionState.radialMenu && interactionState.radialMenu.isOpen) {
            const targetId = interactionState.radialMenu.targetId;
            const targetPerson = world.persons.find(p => p.id === targetId);
            if (targetPerson) {
                this.ctx.beginPath();
                this.ctx.arc(targetPerson.position.x, targetPerson.position.y, 20, 0, Math.PI * 2);
                this.ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([4, 4]);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        }

        // Layer 4: UI/Menus
        if (interactionState && interactionState.radialMenu && interactionState.radialMenu.isOpen) {
            const menu = interactionState.radialMenu;
            const x = menu.x;
            const y = menu.y;
            const options = menu.options;
            const numOptions = options.length;
            const radius = 65;
            const innerRadius = 25;

            for (let i = 0; i < numOptions; i++) {
                const startAngle = (i * 2 * Math.PI) / numOptions - Math.PI / 2;
                const endAngle = ((i + 1) * 2 * Math.PI) / numOptions - Math.PI / 2;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, radius, startAngle, endAngle, false);
                this.ctx.arc(x, y, innerRadius, endAngle, startAngle, true);
                this.ctx.closePath();

                // Highlighted slice or default
                this.ctx.fillStyle = (i === menu.hoveredIndex) 
                    ? 'rgba(124, 58, 237, 0.85)' // Violet
                    : 'rgba(10, 14, 28, 0.9)';   // Panel dark
                
                this.ctx.fill();
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                this.ctx.lineWidth = 1;
                this.ctx.stroke();

                // Draw text
                const textAngle = startAngle + (endAngle - startAngle) / 2;
                const textX = x + Math.cos(textAngle) * (radius + innerRadius) / 2;
                const textY = y + Math.sin(textAngle) * (radius + innerRadius) / 2;

                this.ctx.fillStyle = (i === menu.hoveredIndex) ? '#ffffff' : '#94a3b8';
                this.ctx.font = '11px Inter, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(options[i], textX, textY);
            }
            

        }
    }
}
