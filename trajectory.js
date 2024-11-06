/**
 * Vector2D class for handling 2D vector operations
 */
class Vec2 {
    constructor(x, y) {
        // Input validation
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('Vec2 coordinates must be numbers');
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error('Vec2 coordinates must be finite numbers');
        }
        this.x = x;
        this.y = y;
    }

    add(v) { 
        if (!(v instanceof Vec2)) throw new Error('Can only add Vec2 instances');
        return new Vec2(this.x + v.x, this.y + v.y); 
    }
    
    sub(v) { 
        if (!(v instanceof Vec2)) throw new Error('Can only subtract Vec2 instances');
        return new Vec2(this.x - v.x, this.y - v.y); 
    }
    
    mul(s) { 
        if (typeof s !== 'number') throw new Error('Can only multiply by number');
        return new Vec2(this.x * s, this.y * s); 
    }
    
    div(s) { 
        if (typeof s !== 'number') throw new Error('Can only divide by number');
        if (s === 0) throw new Error('Division by zero');
        return new Vec2(this.x / s, this.y / s); 
    }
    
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    
    norm() { 
        const len = this.length();
        if (len === 0) throw new Error('Cannot normalize zero vector');
        return this.div(len); 
    }
    
    normOrZero() {
        const l = this.length();
        return l === 0 ? Vec2.zero : this.div(l);
    }
    
    dot(v) { 
        if (!(v instanceof Vec2)) throw new Error('Can only dot product with Vec2');
        return this.x * v.x + this.y * v.y; 
    }
    
    cross(v) { 
        if (!(v instanceof Vec2)) throw new Error('Can only cross product with Vec2');
        return this.x * v.y - this.y * v.x; 
    }
    
    equals(v) { 
        if (!(v instanceof Vec2)) return false;
        return this.x === v.x && this.y === v.y; 
    }

    static get zero() { return new Vec2(0, 0); }

    // Added method for serialization
    toJSON() {
        return { x: this.x, y: this.y };
    }

    // Added method for creating Vec2 from object
    static fromJSON(obj) {
        if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number') {
            throw new Error('Invalid JSON format for Vec2');
        }
        return new Vec2(obj.x, obj.y);
    }
}

/**
 * Base class for different flight path calculations
 */
class FlightPath {
    constructor() {
        this.t_max = 0;
        this._cachedPoints = null;
        this._cacheResolution = 50;
    }

    rocketPosition(t) { throw new Error('Not implemented'); }
    rocketVelocity(t) { throw new Error('Not implemented'); }

    // Performance optimization: Cache trajectory points
    getCachedPoints() {
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

    // Get interpolated state at any time
    getStateAtTime(t) {
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

/**
 * Handles the breaking phase of the flight path
 */
class BreakFlightPath extends FlightPath {
    constructor(p_start, a_max, initial_v) {
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

    rocketPosition(t) {
        if (t < 0) throw new Error('Time cannot be negative');
        
        if (t <= this.time_to_break) {
            const remaining = this.time_to_break - t;
            return this.p_end.sub(this.norm.mul(0.5 * this.a_max * remaining * remaining));
        }
        return this.p_end;
    }

    rocketVelocity(t) {
        if (t < 0) throw new Error('Time cannot be negative');
        
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

    rocketPosition(t) {
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

    rocketVelocity(t) {
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
}

/**
 * Combines multiple flight paths into a single continuous path
 */
function combinePath(path1, path2) {
    if (!(path1 instanceof FlightPath)) throw new Error('path1 must be FlightPath');
    if (!(path2 instanceof FlightPath)) throw new Error('path2 must be FlightPath');

    const combined = new FlightPath();
    combined.t_max = path1.t_max + path2.t_max;
    
    combined.rocketPosition = function(t) {
        if (t < 0) throw new Error('Time cannot be negative');
        
        if (t <= path1.t_max) {
            return path1.rocketPosition(t);
        }
        return path2.rocketPosition(t - path1.t_max);
    };
    
    combined.rocketVelocity = function(t) {
        if (t < 0) throw new Error('Time cannot be negative');
        
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
        if (!(p_start instanceof Vec2)) throw new Error('p_start must be Vec2');
        if (!(p_end instanceof Vec2)) throw new Error('p_end must be Vec2');
        if (typeof a_max !== 'number' || a_max <= 0) {
            throw new Error('a_max must be positive number');
        }
        if (typeof initial_v !== 'number') throw new Error('initial_v must be number');

        const dd = p_end.sub(p_start);
        const distance = dd.length();
        
        if (distance === 0) {
            const break_path = new BreakFlightPath(p_start, a_max, new Vec2(initial_v, 0));
            this.t_max = break_path.t_max;
            this.rocketPosition = break_path.rocketPosition.bind(break_path);
            this.rocketVelocity = break_path.rocketVelocity.bind(break_path);
            return;
        }

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
        if (!(p_start instanceof Vec2)) throw new Error('p_start must be Vec2');
        if (!(p_end instanceof Vec2)) throw new Error('p_end must be Vec2');
        if (typeof a_max !== 'number' || a_max <= 0) {
            throw new Error('a_max must be positive number');
        }
        if (!(v0 instanceof Vec2)) throw new Error('v0 must be Vec2');

        const dd = p_end.sub(p_start);
        if (dd.length() === 0) {
            const break_path = new BreakFlightPath(p_start, a_max, v0);
            this.t_max = break_path.t_max;
            this.rocketPosition = break_path.rocketPosition.bind(break_path);
            this.rocketVelocity = break_path.rocketVelocity.bind(break_path);
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
                if (t < 0) throw new Error('Time cannot be negative');
                
                if (t <= time_to_cancel_v0) {
                    return cancel_pos(t);
                } else if (t <= time_to_cancel_v0 + time_to_align) {
                    return align_pos(t - time_to_cancel_v0);
                }
                return final_path.rocketPosition(t - time_to_cancel_v0 - time_to_align);
            };
            
            this.rocketVelocity = t => {
                if (t < 0) throw new Error('Time cannot be negative');
                
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
