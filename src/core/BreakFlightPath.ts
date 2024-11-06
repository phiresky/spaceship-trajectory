import { Vec2 } from './Vec2';
import { FlightPath } from './FlightPath';

/**
 * Handles the breaking phase of the flight path
 */
export class BreakFlightPath extends FlightPath {
    private readonly time_to_break: number;
    private readonly dist_to_break: number;
    private readonly norm: Vec2;
    private readonly p_end: Vec2;
    private readonly a_max: number;

    constructor(p_start: Vec2, a_max: number, initial_v: Vec2) {
        super();
        if (!(p_start instanceof Vec2)) throw new Error('p_start must be Vec2');
        if (!(initial_v instanceof Vec2)) throw new Error('initial_v must be Vec2');
        if (typeof a_max !== 'number' || a_max <= 0) {
            throw new Error('a_max must be positive number');
        }

        this.time_to_break = initial_v.length() / a_max;
        this.dist_to_break = 0.5 * a_max * this.time_to_break * this.time_to_break;
        this.norm = initial_v.normOrZero();
        this.p_end = p_start.add(this.norm.mul(this.dist_to_break));
        this.t_max = this.time_to_break;
        this.a_max = a_max;
    }

    rocketPosition(t: number): Vec2 {
        if (t < 0) throw new Error('Time cannot be negative');
        
        if (t <= this.time_to_break) {
            const remaining = this.time_to_break - t;
            return this.p_end.sub(this.norm.mul(0.5 * this.a_max * remaining * remaining));
        }
        return this.p_end;
    }

    rocketVelocity(t: number): Vec2 {
        if (t < 0) throw new Error('Time cannot be negative');
        
        if (t <= this.time_to_break) {
            const remaining = this.time_to_break - t;
            return this.norm.mul(this.a_max * remaining);
        }
        return Vec2.zero;
    }

    /**
     * Gets the end position of this breaking path
     */
    getEndPosition(): Vec2 {
        return this.p_end;
    }

    /**
     * Gets the time required to break
     */
    getTimeToBreak(): number {
        return this.time_to_break;
    }

    /**
     * Gets the distance required to break
     */
    getDistanceToBreak(): number {
        return this.dist_to_break;
    }
}
