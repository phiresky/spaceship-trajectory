import { Vec2 } from '../core/Vec2';

export interface Vector2D {
    x: number;
    y: number;
}

export interface TrajectoryState {
    position: Vec2;  // Changed from Vector2D to Vec2
    velocity: Vec2;  // Changed from Vector2D to Vec2
    time: number;
}

export interface TrajectoryMetadata {
    startPosition: Vec2;  // Changed from Vector2D to Vec2
    endPosition: Vec2;    // Changed from Vector2D to Vec2
    maxAcceleration: number;
    totalTime: number;
    method: string;
}

export interface TrajectoryData {
    metadata: TrajectoryMetadata;
    points: TrajectoryState[];
}
