import { Vector2D } from '../types/vectors';

/**
 * 2D Vector class for handling vector operations
 */
export class Vec2 implements Vector2D {
    constructor(
        public readonly x: number,
        public readonly y: number
    ) {
        if (typeof x !== 'number' || typeof y !== 'number') {
            throw new Error('Vec2 coordinates must be numbers');
        }
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error('Vec2 coordinates must be finite numbers');
        }
    }

    add(v: Vec2): Vec2 { 
        if (!(v instanceof Vec2)) throw new Error('Can only add Vec2 instances');
        return new Vec2(this.x + v.x, this.y + v.y); 
    }
    
    sub(v: Vec2): Vec2 { 
        if (!(v instanceof Vec2)) throw new Error('Can only subtract Vec2 instances');
        return new Vec2(this.x - v.x, this.y - v.y); 
    }
    
    mul(s: number): Vec2 { 
        if (typeof s !== 'number') throw new Error('Can only multiply by number');
        return new Vec2(this.x * s, this.y * s); 
    }
    
    div(s: number): Vec2 { 
        if (typeof s !== 'number') throw new Error('Can only divide by number');
        if (s === 0) throw new Error('Division by zero');
        return new Vec2(this.x / s, this.y / s); 
    }
    
    length(): number { 
        return Math.sqrt(this.x * this.x + this.y * this.y); 
    }
    
    norm(): Vec2 { 
        const len = this.length();
        if (len === 0) throw new Error('Cannot normalize zero vector');
        return this.div(len); 
    }
    
    normOrZero(): Vec2 {
        const l = this.length();
        return l === 0 ? Vec2.zero : this.div(l);
    }
    
    dot(v: Vec2): number { 
        if (!(v instanceof Vec2)) throw new Error('Can only dot product with Vec2');
        return this.x * v.x + this.y * v.y; 
    }
    
    cross(v: Vec2): number { 
        if (!(v instanceof Vec2)) throw new Error('Can only cross product with Vec2');
        return this.x * v.y - this.y * v.x; 
    }
    
    equals(v: Vec2): boolean { 
        if (!(v instanceof Vec2)) return false;
        return this.x === v.x && this.y === v.y; 
    }

    static get zero(): Vec2 { 
        return new Vec2(0, 0); 
    }

    toJSON(): Vector2D {
        return { x: this.x, y: this.y };
    }

    static fromJSON(obj: Vector2D): Vec2 {
        if (!obj || typeof obj.x !== 'number' || typeof obj.y !== 'number') {
            throw new Error('Invalid JSON format for Vec2');
        }
        return new Vec2(obj.x, obj.y);
    }
}
