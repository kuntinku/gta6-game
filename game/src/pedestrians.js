// Pedestrians: people strolling the sidewalks, who flee from trouble and can
// be knocked down (which the police care about).

import { TILE, WORLD_W, WORLD_H, PED_COLORS, SHIRT_COLORS } from './config.js';
import { pick, randRange } from './random.js';
import { isRoadTile } from './world.js';

export function spawnPed(rng, world, x, y) {
  return {
    kind: 'ped',
    x, y,
    angle: rng() * Math.PI * 2,
    speed: randRange(rng, 26, 44),
    skin: pick(rng, PED_COLORS),
    shirt: pick(rng, SHIRT_COLORS),
    bob: rng() * Math.PI * 2,
    state: 'walk',      // walk | flee | down
    timer: randRange(rng, 2, 6),
    panicTimer: 0,
  };
}

export function spawnPedOnSidewalk(rng, world, avoidX, avoidY) {
  for (let i = 0; i < 50; i++) {
    const tx = 1 + Math.floor(rng() * (WORLD_W / TILE - 2));
    const ty = 1 + Math.floor(rng() * (WORLD_H / TILE - 2));
    if (isRoadTile(tx, ty)) continue;
    const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
    if (world.insideBuilding(x, y, 6)) continue;
    if (tx > 56) continue; // keep the beach calm
    if (Math.hypot(x - avoidX, y - avoidY) < 260) continue;
    return spawnPed(rng, world, x, y);
  }
  return null;
}

export function updatePeds(game, dt) {
  const { world, peds, rng, player, effects } = game;
  for (const p of peds) {
    p.bob += dt * 9;
    if (p.state === 'down') { p.timer -= dt; continue; }

    // Panic when a fast car or gunplay is close.
    const danger = nearestThreat(game, p);
    if (danger) {
      p.state = 'flee';
      p.panicTimer = 3;
      p.angle = Math.atan2(p.y - danger.y, p.x - danger.x) + randRange(rng, -0.4, 0.4);
    }
    if (p.state === 'flee') {
      p.panicTimer -= dt;
      if (p.panicTimer <= 0) p.state = 'walk';
    } else {
      p.timer -= dt;
      if (p.timer <= 0) { p.angle += randRange(rng, -1.4, 1.4); p.timer = randRange(rng, 2, 6); }
    }

    const sp = p.state === 'flee' ? p.speed * 2.4 : p.speed;
    p.x += Math.cos(p.angle) * sp * dt;
    p.y += Math.sin(p.angle) * sp * dt;
    if (world.collideCircle(p, 6)) p.angle += Math.PI * randRange(rng, 0.4, 0.9);
    p.x = Math.max(TILE, Math.min(WORLD_W * 0.86, p.x));
    p.y = Math.max(TILE, Math.min(WORLD_H - TILE, p.y));

    // Hit by a car? Knock them down and raise hell with the law.
    for (const car of game.cars) {
      if (car.health <= 0) continue;
      if (Math.abs(car.speed) < 45) continue;
      if (Math.hypot(car.x - p.x, car.y - p.y) < Math.max(car.w, car.h) / 2 + 4) {
        p.state = 'down';
        p.timer = 9;
        effects.blood(p.x, p.y);
        if (car === game.playerCar) game.wanted.crime('pedDown');
      }
    }
  }
  // Recycle far peds so the streets always feel alive.
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    if (Math.hypot(p.x - player.x, p.y - player.y) > 1500) {
      const fresh = spawnPedOnSidewalk(rng, world, player.x, player.y);
      if (fresh) peds[i] = fresh;
    }
  }
}

function nearestThreat(game, ped) {
  for (const car of game.cars) {
    if (Math.abs(car.speed) > 150 && Math.hypot(car.x - ped.x, car.y - ped.y) < 130) return car;
  }
  if (game.gunfireTimer > 0 && Math.hypot(game.player.x - ped.x, game.player.y - ped.y) < 220) return game.player;
  return null;
}
