// Deterministic screenshot scenes: ?shot=<name>&seed=<n> builds the city,
// simulates a few seconds headlessly with the fixed seed, arranges the scene
// (a chase, a mission, a coast cruise), then draws one frame. No wall clock,
// no randomness beyond the seed, so every run of a scene is identical.

import { TILE } from './config.js';
import { World } from './world.js';
import { makePlayer, enterCar } from './player.js';
import { spawnTraffic, driveCar, carBounce, updateCars } from './vehicles.js';
import { spawnPedOnSidewalk, updatePeds } from './pedestrians.js';
import { makeWanted } from './police.js';
import { makeMissionRunner } from './missions.js';
import { makeEffects } from './effects.js';
import { updateCamera, render } from './render.js';
import { drawHud } from './hud.js';
import { makeRng } from './random.js';

export const SHOTS = ['1-city', '2-chase', '3-mission', '4-beach'];

function makeSceneGame(seed, canvas) {
  const game = {
    seed,
    rng: makeRng(seed),
    canvas,
    ctx: canvas.getContext('2d'),
    time: 0,
    cars: [],
    peds: [],
    shots: [],
    effects: makeEffects(),
    gunfireTimer: 0,
    copContactTimer: 0,
    copContact: false,
    gameOver: false,
    shotMode: true,
    camera: { x: TILE * 30, y: TILE * 30, zoom: 1.3, zoomTarget: 1.3 },
    input: { held: () => false, once: () => false, mouse: { x: 0, y: 0, down: false } },
    saveProgress() {},
  };
  game.world = new World(seed);
  game.player = makePlayer(TILE * 30, TILE * 30);
  game.wanted = makeWanted(game);
  game.mission = makeMissionRunner(game);
  game.mission.index = 1; // the story is already under way in the shots
  return game;
}

function populate(game, countCars, countPeds) {
  const { rng, world, player } = game;
  for (let i = 0; i < countCars; i++) {
    const p = world.randomRoadPoint(rng, player.x, player.y, 900);
    game.cars.push(spawnTraffic(world, rng, p.x, p.y));
  }
  for (let i = 0; i < countPeds; i++) {
    const ped = spawnPedOnSidewalk(rng, world, player.x, player.y);
    if (ped) game.peds.push(ped);
  }
}

function simulate(game, seconds, dt = 1 / 30) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    game.time += dt;
    updateCars(game, dt);
    updatePeds(game, dt);
    game.effects.update(dt);
  }
}

function drawFrame(game) {
  updateCamera(game, 1 / 30);
  render(game);
  drawHud(game.ctx, game);
}

export function makeShot(name, seed, canvas) {
  const game = makeSceneGame(seed, canvas);
  populate(game, 26, 34);
  simulate(game, 3);
  const arrange = SCENES[name] || SCENES['1-city'];
  arrange(game);
  drawFrame(game);
  return game;
}

const SCENES = {
  // Downtown on foot: traffic streaming past, a mission marker, full HUD.
  '1-city': (game) => {
    const { player } = game;
    player.x = TILE * 30 + 20;
    player.y = TILE * 31;
    player.angle = -0.5;
    player.walkPhase = 2;
    game.mission.stage = 'active';
    game.mission.objective = { x: player.x + 250, y: player.y + 150, label: 'Deliver the package' };
    game.mission.banner = 3;
    game.mission.bannerText = 'MISSION PASSED — $400';
    game.world.collideCircle(player, 9);
    game.camera.x = player.x;
    game.camera.y = player.y;
  },

  // A three-star police chase at speed down a palm-lined avenue.
  '2-chase': (game) => {
    const car = {
      kind: 'car', type: 'sports', ai: null,
      x: TILE * 25 + 20, y: TILE * 19 + 40, angle: 0, speed: 300,
      w: 40, h: 18, max: 430, accel: 460,
      color: '#c0392b', health: 88, driver: true, brakeLight: false, jacked: true,
    };
    game.cars.push(car);
    enterCar(game, car);
    car.jacked = true;
    game.wanted.stars = 3;
    for (let i = 0; i < 3; i++) {
      game.cars.push({
        kind: 'car', type: 'police', ai: 'cop',
        x: car.x - 130 - i * 66, y: car.y + 26 * (i % 2 ? 1 : -1), angle: 0.15,
        speed: 270, w: 40, h: 20, max: 430, accel: 410,
        color: '#22303c', health: 100, driver: true,
        siren: Math.floor(game.time * 6) % 2 === 0, brakeLight: false,
      });
    }
    for (let i = 0; i < 30; i++) {
      game.effects.decals.push({ x: car.x - 60 - i * 6, y: car.y + 44 - i * 1.6, r: 2.5, kind: 'skid' });
      game.effects.decals.push({ x: car.x - 60 - i * 6, y: car.y + 58 - i * 1.6, r: 2.5, kind: 'skid' });
    }
    game.effects.smoke(car.x - 30, car.y - 10);
    game.mission.stage = 'active';
    game.mission.banner = 3;
    game.mission.bannerText = 'HEATWAVE — LOSE THE HEAT';
    driveCar(car, 1, 0, false, 0.016);
    carBounce(car, game.world);
    game.camera.x = car.x + 30;
    game.camera.y = car.y;
    game.camera.zoom = 1.05;
    game.camera.zoomTarget = 1.05;
  },

  // Picking up Lola's package: marker, sidewalk crowd, one star of heat.
  '3-mission': (game) => {
    const { player } = game;
    player.x = TILE * 19 + 20;
    player.y = TILE * 43 + 30;
    player.angle = -Math.PI / 2;
    player.walkPhase = 1.4;
    game.mission.stage = 'active';
    game.mission.objective = { x: player.x - 40, y: player.y + 120, label: 'Pick up the package' };
    game.wanted.stars = 1;
    game.cars.push({
      kind: 'car', type: 'taxi', ai: 'traffic',
      x: player.x + 130, y: player.y + 190, angle: Math.PI / 2, speed: 90,
      w: 38, h: 20, max: 300, accel: 300, color: '#f5c518',
      health: 100, driver: true, brakeLight: false,
    });
    game.camera.x = player.x;
    game.camera.y = player.y;
    game.mission.banner = 0;
  },

  // Cruising the coast road, palms on one side, the sea on the other.
  '4-beach': (game) => {
    const car = {
      kind: 'car', type: 'sedan', ai: null,
      x: TILE * 55, y: TILE * 24, angle: Math.PI / 2, speed: 190,
      w: 38, h: 20, max: 330, accel: 340,
      color: '#2980b9', health: 100, driver: true, brakeLight: false, jacked: true,
    };
    game.cars.push(car);
    enterCar(game, car);
    car.jacked = true;
    game.wanted.stars = 1;
    game.mission.stage = 'brief';
    game.camera.x = car.x + 20;
    game.camera.y = car.y + 20;
    game.camera.zoom = 1.15;
    game.camera.zoomTarget = 1.15;
  },
};
