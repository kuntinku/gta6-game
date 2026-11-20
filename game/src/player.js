// The player: walks, sprints, shoots, enters and drives cars, takes damage.

import {
  PLAYER_WALK, PLAYER_SPRINT, PLAYER_RADIUS, TILE,
} from './config.js';
import { driveCar, carBounce } from './vehicles.js';

export function makePlayer(x, y) {
  return {
    kind: 'player',
    x, y,
    angle: -Math.PI / 2,
    health: 100,
    armor: 0,
    money: 1250,
    inCar: null,          // car object when driving
    walkPhase: 0,
    shootCooldown: 0,
    alive: true,
  };
}

export function updatePlayer(game, dt) {
  const { input, world, player, effects } = game;
  if (!player.alive) return;
  player.shootCooldown -= dt;

  if (player.inCar) {
    const car = player.inCar;
    const throttle = (input.held('forward') ? 1 : 0) + (input.held('back') ? -1 : 0);
    const steer = (input.held('right') ? 1 : 0) + (input.held('left') ? -1 : 0);
    driveCar(car, throttle, steer, input.held('handbrake'), dt);
    carBounce(car, world);
    if (Math.abs(car.speed) > 200 && input.held('handbrake')) effects.skid(car);
    player.x = car.x; player.y = car.y; player.angle = car.angle;
    if (input.once('action') && Math.abs(car.speed) < 90) exitCar(game);
    return;
  }

  // On foot.
  const mvx = (input.held('right') ? 1 : 0) - (input.held('left') ? 1 : 0);
  const mvy = (input.held('down') ? 1 : 0) - (input.held('up') ? 1 : 0);
  const moving = mvx !== 0 || mvy !== 0;
  if (moving) {
    const sp = input.held('sprint') ? PLAYER_SPRINT : PLAYER_WALK;
    const inv = 1 / Math.hypot(mvx, mvy);
    player.x += mvx * inv * sp * dt;
    player.y += mvy * inv * sp * dt;
    player.angle = Math.atan2(mvy, mvx);
    player.walkPhase += dt * (input.held('sprint') ? 13 : 9);
  }
  world.collideCircle(player, PLAYER_RADIUS);

  // Enter the nearest car.
  if (input.once('action')) {
    let best = null, bestD = 70;
    for (const car of game.cars) {
      if (car.health <= 0) continue;
      const d = Math.hypot(car.x - player.x, car.y - player.y);
      if (d < bestD) { best = car; bestD = d; }
    }
    if (best) enterCar(game, best);
  }

  // Pistol fire toward the mouse.
  if (input.mouse.down && player.shootCooldown <= 0) {
    const rect = game.canvas.getBoundingClientRect();
    const mx = input.mouse.x - rect.left, my = input.mouse.y - rect.top;
    const wx = game.camera.x + (mx - game.canvas.width / 2) / game.camera.zoom;
    const wy = game.camera.y + (my - game.canvas.height / 2) / game.camera.zoom;
    const ang = Math.atan2(wy - player.y, wx - player.x);
    player.angle = ang;
    game.shots.push({ x: player.x + Math.cos(ang) * 14, y: player.y + Math.sin(ang) * 14, angle: ang, life: 0.28, friendly: true });
    effects.muzzle(player.x + Math.cos(ang) * 16, player.y + Math.sin(ang) * 16);
    game.gunfireTimer = 2.5;
    player.shootCooldown = 0.3;
    game.wanted.crime('gunfire');
  }
}

export function enterCar(game, car) {
  const { player, wanted } = game;
  player.inCar = car;
  car.ai = null;
  if (car.ai !== 'cop' && car.jacked !== true) {
    car.jacked = true;
    wanted.crime(car.type === 'police' ? 'stealCop' : 'stealCar');
  }
  game.camera.zoomTarget = 1.15;
}

export function exitCar(game) {
  const { player } = game;
  const car = player.inCar;
  car.speed *= 0.4;
  player.inCar = null;
  player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
  player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
  game.world.collideCircle(player, PLAYER_RADIUS);
  game.camera.zoomTarget = 1.4;
}

export function hurtPlayer(game, amount) {
  const p = game.player;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, amount);
    p.armor -= absorbed;
    amount -= absorbed;
  }
  p.health -= amount;
  if (p.health <= 0) {
    p.health = 0;
    p.alive = false;
    game.effects.blood(p.x, p.y);
    game.gameOver = true;
  }
}
