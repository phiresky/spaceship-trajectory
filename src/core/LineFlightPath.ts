import { Vec2 } from './Vec2.js';
import { FlightPath } from './FlightPath.js';

/**
 * Handles straight line flight paths with acceleration and deceleration phases
 */
export class LineFlightPath extends FlightPath {
    private readonly p_start: Vec2;
    private readonly p_end: Vec2;
    private readonly a_max: number;
    private readonly distance: number;
    private readonly direction: Vec2;

    constructor(p_start: Vec2, p_end: Vec2, a_max: number) {
        super();
        if (!(p_start instanceof Vec2)) throw new Error('p_start must be Vec2');
        if (!(p_end instanceof Vec2)) throw new Error('p_end must be Vec2');
        if (typeof a_max !== 'number' || a_max <= 0) {
            throw new Error('a_max must be positive number');
        }

        this.p_start = p_start;
        this.p_end = p_end;
        this.a_max = a_max;

        const dd = p_end.sub(p_start);
        this.distance = dd.length();
        
        if (this.distance === 0) {
            this.direction = Vec2.zero;
            this.t_max = 0;
        } else {
            this.direction = dd.div(this.distance);
            this.t_max = 2 * Math.sqrt(this.distance / a_max);
        }
    }

    rocketPosition(t: number): Vec2 {
        if (t < 0) throw new Error('Time cannot be negative');
        
        if (this.distance === 0) return this.p_start;
        
        if (t <= this.t_max / 2) {
            // Acceleration phase
            return this.p_start.add(this.direction.mul(0.5 * this.a_max * t * t));
        } else if (t <= this.t_max) {
            // Deceleration phase
            const t_decel = this.t_max - t;
            return this.p_end.add(this.direction.mul(-0.5 * this.a_max * t_decel * t_decel));
        }
        return this.p_end;
    }

    rocketVelocity(t: number): Vec2 {
        if (t < 0) throw new Error('Time cannot be negative');
        
        if (this.distance === 0) return Vec2.zero;
        
        if (t <= this.t_max / 2) {
            return this.direction.mul(this.a_max * t);
        } else if (t <= this.t_max) {
            const t_decel = t - this.t_max / 2;
            return this.direction.mul(this.a_max * (this.t_max / 2 - t_decel));
        }
        return Vec2.zero;
    }

    /**
     * Gets the total distance of this flight path
     */
    getDistance(): number {
        return this.distance;
    }

    /**
     * Gets the direction vector of this flight path
     */
    getDirection(): Vec2 {
        return this.direction;
    }
}
