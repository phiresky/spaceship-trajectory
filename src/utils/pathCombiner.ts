import { Vec2 } from '../core/Vec2';
import { FlightPath } from '../core/FlightPath';

/**
 * Combines multiple flight paths into a single continuous path
 */
export function combinePath(path1: FlightPath, path2: FlightPath): FlightPath {
    if (!(path1 instanceof FlightPath)) throw new Error('path1 must be FlightPath');
    if (!(path2 instanceof FlightPath)) throw new Error('path2 must be FlightPath');

    const combined = new class extends FlightPath {
        constructor() {
            super();
            this.t_max = path1.getMaxTime() + path2.getMaxTime();
        }

        rocketPosition(t: number): Vec2 {
            if (t < 0) throw new Error('Time cannot be negative');
            
            if (t <= path1.getMaxTime()) {
                return path1.rocketPosition(t);
            }
            return path2.rocketPosition(t - path1.getMaxTime());
        }
        
        rocketVelocity(t: number): Vec2 {
            if (t < 0) throw new Error('Time cannot be negative');
            
            if (t <= path1.getMaxTime()) {
                return path1.rocketVelocity(t);
            }
            return path2.rocketVelocity(t - path1.getMaxTime());
        }
    };
    
    return combined;
}
