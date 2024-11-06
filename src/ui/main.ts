import { Vec2, DirectedInitialVFlightPath, InitialVFlightPath } from '../core/index.js';
import { PerformanceMonitor } from '../utils/performance.js';

/**
 * Main simulation class for spaceship trajectory visualization and calculation
 */
class TrajectorySimulation {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly perfMonitor: PerformanceMonitor;
    private readonly config: {
        vel_scale: number;
        acc_scale: number;
        pointRadius: number;
        smallPointRadius: number;
        gridSize: number;
        trajectoryPoints: number;
        animationFPS: number;
        colors: {
            grid: string;
            trajectory: string;
            points: string;
            currentPos: string;
            velocity: string;
            acceleration: string;
            start: string;
            end: string;
            perfStats: string;
        };
    };
    private lastRenderTime: number;
    private readonly frameInterval: number;
    private animationId?: number;
    private readonly state: {
        p_start: Vec2;
        p_end: Vec2;
        click_pos: Vec2;
        last_vel: Vec2;
        drag: boolean;
        selectedPoint: 'start' | 'end' | null;
        currentPath: DirectedInitialVFlightPath | InitialVFlightPath | null;
        error: string | null;
        showPerfStats: boolean;
        showAcceleration: boolean;
    };
    private readonly ui: {
        animateCheckbox: HTMLInputElement;
        timeRange: HTMLInputElement;
        aMaxRange: HTMLInputElement;
        radios: NodeListOf<HTMLInputElement>;
        exportButton: HTMLButtonElement;
        perfStatsButton: HTMLButtonElement;
        accelerationButton: HTMLButtonElement;
    };

