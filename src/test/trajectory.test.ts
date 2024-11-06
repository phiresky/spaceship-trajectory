import { 
    Vec2, 
    LineFlightPath, 
    BreakFlightPath, 
    DirectedInitialVFlightPath, 
    InitialVFlightPath 
} from '../core';

// Vec2 Tests
describe('Vec2', () => {
    test('constructor validates input', () => {
        expect(() => new Vec2('1' as any, 2)).toThrow('Vec2 coordinates must be numbers');
        expect(() => new Vec2(1, NaN)).toThrow('Vec2 coordinates must be finite numbers');
        expect(() => new Vec2(1, Infinity)).toThrow('Vec2 coordinates must be finite numbers');
    });

    test('basic vector operations', () => {
        const v1 = new Vec2(1, 2);
        const v2 = new Vec2(3, 4);
        
        expect(v1.add(v2)).toEqual(new Vec2(4, 6));
        expect(v1.sub(v2)).toEqual(new Vec2(-2, -2));
        expect(v1.mul(2)).toEqual(new Vec2(2, 4));
        expect(v1.div(2)).toEqual(new Vec2(0.5, 1));
    });

    test('vector products', () => {
        const v1 = new Vec2(1, 0);
        const v2 = new Vec2(0, 1);
        
        expect(v1.dot(v2)).toBe(0);
        expect(v1.cross(v2)).toBe(1);
    });

    test('normalization', () => {
        const v = new Vec2(3, 4);
        const norm = v.norm();
        expect(norm.length()).toBeCloseTo(1);
    });
});

// Flight Path Tests
describe('Flight Paths', () => {
    const p_start = new Vec2(0, 0);
    const p_end = new Vec2(100, 0);
    const a_max = 10;

    test('LineFlightPath basic properties', () => {
        const path = new LineFlightPath(p_start, p_end, a_max);
        expect(path.getMaxTime()).toBeGreaterThan(0);
        expect(path.rocketPosition(0)).toEqual(p_start);
        expect(path.rocketPosition(path.getMaxTime())).toEqual(p_end);
    });

    test('BreakFlightPath deceleration', () => {
        const initial_v = new Vec2(10, 0);
        const path = new BreakFlightPath(p_start, a_max, initial_v);
        expect(path.rocketVelocity(0).length()).toBeCloseTo(10);
        expect(path.rocketVelocity(path.getMaxTime()).length()).toBeCloseTo(0);
    });

    test('DirectedInitialVFlightPath trajectory', () => {
        const path = new DirectedInitialVFlightPath(p_start, p_end, a_max, 5);
        const mid_time = path.getMaxTime() / 2;
        const mid_pos = path.rocketPosition(mid_time);
        expect(mid_pos.x).toBeGreaterThan(0);
        expect(mid_pos.x).toBeLessThan(100);
    });

    test('InitialVFlightPath with perpendicular velocity', () => {
        const initial_v = new Vec2(0, 10);
        const path = new InitialVFlightPath(p_start, p_end, a_max, initial_v);
        const final_vel = path.rocketVelocity(path.getMaxTime());
        expect(final_vel.length()).toBeCloseTo(0);
        const final_pos = path.rocketPosition(path.getMaxTime());
        expect(final_pos.x).toBeCloseTo(p_end.x);
        expect(final_pos.y).toBeCloseTo(p_end.y);
    });

    test('InitialVFlightPath with zero distance', () => {
        const initial_v = new Vec2(5, 5);
        const path = new InitialVFlightPath(p_start, p_start, a_max, initial_v);
        const final_pos = path.rocketPosition(path.getMaxTime());
        expect(final_pos.x).toBeCloseTo(p_start.x);
        expect(final_pos.y).toBeCloseTo(p_start.y);
        expect(path.rocketVelocity(path.getMaxTime()).length()).toBeCloseTo(0);
    });

    test('InitialVFlightPath with impossible alignment', () => {
        const p_end = new Vec2(1, 0);
        const initial_v = new Vec2(0, 100);  // Very high perpendicular velocity
        const path = new InitialVFlightPath(p_start, p_end, a_max, initial_v);
        const final_pos = path.rocketPosition(path.getMaxTime());
        expect(final_pos.x).toBeCloseTo(p_end.x);
        expect(final_pos.y).toBeCloseTo(p_end.y);
        expect(path.rocketVelocity(path.getMaxTime()).length()).toBeCloseTo(0);
    });
});
