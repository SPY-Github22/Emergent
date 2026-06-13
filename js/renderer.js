

class Renderer {
    constructor(bgId, entityId, uiId) {
        this.bgCanvas = document.getElementById(bgId);
        this.entityCanvas = document.getElementById(entityId);
        this.uiCanvas = document.getElementById(uiId);
        
        if (!this.bgCanvas || !this.entityCanvas || !this.uiCanvas) {
            console.error('Renderer: Missing canvas elements');
            return;
        }

        this.bgCtx = this.bgCanvas.getContext('2d', { alpha: false });
        this.entityCtx = this.entityCanvas.getContext('2d');
        this.uiCtx = this.uiCanvas.getContext('2d');
        
        this.width = this.bgCanvas.width;
        this.height = this.bgCanvas.height;

        this.lastIsDay = null; // Track day/night to only redraw BG when needed
        
        // Load some basic star positions for the night sky
        this.stars = Array.from({length: 100}, () => ({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            r: Math.random() * 1.5,
            a: Math.random()
        }));
    }

    render(world, interactionState) {
        if (!this.bgCtx) return;

        // --- LAYER 1: Background (Only redraw if day/night changed) ---
        if (this.lastIsDay !== world.isDay) {
            this.bgCtx.fillStyle = world.isDay ? '#18181b' : '#09090b';
            this.bgCtx.fillRect(0, 0, this.width, this.height);
            
            if (!world.isDay) {
                // Draw stars
                this.bgCtx.fillStyle = '#ffffff';
                for (const star of this.stars) {
                    this.bgCtx.globalAlpha = star.a;
                    this.bgCtx.beginPath();
                    this.bgCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
                    this.bgCtx.fill();
                }
                this.bgCtx.globalAlpha = 1.0;
            } else {
                // Draw grid lines
                this.bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                this.bgCtx.lineWidth = 1;
                for (let x = 0; x < this.width; x += 40) {
                    this.bgCtx.beginPath(); this.bgCtx.moveTo(x, 0); this.bgCtx.lineTo(x, this.height); this.bgCtx.stroke();
                }
                for (let y = 0; y < this.height; y += 40) {
                    this.bgCtx.beginPath(); this.bgCtx.moveTo(0, y); this.bgCtx.lineTo(this.width, y); this.bgCtx.stroke();
                }
            }
            this.lastIsDay = world.isDay;
        }

        // --- LAYER 2: Entities (Redrawn every frame) ---
        this.entityCtx.clearRect(0, 0, this.width, this.height);
        
        for (const person of world.persons) {
            const x = person.position.x;
            const y = person.position.y;
            
            // Draw Agent Glow
            this.entityCtx.beginPath();
            this.entityCtx.arc(x, y, 16, 0, Math.PI * 2);
            this.entityCtx.fillStyle = 'rgba(0, 212, 255, 0.15)';
            this.entityCtx.fill();

            // Draw Agent Core
            this.entityCtx.beginPath();
            this.entityCtx.arc(x, y, 12, 0, Math.PI * 2);
            this.entityCtx.fillStyle = '#00d4ff';
            this.entityCtx.fill();
            this.entityCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            this.entityCtx.lineWidth = 2;
            this.entityCtx.stroke();

            // Draw UI bars for hunger and social
            const barWidth = 24;
            const barHeight = 4;
            const barX = x - barWidth / 2;
            const barYOffset = 22;

            // Hunger bar
            this.entityCtx.fillStyle = 'rgba(0,0,0,0.5)';
            this.entityCtx.fillRect(barX, y + barYOffset, barWidth, barHeight);
            this.entityCtx.fillStyle = '#ef4444';
            this.entityCtx.fillRect(barX, y + barYOffset, barWidth * Math.max(0, Math.min(1, person.hunger / 100)), barHeight);

            // Social bar
            const socialY = y + barYOffset + barHeight + 2;
            this.entityCtx.fillStyle = 'rgba(0,0,0,0.5)';
            this.entityCtx.fillRect(barX, socialY, barWidth, barHeight);
            this.entityCtx.fillStyle = '#10b981';
            this.entityCtx.fillRect(barX, socialY, barWidth * Math.max(0, Math.min(1, person.social / 100)), barHeight);
        }

        // --- LAYER 3: UI and Menus (Redrawn every frame) ---
        this.uiCtx.clearRect(0, 0, this.width, this.height);
        
        if (interactionState && interactionState.radialMenu && interactionState.radialMenu.isOpen) {
            const menu = interactionState.radialMenu;
            const targetPerson = world.persons.find(p => p.id === menu.targetId);
            
            if (targetPerson) {
                // Draw target halo
                this.uiCtx.beginPath();
                this.uiCtx.arc(targetPerson.position.x, targetPerson.position.y, 22, 0, Math.PI * 2);
                this.uiCtx.strokeStyle = 'rgba(167, 139, 250, 0.8)'; // Violet
                this.uiCtx.lineWidth = 2;
                this.uiCtx.setLineDash([4, 4]);
                this.uiCtx.stroke();
                this.uiCtx.setLineDash([]);
                
                // Draw Menu
                const x = menu.x;
                const y = menu.y;
                const options = menu.options;
                const numOptions = options.length;
                const radius = 75;
                const innerRadius = 30;

                for (let i = 0; i < numOptions; i++) {
                    const startAngle = (i * 2 * Math.PI) / numOptions - Math.PI / 2;
                    const endAngle = ((i + 1) * 2 * Math.PI) / numOptions - Math.PI / 2;
                    
                    this.uiCtx.beginPath();
                    this.uiCtx.arc(x, y, radius, startAngle, endAngle, false);
                    this.uiCtx.arc(x, y, innerRadius, endAngle, startAngle, true);
                    this.uiCtx.closePath();

                    const isHovered = (i === menu.hoveredIndex);
                    this.uiCtx.fillStyle = isHovered 
                        ? 'rgba(167, 139, 250, 0.9)' // Violet hover
                        : 'rgba(15, 23, 42, 0.85)';  // Slate dark
                    
                    this.uiCtx.fill();
                    this.uiCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
                    this.uiCtx.lineWidth = 1;
                    this.uiCtx.stroke();

                    // Draw text
                    const textAngle = startAngle + (endAngle - startAngle) / 2;
                    const textX = x + Math.cos(textAngle) * (radius + innerRadius) / 2;
                    const textY = y + Math.sin(textAngle) * (radius + innerRadius) / 2;

                    this.uiCtx.fillStyle = isHovered ? '#ffffff' : '#e2e8f0';
                    this.uiCtx.font = '500 12px Inter, sans-serif';
                    this.uiCtx.textAlign = 'center';
                    this.uiCtx.textBaseline = 'middle';
                    this.uiCtx.fillText(options[i], textX, textY);
                }
            }
        }
    }
}
