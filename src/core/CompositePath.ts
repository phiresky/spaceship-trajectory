import { Vec2 } from './Vec2.js';
import { FlightPath } from './FlightPath.js';

/**
 * A flight path composed of multiple phases with custom position and velocity calculations
 */
export class CompositePath extends FlightPath {
    constructor(
        maxTime: number,
        private readonly positionFn: (t: number) => Vec2,
        private readonly velocityFn: (t: number) => Vec2
    ) {
        super();
        this.t_max = maxTime;
    }

    rocketPosition(t: number): Vec2 {
        return this.positionFn(t);
    }

    rocketVelocity(t: number): Vec2 {
        return this.velocityFn(t);
    }
}
