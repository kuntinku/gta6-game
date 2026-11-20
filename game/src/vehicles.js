// Vehicles: traffic AI on the road grid, drivable physics for the player and
// police, collisions with buildings and each other, damage and explosions.

import {
  TILE, CITY_W, CITY_H, WORLD_W, WORLD_H, ROAD_PERIOD, ROAD_WIDTH,
  CAR_ACCEL, CAR_BRAKE, CAR_MAX, CAR_MAX_SPORT, CAR_FRICTION, CAR_TURN, CAR_COLORS,
} from './config.js';
import { pick, randRange } from './random.js';

export const CAR_TYPES = {
  sedan:   { w: 38, h: 20, max: CAR_MAX,          accel: CAR_ACCEL },
  sports:  { w: 40, h: 18, max: CAR_MAX_SPORT,    accel: CAR_ACCEL * 1.35 },
  taxi:    { w: 38, h: 20, max: CAR_MAX * 0.9,    accel: CAR_ACCEL * 0.9 },
  van:     { w: 42, h: 24, max: CAR_MAX * 0.75,   accel: CAR_ACCEL * 0.7 },
  police:  { w: 40, h: 20, max: CAR_MAX_SPORT,    accel: CAR_ACCEL * 1.2 },
};

// Headings as axis-aligned directions used by simple traffic.
export const DIRS = [
  { dx: 1, dy: 0, angle: 0 },        // east
  { dx: 0, dy: 1, angle: Math.PI / 2 },   // south
  { dx: -1, dy: 0, angle: Math.PI },      // west
  { dx: 0, dy: -1, angle: -Math.PI / 2 }, // north
];

export function spawnTraffic(world, rng, x, y) {
  const type = rng() < 0.14 ? 'sports' : rng() < 0.2 ? 'taxi' : rng() < 0.3 ? 'van' : 'sedan';
  const t = CAR_TYPES[type];
  const d = DIRS[Math.floor(rng() * 4)];
  // Right-hand traffic: offset to the driver's right of the road centre.
  const rightX = d.dy !== 0 ? (d.dy > 0 ? -20 : 20) : 0;
  const rightY = d.dx !== 0 ? (d.dx > 0 ? 20 : -20) : 0;
  return {
    kind: 'car', type, ai: 'traffic',
    x, y, angle: d.angle, speed: randRange(rng, 90, 150),
    w: t.w, h: t.h, max: t.max, accel: t.accel,
    color: type === 'taxi' ? '#f5c518' : pick(rng, CAR_COLORS),
    health: 100, dir: DIRS.indexOf(d), driver: true,
    brakeLight: false, honk: 0,
  };
}

// Traffic follows its lane; at a junction it may turn to a new road.
function trafficStep(car, dt, rng, world) {
  const d = DIRS[car.dir];
  const cruise = 120 + (car.type === 'sports' ? 40 : 0);
  car.speed += (cruise - car.speed) * dt * 2;
  car.brakeLight = false;

  // Lane centre coordinate for the axis we are NOT moving along.
  const laneAxis = d.dx !== 0 ? 'y' : 'x';
  // Right-hand offset target.
  const right = d.dy !== 0 ? (d.dy > 0 ? -20 : 20) : (d.dx > 0 ? 20 : -20);
  const centre = nearestRoadCentre(car[laneAxis]);
  car[laneAxis] += (centre + right - car[laneAxis]) * Math.min(1, dt * 6);

  // Junction turning: when we cross a perpendicular road's centre line.
  const along = d.dx !== 0 ? car.x : car.y;
  const nextJunction = Math.round((along - TILE) / (ROAD_PERIOD * TILE)) * ROAD_PERIOD * TILE + TILE;
  if (Math.abs(along - nextJunction) < 4 && !car.turnedAt) {
    car.turnedAt = nextJunction;
    if (rng() < 0.35) {
      const turn = rng() < 0.5 ? 1 : 3; // right or left
      car.dir = (car.dir + turn) % 4;
      car.angle = DIRS[car.dir].angle;
      // Snap onto the new lane immediately so we never drift into a wall.
      const nd = DIRS[car.dir];
      const rightX = nd.dy !== 0 ? (nd.dy > 0 ? -20 : 20) : 0;
      const rightY = nd.dx !== 0 ? (nd.dx > 0 ? 20 : -20) : 0;
      const c = nearestRoadCentre(nd.dx !== 0 ? car.y : car.x);
      if (nd.dx !== 0) car.y = c + rightY; else car.x = c + rightX;
    }
  } else if (Math.abs(along - nextJunction) > 30) car.turnedAt = null;

  // Edge of the map: turn around.
  if (car.x < TILE || car.x > WORLD_W * 0.86 - TILE || car.y < TILE || car.y > WORLD_H - TILE) {
    car.dir = (car.dir + 2) % 4;
    car.angle = DIRS[car.dir].angle;
  }

  car.x += d.dx * car.speed * dt;
  car.y += d.dy * car.speed * dt;
}