    constructor() {
        // Initialize canvas with error handling
        const canvas = document.getElementById('myCanvas');
        if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
            throw new Error('Canvas element not found');
        }
        this.canvas = canvas;
        
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context');
        }
        this.ctx = ctx;

        // Initialize performance monitoring
        this.perfMonitor = new PerformanceMonitor();

        // Constants and configuration
        this.config = {
            vel_scale: 25,
            acc_scale: 50,
            pointRadius: 8,
            smallPointRadius: 2,
            gridSize: 50,
            trajectoryPoints: 50,
            animationFPS: 60,
            colors: {
                grid: 'rgba(255, 255, 255, 0.1)',
                trajectory: '#3498db',
                points: '#e74c3c',
                currentPos: '#2ecc71',
                velocity: '#f1c40f',
                acceleration: '#e67e22',
                start: '#e74c3c',
                end: '#3498db',
                perfStats: '#95a5a6'
            }
        };

        // Performance optimization: Use requestAnimationFrame
        this.lastRenderTime = 0;
        this.frameInterval = 1000 / this.config.animationFPS;
        
        // State initialization
        this.state = {
            p_start: new Vec2(50, 500),
            p_end: new Vec2(950, 500),
            click_pos: new Vec2(100, 500),
            last_vel: Vec2.zero,
            drag: false,
            selectedPoint: null,
            currentPath: null,
            error: null,
            showPerfStats: false,
            showAcceleration: true
        };

        // Cache DOM elements
        const animateCheckbox = document.getElementById('animateTrajectory') as HTMLInputElement;
        const timeRange = document.getElementById('timeRange') as HTMLInputElement;
        const aMaxRange = document.getElementById('aMaxRange') as HTMLInputElement;
        const radios = document.getElementsByName('experiment') as NodeListOf<HTMLInputElement>;
        const exportButton = document.getElementById('exportButton') as HTMLButtonElement;
        const perfStatsButton = document.getElementById('perfStatsButton') as HTMLButtonElement;
        const accelerationButton = document.getElementById('accelerationButton') as HTMLButtonElement;

        if (!animateCheckbox || !timeRange || !aMaxRange || !radios || !exportButton || 
            !perfStatsButton || !accelerationButton) {
            throw new Error('Required UI elements not found');
        }

        this.ui = {
            animateCheckbox,
            timeRange,
            aMaxRange,
            radios,
            exportButton,
            perfStatsButton,
            accelerationButton
        };

        // Add ARIA labels and roles for accessibility
        this.setupAccessibility();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start animation
        this.startAnimation();

        // Initial render
        this.render();
    }

    private setupAccessibility(): void {
        this.canvas.setAttribute('role', 'application');
        this.canvas.setAttribute('aria-label', 'Spaceship Trajectory Simulator Canvas');
        
        // Add keyboard controls
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.addEventListener('keydown', this.handleKeyboard.bind(this));

        // Add ARIA descriptions
        document.querySelectorAll('.experiment-option label').forEach(label => {
            if (!(label instanceof HTMLLabelElement)) return;
            
            const description = label.getAttribute('title');
            if (description) {
                const id = `desc-${label.getAttribute('for')}`;
                label.setAttribute('aria-describedby', id);
                const desc = document.createElement('div');
                desc.id = id;
                desc.className = 'sr-only';
                desc.textContent = description;
                label.parentNode?.appendChild(desc);
            }
        });
    }

    private handleKeyboard(event: KeyboardEvent): void {
        const step = event.shiftKey ? 10 : 1;
        let handled = true;

        switch(event.key) {
            case 'ArrowLeft':
                this.state.click_pos = this.state.click_pos.add(new Vec2(-step, 0));
                break;
            case 'ArrowRight':
                this.state.click_pos = this.state.click_pos.add(new Vec2(step, 0));
                break;
            case 'ArrowUp':
                this.state.click_pos = this.state.click_pos.add(new Vec2(0, -step));
                break;
            case 'ArrowDown':
                this.state.click_pos = this.state.click_pos.add(new Vec2(0, step));
                break;
            default:
                handled = false;
        }

        if (handled) {
            event.preventDefault();
            this.render();
        }
    }

    private setupEventListeners(): void {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('touchcancel', this.handleMouseUp.bind(this));

        // Control updates
        this.ui.timeRange.addEventListener('input', () => this.render());
        this.ui.aMaxRange.addEventListener('input', () => this.render());
        this.ui.radios.forEach(radio => 
            radio.addEventListener('change', () => this.render())
        );
        this.ui.animateCheckbox.addEventListener('change', () => this.toggleAnimation());

        // Button events
        this.ui.exportButton.addEventListener('click', () => this.exportTrajectory());
        this.ui.perfStatsButton.addEventListener('click', () => {
            this.state.showPerfStats = !this.state.showPerfStats;
            this.render();
        });
        this.ui.accelerationButton.addEventListener('click', () => {
            this.state.showAcceleration = !this.state.showAcceleration;
            this.render();
        });

        // Window resize handling
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    private handleResize(): void {
        // Maintain aspect ratio and scale
        const container = this.canvas.parentElement;
        if (!container) return;

        const width = container.clientWidth;
        const height = width;

        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        
        // Update internal canvas dimensions
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.render();
    }

    private isNearPoint(pos: Vec2, point: Vec2): boolean {
        return new Vec2(pos.x - point.x, pos.y - point.y).length() < 15;
    }

    private getMousePosition(event: MouseEvent): Vec2 {
        const rect = this.canvas.getBoundingClientRect();
        return new Vec2(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
    }

    private getTouchPosition(touch: Touch): Vec2 {
        const rect = this.canvas.getBoundingClientRect();
        return new Vec2(
            touch.clientX - rect.left,
            touch.clientY - rect.top
        );
    }

    private handleMouseDown(event: MouseEvent): void {
        const pos = this.getMousePosition(event);
        this.startDrag(pos);
    }

    private handleMouseMove(event: MouseEvent): void {
        if (this.state.drag) {
            const pos = this.getMousePosition(event);
            this.updateDragPosition(pos);
        }
    }

    private handleMouseUp(): void {
        this.state.drag = false;
        this.state.selectedPoint = null;
    }

    private handleTouchStart(event: TouchEvent): void {
        event.preventDefault();
        const touch = event.touches[0];
        const pos = this.getTouchPosition(touch);
        this.startDrag(pos);
    }

    private handleTouchMove(event: TouchEvent): void {
        event.preventDefault();
        if (this.state.drag) {
            const touch = event.touches[0];
            const pos = this.getTouchPosition(touch);
            this.updateDragPosition(pos);
        }
    }

    private startDrag(pos: Vec2): void {
        if (this.isNearPoint(pos, this.state.p_start)) {
            this.state.selectedPoint = 'start';
        } else if (this.isNearPoint(pos, this.state.p_end)) {
            this.state.selectedPoint = 'end';
        }
        this.state.drag = true;
        this.updateDragPosition(pos);
    }

    private updateDragPosition(pos: Vec2): void {
        try {
            const newPos = new Vec2(
                Math.max(0, Math.min(this.canvas.width, pos.x)),
                Math.max(0, Math.min(this.canvas.height, pos.y))
            );

            if (this.state.selectedPoint === 'start') {
                this.state.p_start = newPos;
            } else if (this.state.selectedPoint === 'end') {
                this.state.p_end = newPos;
            } else {
                this.state.click_pos = newPos;
            }

            this.render();
        } catch (error) {
            console.error('Error updating position:', error);
            this.state.error = error instanceof Error ? error.message : 'Unknown error';
            this.render();
        }
    }

    private getExperiment(): string {
        for (let radio of this.ui.radios) {
            if (radio.checked) return radio.value;
        }
        return 'basic';
    }

    private getTime(): number {
        return parseInt(this.ui.timeRange.value) / 1000;
    }

    private getAMax(): number {
        return parseInt(this.ui.aMaxRange.value) / 100;
    }

    private toggleAnimation(): void {
        if (this.ui.animateCheckbox.checked) {
            this.startAnimation();
        } else {
            this.stopAnimation();
        }
    }

    private startAnimation(): void {
        this.stopAnimation();
        this.animate();
    }

    private stopAnimation(): void {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
    }

    private animate(currentTime?: number): void {
        if (!this.ui.animateCheckbox.checked) return;

        this.perfMonitor.startFrame();

        if (currentTime === undefined) {
            this.animationId = requestAnimationFrame(this.animate.bind(this));
            return;
        }

        if (!this.lastRenderTime) this.lastRenderTime = currentTime;

        const elapsed = currentTime - this.lastRenderTime;

        if (elapsed > this.frameInterval) {
            const newValue = (parseInt(this.ui.timeRange.value) + 5) % 1000;
            this.ui.timeRange.value = newValue.toString();
            this.render();
            this.lastRenderTime = currentTime;
        }

        this.perfMonitor.endFrame();
        this.animationId = requestAnimationFrame(this.animate.bind(this));
    }

    private drawGrid(): void {
        this.ctx.strokeStyle = this.config.colors.grid;
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= this.canvas.width; x += this.config.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= this.canvas.height; y += this.config.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    private renderCircle(p: Vec2, color: string, radius = 3): void {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, false);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.closePath();
    }

    private renderPointLine(points: Vec2[], lineColor: string, pointColor: string): void {
        if (points.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.strokeStyle = lineColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.closePath();

        points.forEach((p, i) => {
            if (i % 5 === 0) {
                this.renderCircle(p, pointColor, this.config.smallPointRadius);
            }
        });
    }

    private renderText(p: Vec2, text: string): void {
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(text, p.x, p.y);
    }

    private renderLine(p1: Vec2, p2: Vec2, color: string, width = 1): void {
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.stroke();
        this.ctx.closePath();
    }

    private renderArrow(p1: Vec2, p2: Vec2, color: string, width = 1): void {
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const length = new Vec2(p2.x - p1.x, p2.y - p1.y).length();
        
        // Draw main line
        this.renderLine(p1, p2, color, width);
        
        // Draw arrowhead
        const arrowLength = Math.min(10, length / 3);
        
        this.ctx.beginPath();
        this.ctx.moveTo(p2.x, p2.y);
        this.ctx.lineTo(
            p2.x - arrowLength * Math.cos(angle - Math.PI/6),
            p2.y - arrowLength * Math.sin(angle - Math.PI/6)
        );
        this.ctx.lineTo(
            p2.x - arrowLength * Math.cos(angle + Math.PI/6),
            p2.y - arrowLength * Math.sin(angle + Math.PI/6)
        );
        this.ctx.closePath();
        
        this.ctx.fillStyle = color;
        this.ctx.fill();
    }

    private getCurrentPath(): DirectedInitialVFlightPath | InitialVFlightPath {
        const experiment = this.getExperiment();
        const a_max = this.getAMax();
            
        switch (experiment) {
            case 'basic':
                return this.experimentBasic();
            case 'better':
                return this.experimentBetter();
            case 'move':
                return this.experimentMove();
            default:
                return this.experimentBasic();
        }
    }

    private exportTrajectory(): void {
        try {
            const path = this.getCurrentPath();
            const points = path.getCachedPoints();
            
            const trajectoryData = {
                metadata: {
                    startPosition: this.state.p_start,
                    endPosition: this.state.p_end,
                    maxAcceleration: this.getAMax(),
                    totalTime: path.getMaxTime(),
                    method: this.getExperiment()
                },
                points: points
            };

            const blob = new Blob([JSON.stringify(trajectoryData, null, 2)], 
                                {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'trajectory.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting trajectory:', error);
            this.state.error = error instanceof Error ? error.message : 'Failed to export trajectory';
        }
    }

    private renderTrajectory(path: DirectedInitialVFlightPath | InitialVFlightPath): void {
        try {
            this.perfMonitor.startCalculation();
            const points = path.getCachedPoints().map(p => p.position);
            this.perfMonitor.endCalculation();
            
            this.perfMonitor.startRender();
            
            // Render trajectory path
            this.renderPointLine(points, this.config.colors.trajectory, this.config.colors.points);

            // Render current position and vectors
            const currentTime = this.getTime() * path.getMaxTime();
            const state = path.getStateAtTime(currentTime);
            
            this.renderCircle(state.position, this.config.colors.currentPos, this.config.pointRadius);

            // Render velocity vector
            const velEnd = state.position.add(state.velocity.mul(this.config.vel_scale));
            this.renderArrow(state.position, velEnd, this.config.colors.velocity, 2);

            // Render acceleration vector if enabled
            if (this.state.showAcceleration) {
                const dt = 0.01;
                const nextState = path.getStateAtTime(Math.min(currentTime + dt, path.getMaxTime()));
                const acceleration = nextState.velocity.sub(state.velocity).div(dt);
                const accEnd = state.position.add(acceleration.mul(this.config.acc_scale));
                this.renderArrow(state.position, accEnd, this.config.colors.acceleration, 2);
            }

            // Render start and end points with labels
            this.renderCircle(this.state.p_start, this.config.colors.start, this.config.pointRadius);
            this.renderText(this.state.p_start.add(new Vec2(10, -10)), 'Start');
            
            this.renderCircle(this.state.p_end, this.config.colors.end, this.config.pointRadius);
            this.renderText(this.state.p_end.add(new Vec2(10, -10)), 'End');
            
            // Render time information
            this.renderText(new Vec2(10, 30), `Time: ${currentTime.toFixed(2)}s`);
            this.renderText(new Vec2(10, 60), `Max Time: ${path.getMaxTime().toFixed(2)}s`);
            this.renderText(new Vec2(10, 90), `Speed: ${state.velocity.length().toFixed(2)} u/s`);

            // Render performance stats if enabled
            if (this.state.showPerfStats) {
                const stats = this.perfMonitor.getAverageMetrics();
                const statsY = this.canvas.height - 100;
                this.ctx.fillStyle = this.config.colors.perfStats;
                this.ctx.fillText(`FPS: ${stats.fps}`, 10, statsY);
                this.ctx.fillText(`Calc Time: ${stats.calculationTime}ms`, 10, statsY + 20);
                this.ctx.fillText(`Render Time: ${stats.renderTime}ms`, 10, statsY + 40);
                if (+stats.memoryUsage > 0) {
                    this.ctx.fillText(`Memory: ${stats.memoryUsage}MB`, 10, statsY + 60);
                }
            }

            // Clear any previous errors
            this.state.error = null;
            
            this.perfMonitor.endFrame();
        } catch (error) {
            console.error('Error rendering trajectory:', error);
            this.state.error = error instanceof Error ? error.message : 'Unknown error';
        }
    }

    private experimentBasic(): DirectedInitialVFlightPath {
        const a_max = this.getAMax();
        const initial_v = this.state.click_pos.sub(this.state.p_start).x / this.config.vel_scale;
        return new DirectedInitialVFlightPath(this.state.p_start, this.state.p_end, a_max, initial_v);
    }

    private experimentBetter(): InitialVFlightPath {
        const a_max = this.getAMax();
        const initial_v = this.state.click_pos.sub(this.state.p_start).div(this.config.vel_scale);
        return new InitialVFlightPath(this.state.p_start, this.state.p_end, a_max, initial_v);
    }

    private experimentMove(): InitialVFlightPath {
        const a_max = this.getAMax();
        if (!this.state.click_pos.equals(this.state.p_end)) {
            const cur_path = new InitialVFlightPath(
                this.state.p_start, 
                this.state.p_end, 
                a_max, 
                this.state.last_vel
            );
            const currentTime = this.getTime() * cur_path.getMaxTime();
            this.state.p_start = cur_path.rocketPosition(currentTime);
            this.state.last_vel = cur_path.rocketVelocity(currentTime);
            this.state.p_end = this.state.click_pos;
        }
        return new InitialVFlightPath(
            this.state.p_start, 
            this.state.p_end, 
            a_max, 
            this.state.last_vel
        );
    }

    private render(): void {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        try {
            // Draw guide line
            this.renderLine(
                this.state.p_start, 
                this.state.click_pos, 
                '#27ae60', 
                1
            );

            // Get and render appropriate path
            const path = this.getCurrentPath();
            this.renderTrajectory(path);

            // Render any error messages
            if (this.state.error) {
                this.ctx.fillStyle = 'red';
                this.ctx.fillText(`Error: ${this.state.error}`, 10, this.canvas.height - 20);
            }
        } catch (error) {
            console.error('Error in render:', error);
            this.ctx.fillStyle = 'red';
            this.ctx.fillText(
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 
                10, 
                this.canvas.height - 20
            );
        }
    }
}

// Initialize simulation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        new TrajectorySimulation();
    } catch (error) {
        console.error('Failed to initialize simulation:', error);
        document.body.innerHTML = `
            <div style="color: red; padding: 20px;">
                Failed to initialize simulation: ${error instanceof Error ? error.message : 'Unknown error'}
            </div>
        `;
    }
});
