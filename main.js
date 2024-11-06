import { Vec2, DirectedInitialVFlightPath, InitialVFlightPath } from './trajectory.js';

class TrajectorySimulation {
    constructor() {
        this.canvas = document.getElementById('myCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.vel_scale = 25;
        
        // Initial positions
        this.p_start = new Vec2(50, 500);
        this.p_end = new Vec2(950, 500);
        this.click_pos = new Vec2(100, 500);
        this.last_vel = Vec2.zero;
        this.drag = false;

        // UI Controls
        this.animateTrajectory = document.getElementById('animateTrajectory');
        this.timeRange = document.getElementById('timeRange');
        this.aMaxRange = document.getElementById('aMaxRange');
        this.radios = document.getElementsByName('experiment');
        
        this.setupEventListeners();
        this.startAnimation();
    }

    setupEventListeners() {
        // Mouse interaction
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', () => this.drag = false);
        
        // Touch interaction for mobile devices
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', () => this.drag = false);

        // Control updates
        this.timeRange.oninput = () => this.render();
        this.radios.forEach(radio => radio.onchange = () => this.render());
        this.aMaxRange.oninput = () => this.render();
        this.animateTrajectory.onclick = () => this.toggleAnimation();
    }

    handleMouseDown(event) {
        this.drag = true;
        this.updateClickPos(event.pageX - this.canvas.offsetLeft, event.pageY - this.canvas.offsetTop);
    }

    handleMouseMove(event) {
        if (this.drag) {
            this.updateClickPos(event.pageX - this.canvas.offsetLeft, event.pageY - this.canvas.offsetTop);
        }
    }

    handleTouchStart(event) {
        event.preventDefault();
        this.drag = true;
        const touch = event.touches[0];
        this.updateClickPos(touch.pageX - this.canvas.offsetLeft, touch.pageY - this.canvas.offsetTop);
    }

    handleTouchMove(event) {
        event.preventDefault();
        if (this.drag) {
            const touch = event.touches[0];
            this.updateClickPos(touch.pageX - this.canvas.offsetLeft, touch.pageY - this.canvas.offsetTop);
        }
    }

    updateClickPos(x, y) {
        this.click_pos = new Vec2(
            Math.max(0, Math.min(this.canvas.width, x)),
            Math.max(0, Math.min(this.canvas.height, y))
        );
        this.render();
    }

    getExperiment() {
        for (let radio of this.radios) {
            if (radio.checked) return radio.value;
        }
        return 'basic';
    }

    getTime() {
        return this.timeRange.value / 1000;
    }

    getAMax() {
        return this.aMaxRange.value / 100;
    }

    toggleAnimation() {
        if (this.animateTrajectory.checked) {
            this.startAnimation();
        } else {
            this.stopAnimation();
        }
    }

    startAnimation() {
        this.stopAnimation();
        this.animationInterval = setInterval(() => {
            this.timeRange.value = (parseInt(this.timeRange.value) + 5) % 1000;
            this.render();
        }, 1000 / 60);
    }

    stopAnimation() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    drawGrid() {
        const gridSize = 50;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        // Draw vertical lines
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    renderCircle(p, color, radius = 3) {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, radius, 0, Math.PI * 2, false);
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
        this.ctx.closePath();
    }

    renderPointLine(points, lineColor, pointColor) {
        // Draw the trajectory line
        this.ctx.beginPath();
        this.ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.ctx.lineTo(points[i].x, points[i].y);
        }
        this.ctx.strokeStyle = lineColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.closePath();

        // Draw points along the trajectory
        points.forEach((p, i) => {
            if (i % 5 === 0) { // Draw fewer points for better performance
                this.renderCircle(p, pointColor, 2);
            }
        });
    }

    renderText(p, text) {
        this.ctx.font = '16px Arial';
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(text, p.x, p.y);
    }

    renderLine(p1, p2, color, width = 1) {
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.stroke();
        this.ctx.closePath();
    }

    renderTrajectory(path) {
        const n = 50;
        const points = Array.from({length: n + 1}, (_, i) => {
            const t = (path.t_max / n) * i;
            return path.rocketPosition(t);
        });

        // Render trajectory path
        this.renderPointLine(points, '#3498db', '#e74c3c');

        // Render current position
        const currentTime = this.getTime() * path.t_max;
        const currentPos = path.rocketPosition(currentTime);
        this.renderCircle(currentPos, '#2ecc71', 6);

        // Render velocity vector
        const rocketVel = path.rocketVelocity(currentTime);
        const velEnd = currentPos.add(rocketVel.mul(this.vel_scale));
        this.renderLine(currentPos, velEnd, '#f1c40f', 2);

        // Render start and end points
        this.renderCircle(this.p_start, '#e74c3c', 8);
        this.renderCircle(this.p_end, '#3498db', 8);
        
        // Render time information
        this.renderText(new Vec2(10, 30), `Time: ${currentTime.toFixed(2)}s`);
        this.renderText(new Vec2(10, 60), `Max Time: ${path.t_max.toFixed(2)}s`);
        this.renderText(new Vec2(10, 90), `Speed: ${rocketVel.length().toFixed(2)} u/s`);
    }

    experimentBasic() {
        const a_max = this.getAMax();
        const initial_v = this.click_pos.sub(this.p_start).x / this.vel_scale;
        return new DirectedInitialVFlightPath(this.p_start, this.p_end, a_max, initial_v);
    }

    experimentBetter() {
        const a_max = this.getAMax();
        const initial_v = this.click_pos.sub(this.p_start).div(this.vel_scale);
        return new InitialVFlightPath(this.p_start, this.p_end, a_max, initial_v);
    }

    experimentMove() {
        const a_max = this.getAMax();
        if (!this.click_pos.equals(this.p_end)) {
            const cur_path = new InitialVFlightPath(this.p_start, this.p_end, a_max, this.last_vel);
            this.p_end = this.click_pos;
            this.p_start = cur_path.rocketPosition(this.getTime() * cur_path.t_max);
            this.last_vel = cur_path.rocketVelocity(this.getTime() * cur_path.t_max);
        }
        return new InitialVFlightPath(this.p_start, this.p_end, a_max, this.last_vel);
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw guide line
        this.renderLine(this.p_start, this.click_pos, '#27ae60', 1);

        // Render appropriate experiment
        const experiment = this.getExperiment();
        let path;
        
        switch (experiment) {
            case 'basic':
                path = this.experimentBasic();
                break;
            case 'better':
                path = this.experimentBetter();
                break;
            case 'move':
                path = this.experimentMove();
                break;
            default:
                path = this.experimentBasic();
        }

        this.renderTrajectory(path);
    }
}

// Initialize simulation when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TrajectorySimulation();
});
