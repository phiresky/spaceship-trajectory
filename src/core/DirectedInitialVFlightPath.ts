import { Vec2 } from './Vec2';
import { FlightPath } from './FlightPath';
import { BreakFlightPath } from './BreakFlightPath';
import { LineFlightPath } from './LineFlightPath';
import { combinePath } from '../utils/pathCombiner';

/**
 * Handles flight paths with a specific initial velocity in a given direction
 */
export class DirectedInitialVFlightPath extends FlightPath {
    private readonly implementation: FlightPath;

    constructor(p_start: Vec2, p_end: Vec2, a_max: number, initial_v: number) {
        super();
        if (!(p_start instanceof Vec2)) throw new Error('p_start must be Vec2');
        if (!(p_end instanceof Vec2)) throw new Error('p_end must be Vec2');
        if (typeof a_max !== 'number' || a_max <= 0) {
            throw new Error('a_max must be positive number');
        }
        if (typeof initial_v !== 'number') throw new Error('initial_v must be number');

        const dd = p_end.sub(p_start);
        const distance = dd.length();
        
        if (distance === 0) {
            this.implementation = new BreakFlightPath(p_start, a_max, new Vec2(initial_v, 0));
            this.t_max = this.implementation.getMaxTime();
            return;
        }

        const direction = dd.div(distance);
        const break_path = new BreakFlightPath(p_start, a_max, direction.mul(initial_v));
        
        if (initial_v < 0 || break_path.getDistanceToBreak() > distance) {
            const final_path = new LineFlightPath(break_path.getEndPosition(), p_end, a_max);
            this.implementation = combinePath(break_path, final_path);
            this.t_max = this.implementation.getMaxTime();
        } else {
            const fictive_start = p_start.sub(direction.mul(break_path.getDistanceToBreak()));
            const time_to_initial_v = break_path.getTimeToBreak();
            const actual_path = new LineFlightPath(fictive_start, p_end, a_max);
            this.implementation = actual_path;
            this.t_max = actual_path.getMaxTime() - time_to_initial_v;
        }
    }

    rocketPosition(t: number): Vec2 {
        return this.implementation.rocketPosition(t);
    }

    rocketVelocity(t: number): Vec2 {
        return this.implementation.rocketVelocity(t);
    }
}
