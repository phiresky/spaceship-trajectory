/**
 * Vector2D class for handling 2D vector operations
 */
class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mul(s) { return new Vec2(this.x * s, this.y * s); }
    div(s) { return new Vec2(this.x / s, this.y / s); }
    
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    
    norm() { return this.div(this.length()); }
    
    normOrZero() {
        const l = this.length();
        return l === 0 ? Vec2.zero : this.div(l);
    }
    
    dot(v) { return this.x * v.x + this.y * v.y; }
    cross(v) { return this.x * v.y - this.y * v.x; }
    
    equals(v) { return this.x === v.x && this.y === v.y; }

    static get zero() { return new Vec2(0, 0); }
}

/**
 * Base class for different flight path calculations
 */
class FlightPath {
    constructor() {
        this.t_max = 0;
    }

    rocketPosition(t) { throw new Error('Not implemented'); }
    rocketVelocity(t) { throw new Error('Not implemented'); }
}

/**
 * Handles the breaking phase of the flight path
 */
class BreakFlightPath extends FlightPath {
    constructor(p_start, a_max, initial_v) {
        super();
        this.time_to_break = initial_v.length() / a_max;
        this.dist_to_break = 0.5 * a_max * this.time_to_break * this.time_to_break;
        this.norm = initial_v.normOrZero();
        this.p_end = p_start.add(this.norm.mul(this.dist_to_break));
        this.t_max = this.time_to_break;
        this.a_max = a_max;
    }

    rocketPosition(t) {
        if (t <= this.time_to_break) {
            const remaining = this.time_to_break - t;
            return this.p_end.sub(this.norm.mul(0.5 * this.a_max * remaining * remaining));
        }
        return this.p_end;
    }

    rocketVelocity(t) {
        if (t <= this.time_to_break) {
            const remaining = this.time_to_break - t;
            return this.norm.mul(this.a_max * remaining);
        }
        return Vec2.zero;
    }
}

/**
 * Handles straight line flight paths with acceleration and deceleration phases
 */
class LineFlightPath extends FlightPath {
    constructor(p_start, p_end, a_max) {
        super();
        this.p_start = p_start;
        this.p_end = p_end;
        this.a_max = a_max;

        const dd = p_end.sub(p_start);
        this.distance = dd.length();
        this.direction = dd.div(this.distance);
        this.t_max = 2 * Math.sqrt(this.distance / a_max);
    }

