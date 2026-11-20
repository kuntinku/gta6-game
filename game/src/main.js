// Palma Verde: Sun & Crime — an open-world top-down crime game.
// Boot: parse ?shot=&seed= for deterministic screenshot scenes, otherwise
// show the title screen and run the live simulation loop.

import { VIEW_W, VIEW_H, TILE } from './config.js';
import { makeRng } from './random.js';
import { World } from './world.js';
import { Input } from './input.js';
import { makePlayer, updatePlayer } from './player.js';
import { spawnTraffic, updateCars } from './vehicles.js';
import { spawnPedOnSidewalk, updatePeds } from './pedestrians.js';
import { makeWanted, updateShots } from './police.js';
import { makeMissionRunner, runTimers } from './missions.js';
import { makeEffects } from './effects.js';
import { updateCamera, render } from './render.js';
import { drawHud } from './hud.js';
import { makeShot, SHOTS } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shotName = params.get('shot');

const canvas = document.getElementById('game');

// ---- screenshot scene mode ---------------------------------------------
if (shotName) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  makeShot(shotName, seed, canvas);
} else {
  startGame(canvas, seed);
}

function startGame(canvas, seed) {
  const game = {
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
    paused: false,
    shotMode: false,
    state: 'title',
    camera: { x: TILE * 30, y: TILE * 30, zoom: 1.4, zoomTarget: 1.4 },
    saveProgress() { game.savedAt = game.time; },
  };
  game.input = new Input();
  game.world = new World(seed);
  game.player = makePlayer(TILE * 30 + 20, TILE * 31);
  game.wanted = makeWanted(game);
  game.mission = makeMissionRunner(game);

  // Seed the streets.
  for (let i = 0; i < 26; i++) {
    const p = game.world.randomRoadPoint(game.rng, game.player.x, game.player.y, 150);
    game.cars.push(spawnTraffic(game.world, game.rng, p.x, p.y));
  }
  for (let i = 0; i < 40; i++) {
    const ped = spawnPedOnSidewalk(game.rng, game.world, game.player.x, game.player.y);
    if (ped) game.peds.push(ped);
  }

  resize(canvas);
  globalThis.addEventListener('resize', () => resize(canvas));

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(game, dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function resize(canvas) {
  canvas.width = Math.min(VIEW_W, globalThis.innerWidth);
  canvas.height = Math.min(VIEW_H, globalThis.innerHeight);
}

function step(game, dt) {
  const { input, ctx, canvas } = game;

  if (game.state === 'title') {
    drawTitle(game);
    if (input.once('action') || input.mouse.down || input.pressed.has('Enter')) {
      game.state = 'playing';
      game.mission.showBanner('WELCOME TO PALMA VERDE');
    }
    input.endFrame();
    return;
  }

  if (input.once('pause')) game.paused = !game.paused;

  if (!game.paused && !game.gameOver) {
    game.time += dt;
    updatePlayer(game, dt);
    updateCars(game, dt);
    updatePeds(game, dt);
    updateShots(game, dt);
    game.wanted.update(dt);
    game.mission.update(dt);
    runTimers(game, dt);
    game.effects.update(dt);
    game.gunfireTimer = Math.max(0, game.gunfireTimer - dt);
    if (game.copContact) { game.copContactTimer = 0; game.copContact = false; }
    else game.copContactTimer += dt;
    // Traffic keeps the city populated as the player moves.
    if (game.cars.filter((c) => c.ai === 'traffic').length < 22) {
      const p = game.world.randomRoadPoint(game.rng, game.player.x, game.player.y, 900);
      game.cars.push(spawnTraffic(game.world, game.rng, p.x, p.y));
    }
    if (game.peds.length < 36) {
      const ped = spawnPedOnSidewalk(game.rng, game.world, game.player.x, game.player.y);
      if (ped) game.peds.push(ped);
    }
    game.wanted.copsOnDuty = game.cars.filter((c) => c.ai === 'cop' && c.health > 0).length;
  }

  updateCamera(game, dt);
  render(game);
  drawHud(ctx, game);

  if (game.paused) drawCenterText(ctx, canvas, 'PAUSED — press ESC to resume');
  if (game.gameOver) drawGameOver(game);

  input.endFrame();
}

function drawTitle(game) {
  const g = game.ctx;
  const W = game.canvas.width, H = game.canvas.height;
  // A slice of the city as the backdrop.
  game.camera.x = TILE * 44; game.camera.y = TILE * 30; game.camera.zoom = 0.9;
  const r = render;
  r(game);
  g.fillStyle = 'rgba(10, 8, 14, 0.55)';
  g.fillRect(0, 0, W, H);

  g.textAlign = 'center';
  g.fillStyle = '#ffd978';
  g.font = 'bold 72px Georgia, serif';
  g.fillText('PALMA VERDE', W / 2, H * 0.34);
  g.font = 'italic 30px Georgia, serif';
  g.fillStyle = '#f0e6d2';
  g.fillText('Sun & Crime', W / 2, H * 0.34 + 44);

  g.font = '18px monospace';
  g.fillStyle = '#cfe0d8';
  g.fillText('WASD move · SHIFT sprint · E enter/exit car · MOUSE shoot · ESC pause', W / 2, H * 0.62);
  g.font = 'bold 22px monospace';
  const pulse = 0.7 + Math.sin(game.time = (game.time || 0) + 0.05) * 0.3;
  g.fillStyle = `rgba(255,217,120,${pulse})`;
  g.fillText('CLICK OR PRESS E TO START', W / 2, H * 0.7);
  g.font = '14px Georgia, serif';
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillText('Five missions. One crooked paradise. El Coco is waiting.', W / 2, H * 0.78);
}

function drawCenterText(g, canvas, text) {
  g.textAlign = 'center';
  g.font = 'bold 28px monospace';
  g.fillStyle = 'rgba(0,0,0,0.6)';
  g.fillRect(0, canvas.height / 2 - 30, canvas.width, 60);
  g.fillStyle = '#fff';
  g.fillText(text, canvas.width / 2, canvas.height / 2 + 10);
}

function drawGameOver(game) {
  const g = game.ctx;
  const W = game.canvas.width, H = game.canvas.height;
  g.fillStyle = 'rgba(30,0,0,0.6)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  g.font = 'bold 64px Georgia, serif';
  g.fillStyle = '#e05c5c';
  g.fillText('WASTED', W / 2, H / 2 - 20);
  g.font = '20px monospace';
  g.fillStyle = '#f0e6d2';
  g.fillText(`You banked $${game.player.money.toLocaleString('en-US')} — press E to walk again`, W / 2, H / 2 + 30);
  if (game.input.once('action')) {
    game.gameOver = false;
    game.player.health = 100;
    game.player.alive = true;
    game.player.inCar = null;
    game.player.money = Math.floor(game.player.money * 0.8);
    game.wanted.stars = 0;
    game.player.x = TILE * 30;
    game.player.y = TILE * 31;
  }
}

// Expose the shot list for the /shots page and the console.
globalThis.PALMA = { SHOTS, version: '1.0.0' };
void drawHud;
