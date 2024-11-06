import { Vec2 } from './Vec2.js';
import { TrajectoryState } from '../types/vectors.js';

/**
 * Base class for different flight path calculations
 */
export abstract class FlightPath {
    protected t_max: number = 0;
    private _cachedPoints: TrajectoryState[] | null = null;
    private _cacheResolution: number = 50;

    abstract rocketPosition(t: number): Vec2;
    abstract rocketVelocity(t: number): Vec2;

    /**
     * Gets the maximum time for this flight path
     */
    getMaxTime(): number {
        return this.t_max;
    }

    /**
     * Performance optimization: Cache trajectory points
     */
    getCachedPoints(): TrajectoryState[] {
        if (!this._cachedPoints) {
            this._cachedPoints = Array.from(
                {length: this._cacheResolution + 1}, 
                (_, i) => {
                    const t = (this.t_max / this._cacheResolution) * i;
                    return {
                        position: this.rocketPosition(t),
                        velocity: this.rocketVelocity(t),
                        time: t
                    };
                }
            );
        }
        return this._cachedPoints;
    }

    /**
     * Get interpolated state at any time
     */
    getStateAtTime(t: number): TrajectoryState {
        if (t < 0 || t > this.t_max) {
            throw new Error(`Time ${t} is outside valid range [0, ${this.t_max}]`);
        }

        const points = this.getCachedPoints();
        const timeStep = this.t_max / this._cacheResolution;
        const index = Math.floor(t / timeStep);
        
        // Handle edge cases
        if (index >= points.length - 1) return points[points.length - 1];
        if (index < 0) return points[0];

        // Linear interpolation between cached points
        const p1 = points[index];
        const p2 = points[index + 1];
        const alpha = (t - p1.time) / timeStep;

        return {
            position: p1.position.add(p2.position.sub(p1.position).mul(alpha)),
            velocity: p1.velocity.add(p2.velocity.sub(p1.velocity).mul(alpha)),
            time: t
        };
    }
}