    rocketPosition(t) {
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

    rocketVelocity(t) {
        if (t <= this.t_max / 2) {
            return this.direction.mul(this.a_max * t);
        } else if (t <= this.t_max) {
            const t_decel = t - this.t_max / 2;
            return this.direction.mul(this.a_max * (this.t_max / 2 - t_decel));
        }
        return Vec2.zero;
    }
}

/**
 * Combines multiple flight paths into a single continuous path
 */
function combinePath(path1, path2) {
    const combined = new FlightPath();
    combined.t_max = path1.t_max + path2.t_max;
    
    combined.rocketPosition = function(t) {
        if (t <= path1.t_max) {
            return path1.rocketPosition(t);
        }
        return path2.rocketPosition(t - path1.t_max);
    };
    
    combined.rocketVelocity = function(t) {
        if (t <= path1.t_max) {
            return path1.rocketVelocity(t);
        }
        return path2.rocketVelocity(t - path1.t_max);
    };
    
    return combined;
}

/**
 * Handles flight paths with a specific initial velocity in a given direction
 */
class DirectedInitialVFlightPath extends FlightPath {
    constructor(p_start, p_end, a_max, initial_v) {
        super();
        const dd = p_end.sub(p_start);
        const distance = dd.length();
        const direction = dd.div(distance);

        const break_path = new BreakFlightPath(p_start, a_max, direction.mul(initial_v));
        
        if (initial_v < 0 || break_path.dist_to_break > distance) {
            const final_path = new LineFlightPath(break_path.p_end, p_end, a_max);
            const combined = combinePath(break_path, final_path);
            this.t_max = combined.t_max;
            this.rocketPosition = combined.rocketPosition;
            this.rocketVelocity = combined.rocketVelocity;
        } else {
            const fictive_start = p_start.sub(direction.mul(break_path.dist_to_break));
            const time_to_initial_v = break_path.time_to_break;
            const actual_path = new LineFlightPath(fictive_start, p_end, a_max);
            this.t_max = actual_path.t_max - time_to_initial_v;
            this.rocketPosition = t => actual_path.rocketPosition(t + time_to_initial_v);
            this.rocketVelocity = t => actual_path.rocketVelocity(t + time_to_initial_v);
        }
    }
}

/**
 * Handles flight paths with any initial velocity vector
 */
class InitialVFlightPath extends FlightPath {
    constructor(p_start, p_end, a_max, v0) {
        super();
        const dd = p_end.sub(p_start);
        const direction = dd.div(dd.length());

        // Decompose initial velocity into parallel and perpendicular components
        const v0_parallel_len = v0.dot(direction);
        const v0_parallel = direction.mul(v0_parallel_len);
        const v0_perp = v0.sub(v0_parallel);
        const v0_perp_len = v0_perp.length();

        if (v0_perp_len === 0) {
            // If no perpendicular component, use simpler directed path
            const path = new DirectedInitialVFlightPath(p_start, p_end, a_max, v0_parallel_len);
            this.t_max = path.t_max;
            this.rocketPosition = path.rocketPosition.bind(path);
            this.rocketVelocity = path.rocketVelocity.bind(path);
            return;
        }

        const v0_perp_direction = v0_perp.div(v0_perp_len);

        // First cancel perpendicular velocity
        const v0_cancel_path = new BreakFlightPath(p_start, a_max, v0_perp);
        const time_to_cancel_v0 = v0_cancel_path.t_max;

        const cancel_pos = t => v0_cancel_path.rocketPosition(t).add(v0_parallel.mul(t));
        const pos_after_cancel_v0 = cancel_pos(time_to_cancel_v0);

        // Calculate alignment phase
        const align_pos = t => pos_after_cancel_v0
            .add(v0_parallel.mul(t))
            .sub(v0_perp_direction.mul(0.5 * a_max * t * t));
            
        const align_vel = t => v0_parallel.sub(v0_perp_direction.mul(a_max * t));

        // Calculate time needed to align velocity with target direction
        const time_to_align = this.calculateAlignmentTime(p_end, pos_after_cancel_v0, 
            v0_parallel_len, direction, v0_perp_direction, a_max);

        if (time_to_align === undefined) {
            // If alignment impossible, break completely and use direct path
            const full_break_path = new BreakFlightPath(p_start, a_max, v0);
            const final_path = new LineFlightPath(full_break_path.p_end, p_end, a_max);
            const combined = combinePath(full_break_path, final_path);
            this.t_max = combined.t_max;
            this.rocketPosition = combined.rocketPosition;
            this.rocketVelocity = combined.rocketVelocity;
        } else {
            const pos_after_align = align_pos(time_to_align);
            const vel_after_align = align_vel(time_to_align);
            const final_path = new DirectedInitialVFlightPath(
                pos_after_align, p_end, a_max, vel_after_align.length()
            );

            this.t_max = time_to_cancel_v0 + time_to_align + final_path.t_max;
            
            this.rocketPosition = t => {
                if (t <= time_to_cancel_v0) {
                    return cancel_pos(t);
                } else if (t <= time_to_cancel_v0 + time_to_align) {
                    return align_pos(t - time_to_cancel_v0);
                }
                return final_path.rocketPosition(t - time_to_cancel_v0 - time_to_align);
            };
            
            this.rocketVelocity = t => {
                if (t <= time_to_cancel_v0) {
                    return v0_cancel_path.rocketVelocity(t).add(v0_parallel);
                } else if (t <= time_to_cancel_v0 + time_to_align) {
                    return align_vel(t - time_to_cancel_v0);
                }
                return final_path.rocketVelocity(t - time_to_cancel_v0 - time_to_align);
            };
        }
    }

    calculateAlignmentTime(p_end, pos_after_cancel_v0, v0_parallel_len, u, v0_perp_u, a_max) {
        if (v0_parallel_len === 0) return undefined;

        const changeBase = v => new Vec2(v.dot(u), v.dot(v0_perp_u));
        const start = changeBase(pos_after_cancel_v0);
        const end = changeBase(p_end).sub(start);

        const inner = Math.pow(a_max * end.x, 2) + 
                     2 * a_max * v0_parallel_len * v0_parallel_len * end.y;
        
        if (inner < 0) return undefined;

        const q = ((-a_max * end.x) + Math.sqrt(inner)) / (-a_max * v0_parallel_len);
        const x = v0_parallel_len * q;
        
        return (q < 0 || x < 0) ? undefined : q;
    }
}

// Export classes for use in main.js
export {
    Vec2,
    FlightPath,
    BreakFlightPath,
    LineFlightPath,
    DirectedInitialVFlightPath,
    InitialVFlightPath
};
