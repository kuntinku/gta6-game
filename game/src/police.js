// The law: a five-star wanted level, police spawns, bullets and line-of-sight
// escape logic. Cops chase in cars and shoot from the window at high stars.

import { COP_SPAWN_INTERVAL, WANTED_DECAY, WANTED_TIME } from './config.js';
import { spawnCopNear } from './vehicles.js';
import { hurtPlayer } from './player.js';

export function makeWanted(game) {
  return {
    stars: 0,
    heat: 0,           // seconds of continuous contact with the police
    sinceCrime: 0,
    spawnTimer: 0,
    game,
    crime(kind) {
      const gains = {
        gunfire: 1, pedDown: 1, hitCar: 0.5, stealCar: 1,
        stealCop: 2, copDown: 1.5, hitCop: 1,
      };
      this.sinceCrime = 0;
      this.heat = 0;
      this.stars = Math.min(5, this.stars + (gains[kind] || 1));
    },
    update(dt) {
      const g = this.game;
      this.sinceCrime += dt;
      // In a cop's line of sight? Then the heat stays on.
      let seen = false;
      for (const car of g.cars) {
        if (car.ai !== 'cop' || car.health <= 0) continue;
        const d = Math.hypot(car.x - g.player.x, car.y - g.player.y);
        if (d < 420) seen = true;
        if (d < 260 && car.health > 0) {
          g.copContact = true;
          if (this.stars >= 3 && g.time % 1.4 < dt * 2 && g.rng() < 0.5) copShoot(g, car);
        }
      }
      if (!seen) this.heat += dt; else { this.heat = 0; this.sinceCrime = Math.min(this.sinceCrime, 4); }
      if (this.heat > WANTED_TIME && this.stars > 0) {
        this.stars -= WANTED_DECAY * dt * 10;
        if (this.stars < 0.4) this.stars = 0;
      }
      // Spawn cops to match the star level.
      this.spawnTimer -= dt;
      const targetCops = Math.min(8, this.stars * 1.6 | 0);
      const activeCops = g.cars.filter((c) => c.ai === 'cop' && c.health > 0).length;
      if (this.stars > 0 && this.spawnTimer <= 0 && activeCops < targetCops) {
        spawnCopNear(g);
        this.spawnTimer = COP_SPAWN_INTERVAL / Math.max(1, this.stars * 0.6);
      }
      if (this.stars === 0) {
        // All clear: cops give up.
        for (const car of g.cars) if (car.ai === 'cop') car.health = Math.min(car.health, 5);
      }
    },
  };
}

function copShoot(game, car) {
  const ang = Math.atan2(game.player.y - car.y, game.player.x - car.x);
  const jitter = (game.rng() - 0.5) * 0.24;
  game.shots.push({ x: car.x + Math.cos(ang) * 20, y: car.y + Math.sin(ang) * 20, angle: ang + jitter, life: 0.4, friendly: false });
  game.effects.muzzle(car.x + Math.cos(ang) * 22, car.y + Math.sin(ang) * 22);
}

// Bullet flight and hit resolution, run by the game loop.
export function updateShots(game, dt) {
  const { shots, player, cars, effects } = game;
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i];
    s.life -= dt;
    const step = 620 * dt;
    s.px = s.x; s.py = s.y;
    s.x += Math.cos(s.angle) * step;
    s.y += Math.sin(s.angle) * step;
    let hit = false;
    if (game.world.solidAt(s.x, s.y)) { effects.spark(s.x, s.y); hit = true; }
    if (!hit && !s.friendly) {
      if (Math.hypot(s.x - player.x, s.y - player.y) < 12) {
        hurtPlayer(game, 7 + game.rng() * 5);
        effects.blood(player.x, player.y);
        hit = true;
      }
    }
    if (!hit && s.friendly) {
      for (const car of cars) {
        if (car.health <= 0) continue;
        if (Math.hypot(s.x - car.x, s.y - car.y) < Math.max(car.w, car.h) / 2) {
          car.health -= 22;
          effects.spark(s.x, s.y);
          if (car.ai === 'cop') game.wanted.crime('hitCop');
          hit = true;
          break;
        }
      }
    }
    if (hit || s.life <= 0) shots.splice(i, 1);
  }
}
