/**
 * Performance monitoring for trajectory calculations and rendering
 */
export class PerformanceMonitor {
    constructor() {
        this.metrics = {
            fps: [],
            calculationTime: [],
            renderTime: [],
            memoryUsage: []
        };
        this.maxSamples = 60; // 1 second of data at 60fps
        this._lastFrameTime = performance.now();
        this._frameCount = 0;
    }

    startFrame() {
        this._frameStartTime = performance.now();
        this._calculationStartTime = 0;
        this._renderStartTime = 0;
    }

    startCalculation() {
        this._calculationStartTime = performance.now();
    }

    endCalculation() {
        if (this._calculationStartTime) {
            const calcTime = performance.now() - this._calculationStartTime;
            this.metrics.calculationTime.push(calcTime);
            if (this.metrics.calculationTime.length > this.maxSamples) {
                this.metrics.calculationTime.shift();
            }
        }
    }

    startRender() {
        this._renderStartTime = performance.now();
    }

    endFrame() {
        // Calculate FPS
        const currentTime = performance.now();
        const frameDelta = currentTime - this._lastFrameTime;
        this._frameCount++;

        if (frameDelta >= 1000) {
            const fps = (this._frameCount * 1000) / frameDelta;
            this.metrics.fps.push(fps);
            if (this.metrics.fps.length > this.maxSamples) {
                this.metrics.fps.shift();
            }
            this._frameCount = 0;
            this._lastFrameTime = currentTime;
        }

        // Calculate render time
        if (this._renderStartTime) {
            const renderTime = currentTime - this._renderStartTime;
            this.metrics.renderTime.push(renderTime);
            if (this.metrics.renderTime.length > this.maxSamples) {
                this.metrics.renderTime.shift();
            }
        }

        // Record memory usage if available
        if (performance.memory) {
            this.metrics.memoryUsage.push(performance.memory.usedJSHeapSize);
            if (this.metrics.memoryUsage.length > this.maxSamples) {
                this.metrics.memoryUsage.shift();
            }
        }
    }

    getAverageMetrics() {
        const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
        
        return {
            fps: this.metrics.fps.length ? average(this.metrics.fps).toFixed(1) : 0,
            calculationTime: this.metrics.calculationTime.length ? 
                average(this.metrics.calculationTime).toFixed(2) : 0,
            renderTime: this.metrics.renderTime.length ? 
                average(this.metrics.renderTime).toFixed(2) : 0,
            memoryUsage: this.metrics.memoryUsage.length ? 
                (average(this.metrics.memoryUsage) / (1024 * 1024)).toFixed(1) : 0
        };
    }
}
