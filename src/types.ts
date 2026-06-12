export type ObstacleType =
  | 'WOOD_BARRICADE'
  | 'SCRAP_CAR'
  | 'IRON_GIRDER'
  | 'CONCRETE_BLOCK'
  | 'SPIKED_WALL'
  | 'MINE'
  | 'WATER_JUG'
  | 'COWCATCHER';

export interface Obstacle {
  id: string;
  type: ObstacleType;
  lane: number;
  y: number; // Y coordinate on the screen
  xOffset: number; // subtle variance within lane
  width: number;
  height: number;
  smashed: boolean;
  scoreAwarded: boolean;
  angle: number; // for smash rotation effect
  spinDirection: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotSpeed: number;
  shape: 'circle' | 'square' | 'line';
}

export interface RoadSceneObject {
  id: string;
  xSide: 'left' | 'right';
  xOffset: number; // offset from road edge
  y: number;
  type: 'POLE' | 'RUIN_TOWER' | 'DEAD_TREE' | 'DUNE' | 'ROCK';
  scale: number;
}

export interface GameState {
  distance: number; // distance in meters
  scrap: number; // scrap material collected
  multiplier: number; // score multiplier
  multiplierTimer: number; // time left before multiplier resets
  overheat: number; // 0 to 100
  speed: number; // current velocity
  targetSpeed: number; // speed truck wants to reach (braking alters this)
  lane: number; // target lane index 0, 1, 2
  truckX: number; // actual visual horizontal position of truck
  cowcatcherTimer: number; // remaining shield duration in ms
  isGameOver: boolean; // game is done
  gameOverReason: 'OVERHEAT' | 'CRASH' | null;
  highScore: number;
  highDistance: number;
  isPaused: boolean;
  dayTime: number; // 0 to 1 cycle
  dustStormTime: number; // dynamic timer
  isDustStorm: boolean;
  stormIntensity: number;
}
