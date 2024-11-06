import { Vec2 } from './Vec2';
import { FlightPath } from './FlightPath';
import { BreakFlightPath } from './BreakFlightPath';
import { DirectedInitialVFlightPath } from './DirectedInitialVFlightPath';
import { CompositePath } from './CompositePath';
import { combinePath } from '../utils/pathCombiner';

/**
 * Handles flight paths with any initial velocity vector
 */
export class InitialVFlightPath extends FlightPath {
    private readonly implementation: FlightPath;

    constructor(p_start: Vec2, p_end: Vec2, a_max: number, v0: Vec2) {
        super();
        if (!(p_start instanceof Vec2)) throw new Error('p_start must be Vec2');
        if (!(p_end instanceof Vec2)) throw new Error('p_end must be Vec2');
        if (typeof a_max !== 'number' || a_max <= 0) {
            throw new Error('a_max must be positive number');
        }
        if (!(v0 instanceof Vec2)) throw new Error('v0 must be Vec2');

        const dd = p_end.sub(p_start);
        if (dd.length() === 0) {
            // For zero distance, just break to a stop at the start position
            const break_path = new BreakFlightPath(p_start, a_max, v0);
            this.implementation = new CompositePath(
                break_path.getMaxTime(),
                (t: number): Vec2 => {
                    if (t < 0) throw new Error('Time cannot be negative');
                    const pos = break_path.rocketPosition(t);
                    // Ensure we stay at the start position
                    return t >= break_path.getMaxTime() ? p_start : pos;
                },
                (t: number): Vec2 => break_path.rocketVelocity(t)
            );
            this.t_max = break_path.getMaxTime();
            return;
        }

        const direction = dd.div(dd.length());

        // Decompose initial velocity into parallel and perpendicular components
        const v0_parallel_len = v0.dot(direction);
        const v0_parallel = direction.mul(v0_parallel_len);
        const v0_perp = v0.sub(v0_parallel);
        const v0_perp_len = v0_perp.length();

        if (v0_perp_len === 0) {
            // If no perpendicular component, use simpler directed path
            this.implementation = new DirectedInitialVFlightPath(p_start, p_end, a_max, v0_parallel_len);
            this.t_max = this.implementation.getMaxTime();
            return;
        }

        const v0_perp_direction = v0_perp.div(v0_perp_len);

        // First cancel perpendicular velocity
        const v0_cancel_path = new BreakFlightPath(p_start, a_max, v0_perp);
        const time_to_cancel_v0 = v0_cancel_path.getTimeToBreak();

        // Calculate alignment phase
        const pos_after_cancel = this.calculatePositionAfterCancel(
            v0_cancel_path, 
            v0_parallel, 
            time_to_cancel_v0
        );

        const time_to_align = this.calculateAlignmentTime(
            p_end,
            pos_after_cancel,
            v0_parallel_len,
            direction,
            v0_perp_direction,
            a_max
        );

        if (time_to_align === undefined) {
            // If alignment impossible, break completely and use direct path
            const full_break_path = new BreakFlightPath(p_start, a_max, v0);
            const final_path = new DirectedInitialVFlightPath(
                full_break_path.getEndPosition(), 
                p_end, 
                a_max, 
                0
            );
            this.implementation = combinePath(full_break_path, final_path);
            this.t_max = this.implementation.getMaxTime();
        } else {
            // We know time_to_align is defined here
            const alignTime: number = time_to_align;
            
            const pos_after_align = this.calculatePositionAfterAlign(
                v0_cancel_path.getEndPosition(),
                v0_parallel,
                v0_perp_direction,
                a_max,
                alignTime
            );
            const vel_after_align = this.calculateVelocityAfterAlign(
                v0_parallel,
                v0_perp_direction,
                a_max,
                alignTime
            );

            const final_path = new DirectedInitialVFlightPath(
                pos_after_align,
                p_end,
                a_max,
                vel_after_align.length()
            );

            const totalTime = time_to_cancel_v0 + alignTime + final_path.getMaxTime();

            // Create a composite path that handles all phases
            this.implementation = new CompositePath(
                totalTime,
                (t: number): Vec2 => {
                    if (t < 0) throw new Error('Time cannot be negative');
                    
                    if (t <= time_to_cancel_v0) {
                        return v0_cancel_path.rocketPosition(t)
                            .add(v0_parallel.mul(t));
                    } else if (t <= time_to_cancel_v0 + alignTime) {
                        const align_t = t - time_to_cancel_v0;
                        return v0_cancel_path.getEndPosition()
                            .add(v0_parallel.mul(align_t))
                            .sub(v0_perp_direction.mul(0.5 * a_max * align_t * align_t));
                    }
                    return final_path.rocketPosition(t - time_to_cancel_v0 - alignTime);
                },
                (t: number): Vec2 => {
                    if (t < 0) throw new Error('Time cannot be negative');
                    
                    if (t <= time_to_cancel_v0) {
                        return v0_cancel_path.rocketVelocity(t).add(v0_parallel);
                    } else if (t <= time_to_cancel_v0 + alignTime) {
                        const align_t = t - time_to_cancel_v0;
                        return v0_parallel.sub(v0_perp_direction.mul(a_max * align_t));
                    }
                    return final_path.rocketVelocity(t - time_to_cancel_v0 - alignTime);
                }
            );

            this.t_max = totalTime;
        }
    }

    private calculatePositionAfterCancel(
        cancelPath: BreakFlightPath,
        v0_parallel: Vec2,
        time: number
    ): Vec2 {
        return cancelPath.getEndPosition().add(v0_parallel.mul(time));
    }

    private calculatePositionAfterAlign(
        startPos: Vec2,
        v0_parallel: Vec2,
        v0_perp_direction: Vec2,
        a_max: number,
        time: number
    ): Vec2 {
        return startPos
            .add(v0_parallel.mul(time))
            .sub(v0_perp_direction.mul(0.5 * a_max * time * time));
    }

    private calculateVelocityAfterAlign(
        v0_parallel: Vec2,
        v0_perp_direction: Vec2,
        a_max: number,
        time: number
    ): Vec2 {
        return v0_parallel.sub(v0_perp_direction.mul(a_max * time));
    }

    private calculateAlignmentTime(
        p_end: Vec2,
        pos_after_cancel_v0: Vec2,
        v0_parallel_len: number,
        u: Vec2,
        v0_perp_u: Vec2,
        a_max: number
    ): number | undefined {
        if (v0_parallel_len === 0) return undefined;

        const changeBase = (v: Vec2) => new Vec2(v.dot(u), v.dot(v0_perp_u));
        const start = changeBase(pos_after_cancel_v0);
        const end = changeBase(p_end).sub(start);

        const inner = Math.pow(a_max * end.x, 2) + 
                     2 * a_max * v0_parallel_len * v0_parallel_len * end.y;
        
        if (inner < 0) return undefined;

        const q = ((-a_max * end.x) + Math.sqrt(inner)) / (-a_max * v0_parallel_len);
        const x = v0_parallel_len * q;
        
        return (q < 0 || x < 0) ? undefined : q;
    }

    rocketPosition(t: number): Vec2 {
        return this.implementation.rocketPosition(t);
    }

    rocketVelocity(t: number): Vec2 {
        return this.implementation.rocketVelocity(t);
    }
}