function nearestRoadCentre(v) {
  const t = ROAD_PERIOD * TILE;
  return Math.round((v - TILE) / t) * t + TILE;
}

// Free steering physics, used by the player and the police.
export function driveCar(car, throttle, steer, handbrake, dt) {
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  else if (throttle < 0) car.speed -= (car.speed > 0 ? CAR_BRAKE : car.accel * 0.6) * -throttle * dt;
  car.speed *= Math.pow(CAR_FRICTION, dt * 60);
  if (handbrake) car.speed *= Math.pow(0.94, dt * 60);
  const limit = car.max;
  car.speed = Math.max(-limit * 0.4, Math.min(limit, car.speed));
  const grip = handbrake ? 2.2 : 1;
  const steerAuth = Math.min(1, Math.abs(car.speed) / 130);
  car.angle += steer * CAR_TURN * grip * steerAuth * dt * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.brakeLight = throttle < 0 || handbrake;
}

export function carBounce(car, world) {
  // Building walls: reflect and scrub speed.
  const r = Math.max(car.w, car.h) / 2;
  for (const b of world.buildings) {
    const nx = Math.max(b.x, Math.min(car.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(car.y, b.y + b.h));
    const dx = car.x - nx, dy = car.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      car.x = nx + (dx / d) * r;
      car.y = ny + (dy / d) * r;
      if (Math.abs(car.speed) > 120) car.health -= Math.abs(car.speed) * 0.02;
      car.speed *= -0.25;
    }
  }
}

// Car-vs-car: push apart and exchange a little damage and speed.
export function carVsCar(a, b, effects, wanted) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const minDist = (Math.max(a.w, a.h) + Math.max(b.w, b.h)) / 2 * 0.75;
  if (dist < minDist && dist > 0.01) {
    const nx = dx / dist, ny = dy / dist;
    const push = (minDist - dist) / 2;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    const rel = Math.abs(a.speed - b.speed);
    if (rel > 140) {
      a.health -= rel * 0.03; b.health -= rel * 0.03;
      effects.spark(a.x, a.y);
      if (a === wanted.playerCar || b === wanted.playerCar) wanted.crime('hitCar');
    }
    a.speed *= 0.72; b.speed *= 0.72;
  }
}

export function updateCars(game, dt) {
  const { world, rng, cars, effects, wanted } = game;
  for (const car of cars) {
    if (car === game.playerCar) continue;
    if (car.ai === 'traffic') trafficStep(car, dt, rng, world);
    else if (car.ai === 'cop') copStep(car, game, dt);
    if (car.health <= 0 && !car.exploded) {
      car.exploded = true;
      effects.explosion(car.x, car.y);
      if (car.ai === 'cop') wanted.crime('copDown');
    }
  }
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) carVsCar(cars[i], cars[j], effects, wanted);
  }
  // Remove far-away wrecks.
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.exploded && c.health <= -60) cars.splice(i, 1);
  }
}

function copStep(car, game, dt) {
  const target = game.playerCar || game.player;
  const tx = target.x, ty = target.y;
  const dx = tx - car.x, dy = ty - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const throttle = dist > 60 ? 1 : (car.speed > 60 ? -1 : 0);
  driveCar(car, throttle, Math.max(-1, Math.min(1, diff * 2)), Math.abs(diff) > 1.6 && Math.abs(car.speed) > 180, dt);
  carBounce(car, game.world);
  // Sirens deafen nobody; keep the lights on the HUD-side drawing.
  car.siren = (game.time * 6) % 2 < 1;
}

export function spawnCopNear(game) {
  const p = game.world.randomRoadPoint(game.rng, game.player.x, game.player.y, 320);
  const t = CAR_TYPES.police;
  game.cars.push({
    kind: 'car', type: 'police', ai: 'cop',
    x: p.x, y: p.y, angle: Math.atan2(game.player.y - p.y, game.player.x - p.x),
    speed: 120, w: t.w, h: t.h, max: t.max, accel: t.accel,
    color: '#22303c', health: 130, driver: true, siren: true, brakeLight: false,
  });
  game.copsOnDuty++;
}
