// Global tuning constants for Palma Verde: Sun & Crime.

export const TILE = 40;              // world pixels per tile
export const CITY_W = 64;            // city width in tiles
export const CITY_H = 64;            // city height in tiles
export const WORLD_W = CITY_W * TILE;
export const WORLD_H = CITY_H * TILE;

// Roads form a grid: every 6th tile (and the one after it) is asphalt.
export const ROAD_PERIOD = 6;
export const ROAD_WIDTH = 2;         // tiles of asphalt per road
export const LANE_OFFSET = 20;       // px from road centre to a lane's centre

export const BEACH_START = 56;       // tiles east of this are sand, then water

export const PLAYER_WALK = 150;      // px/s on foot
export const PLAYER_SPRINT = 240;
export const PLAYER_RADIUS = 9;

export const CAR_ACCEL = 340;
export const CAR_BRAKE = 620;
export const CAR_MAX = 330;          // px/s civilian top speed
export const CAR_MAX_SPORT = 430;
export const CAR_FRICTION = 0.995;
export const CAR_TURN = 2.6;         // rad/s at full lock, scaled by speed

export const WANTED_DECAY = 0.045;   // stars lost per second once hidden
export const WANTED_TIME = 7;        // seconds without police line of sight before decay
export const COP_SPAWN_INTERVAL = 4.5; // seconds between police spawns per star

export const MISSION_REWARD = [250, 400, 550, 700, 900];

export const COLORS = {
  asphalt: '#3a3d44',
  asphaltLight: '#45484f',
  lane: '#c9b458',
  sidewalk: '#9a9186',
  sidewalkEdge: '#7d766d',
  sand: '#e8d8a0',
  water: '#2a9db5',
  waterDeep: '#1f7f98',
  grass: '#6aa84f',
  night: 'rgba(255, 190, 110, 0.10)', // warm sun tint over everything
};

export const BUILDING_PALETTE = [
  '#d9b38c', '#c96f5a', '#e0d3b8', '#b56576', '#e3a857',
  '#8fb8a8', '#d38f76', '#a4859e', '#cbd2a4', '#e2b6a0',
];

export const CAR_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#e67e22',
  '#8e44ad', '#16a085', '#d35400', '#ecf0f1', '#34495e',
];

export const PED_COLORS = [
  '#e8c39e', '#c68642', '#8d5524', '#ffdbac', '#a06b3c',
];
export const SHIRT_COLORS = [
  '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#3498db',
  '#e91e63', '#1abc9c', '#f5f5f5', '#2c3e50',
];

export const VIEW_W = 1280;
export const VIEW_H = 720;
