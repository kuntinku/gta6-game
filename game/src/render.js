// Rendering: the camera, the baked city, every moving thing drawn as a small
// top-down sprite, plus light and atmosphere (sun haze, shadows, gunfire).

import { VIEW_W, VIEW_H } from './config.js';

export function updateCamera(game, dt) {
  const cam = game.camera;
  const p = game.player;
  // Look slightly ahead of the car when driving fast.
  let tx = p.x, ty = p.y;
  if (p.inCar) {
    tx += Math.cos(p.angle) * Math.min(120, Math.abs(p.inCar.speed) * 0.35);
    ty += Math.sin(p.angle) * Math.min(120, Math.abs(p.inCar.speed) * 0.35);
  }
  cam.x += (tx - cam.x) * Math.min(1, dt * 7);
  cam.y += (ty - cam.y) * Math.min(1, dt * 7);
  cam.zoom += ((cam.zoomTarget || 1.05) - cam.zoom) * Math.min(1, dt * 3);
  // Keep the camera inside the map so the sea edge never shows a void.
  const halfW = game.canvas.width / cam.zoom / 2;
  const halfH = game.canvas.height / cam.zoom / 2;
  cam.x = Math.max(halfW, Math.min(game.world.mapCanvas.width - halfW, cam.x));
  cam.y = Math.max(halfH, Math.min(game.world.mapCanvas.height - halfH, cam.y));
}

export function render(game) {
  const g = game.ctx;
  const { canvas, camera, world } = game;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#101418';
  g.fillRect(0, 0, canvas.width, canvas.height);

  g.save();
  g.translate(canvas.width / 2, canvas.height / 2);
  g.scale(camera.zoom, camera.zoom);
  g.translate(-camera.x, -camera.y);

  // Ground.
  const vw = canvas.width / camera.zoom, vh = canvas.height / camera.zoom;
  const sx = Math.max(0, camera.x - vw / 2), sy = Math.max(0, camera.y - vh / 2);
  const sw = Math.min(world.mapCanvas.width - sx, vw), sh = Math.min(world.mapCanvas.height - sy, vh);
  g.drawImage(world.mapCanvas, sx, sy, sw, sh, sx, sy, sw, sh);

  // Decals under everything.
  for (const d of game.effects.decals) {
    if (Math.abs(d.x - camera.x) > vw || Math.abs(d.y - camera.y) > vh) continue;
    if (d.kind === 'blood') {
      g.fillStyle = 'rgba(120, 20, 20, 0.55)';
      g.beginPath(); g.ellipse(d.x, d.y, d.r, d.r * 0.7, 0.4, 0, Math.PI * 2); g.fill();
    } else if (d.kind === 'scorch') {
      g.fillStyle = 'rgba(20, 18, 16, 0.5)';
      g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = 'rgba(20, 20, 22, 0.28)';
      g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill();
    }
  }

  // Mission marker.
  if (game.mission.objective) drawMarker(g, game.mission.objective, game.time);

  // Peds, then cars, then the player (cars over people reads best from above).
  for (const p of game.peds) {
    if (Math.abs(p.x - camera.x) > vw / 2 + 40 || Math.abs(p.y - camera.y) > vh / 2 + 40) continue;
    drawPed(g, p, game);
  }
  for (const car of game.cars) {
    if (Math.abs(car.x - camera.x) > vw / 2 + 80 || Math.abs(car.y - camera.y) > vh / 2 + 80) continue;
    drawCar(g, car, game);
  }
  if (!game.player.inCar && game.player.alive) drawPlayer(g, game);

  // Bullets.
  for (const s of game.shots) {
    g.strokeStyle = s.friendly ? 'rgba(255,240,160,0.95)' : 'rgba(255,170,120,0.95)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s.x, s.y);
    g.lineTo(s.x - Math.cos(s.angle) * 16, s.y - Math.sin(s.angle) * 16);
    g.stroke();
  }

  // Particles.
  for (const p of game.effects.particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 'smoke') {
      g.fillStyle = `rgba(90,90,95,${0.35 * a})`;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    } else if (p.kind === 'fire') {
      g.fillStyle = `rgba(255,${120 + 100 * a | 0},40,${a})`;
      g.beginPath(); g.arc(p.x, p.y, 5 * a + 2, 0, Math.PI * 2); g.fill();
    } else if (p.kind === 'blood') {
      g.fillStyle = `rgba(150,25,25,${a})`;
      g.fillRect(p.x, p.y, 2, 2);
    } else if (p.kind === 'spark') {
      g.fillStyle = `rgba(255,230,150,${a})`;
      g.fillRect(p.x, p.y, 2, 2);
    } else if (p.kind === 'muzzle') {
      g.fillStyle = `rgba(255,245,190,${a})`;
      g.beginPath(); g.arc(p.x, p.y, 8 * a + 3, 0, Math.PI * 2); g.fill();
    }
  }

  g.restore();

  // Warm afternoon light and a soft vignette over the whole view.
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = 'rgba(255, 186, 102, 0.055)';
  g.fillRect(0, 0, canvas.width, canvas.height);
  const vg = g.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
    canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(12,8,6,0.42)');
  g.fillStyle = vg;
  g.fillRect(0, 0, canvas.width, canvas.height);
}

function drawMarker(g, m, t) {
  const pulse = 1 + Math.sin(t * 4) * 0.08;
  g.save();
  g.translate(m.x, m.y);
  g.strokeStyle = 'rgba(255,215,120,0.85)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(0, 0, 34 * pulse, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(255,215,120,0.22)';
  g.beginPath(); g.arc(0, 0, 34 * pulse, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd978';
  g.beginPath();
  g.moveTo(0, -16); g.lineTo(12, 8); g.lineTo(0, 3); g.lineTo(-12, 8);
  g.closePath(); g.fill();
  g.restore();
}

function drawCar(g, car, game) {
  const w = car.w, h = car.h;
  g.save();
  g.translate(car.x, car.y);

  // Soft shadow.
  g.fillStyle = 'rgba(20,15,10,0.3)';
  g.beginPath();
  g.roundRect(-w / 2 + 5, -h / 2 + 5, w, h, 5);
  g.fill();

  g.rotate(car.angle);
  // Body.
  const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, lighten(car.color, 18));
  grad.addColorStop(0.55, car.color);
  grad.addColorStop(1, darken(car.color, 22));
  g.fillStyle = grad;
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 5); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.stroke();

  // Windscreen and rear glass.
  g.fillStyle = 'rgba(30,44,54,0.85)';
  g.beginPath(); g.roundRect(w * 0.08, -h / 2 + 3, w * 0.18, h - 6, 2); g.fill();
  g.fillStyle = 'rgba(30,44,54,0.7)';
  g.beginPath(); g.roundRect(-w * 0.32, -h / 2 + 4, w * 0.14, h - 8, 2); g.fill();
  // Roof.
  g.fillStyle = lighten(car.color, 8);
  g.beginPath(); g.roundRect(-w * 0.16, -h / 2 + 5, w * 0.22, h - 10, 2); g.fill();

  // Wheels.
  g.fillStyle = '#17181b';
  for (const [wx, wy] of [[w * 0.28, -h / 2], [w * 0.28, h / 2], [-w * 0.28, -h / 2], [-w * 0.28, h / 2]]) {
    g.fillRect(wx - 4, wy - 2.5, 8, 5);
  }

  // Head/tail lights.
  g.fillStyle = 'rgba(255,244,190,0.95)';
  g.fillRect(w / 2 - 3, -h / 2 + 3, 3, 4);
  g.fillRect(w / 2 - 3, h / 2 - 7, 3, 4);
  g.fillStyle = car.brakeLight ? '#ff3b30' : 'rgba(170,40,30,0.8)';
  g.fillRect(-w / 2, -h / 2 + 3, 3, 4);
  g.fillRect(-w / 2, h / 2 - 7, 3, 4);

  // Police livery: white doors and a light bar that strobes.
  if (car.type === 'police') {
    g.fillStyle = '#e8ecef';
    g.fillRect(-w * 0.1, -h / 2 + 1, w * 0.34, h - 2);
    g.fillStyle = '#1b3f6e';
    g.fillRect(-w * 0.1, -h / 2 + 1, w * 0.34, 3);
    g.fillStyle = '#1b3f6e';
    g.fillRect(-w * 0.1, h / 2 - 4, w * 0.34, 3);
    g.fillStyle = car.siren ? '#ff4444' : '#4488ff';
    g.fillRect(-w * 0.08, -3, 6, 6);
    if (car.siren) {
      const glow = g.createRadialGradient(0, 0, 2, 0, 0, 30);
      glow.addColorStop(0, 'rgba(255,80,80,0.32)');
      glow.addColorStop(1, 'rgba(255,80,80,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(0, 0, 30, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();

  // Strobe on top, unrotated so it reads as light.
  if (car.type === 'police') {
    const on = Math.floor(game.time * 6) % 2 === 0;
    g.save();
    g.globalAlpha = 0.4;
    g.fillStyle = on ? '#ff4d4d' : '#4d8dff';
    g.beginPath(); g.arc(car.x, car.y, 13, 0, Math.PI * 2); g.fill();
    g.restore();
  }
}

function drawPlayer(g, game) {
  const p = game.player;
  const bob = Math.sin(p.walkPhase) * 1.5;
  g.save();
  g.translate(p.x, p.y);
  // Shadow.
  g.fillStyle = 'rgba(20,15,10,0.35)';
  g.beginPath(); g.ellipse(3, 3, 10, 8, 0, 0, Math.PI * 2); g.fill();
  g.rotate(p.angle + Math.PI / 2);
  // Legs.
  g.fillStyle = '#2b3b55';
  g.fillRect(-6, -2 + bob, 4, 10);
  g.fillRect(2, -2 - bob, 4, 10);
  // Torso.
  g.fillStyle = '#e8ddc4';
  g.beginPath(); g.roundRect(-8, -8, 16, 15, 5); g.fill();
  // Arms.
  g.fillStyle = '#d3b78f';
  g.fillRect(-10, -6, 3, 9);
  g.fillRect(7, -6, 3, 9);
  // Head + hair.
  g.fillStyle = '#b98652';
  g.beginPath(); g.arc(0, -6, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3b2a1c';
  g.beginPath(); g.arc(0, -7.5, 5, Math.PI * 0.9, Math.PI * 2.1); g.fill();
  // Pistol.
  if (p.shootCooldown > 0.18) {
    g.fillStyle = '#2a2a2a';
    g.fillRect(6, -16, 3, 9);
  }
  g.restore();
}

function drawPed(g, p, game) {
  g.save();
  g.translate(p.x, p.y);
  const bob = p.state === 'walk' ? Math.sin(p.bob) * 1.2 : 0;
  g.fillStyle = 'rgba(20,15,10,0.3)';
  g.beginPath(); g.ellipse(2, 2, 7, 5, 0, 0, Math.PI * 2); g.fill();
  g.rotate(p.angle + Math.PI / 2);
  if (p.state === 'down') {
    g.fillStyle = p.shirt;
    g.beginPath(); g.roundRect(-10, -5, 20, 10, 4); g.fill();
    g.fillStyle = p.skin;
    g.beginPath(); g.arc(-12, 0, 4, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = p.shirt;
    g.beginPath(); g.roundRect(-5, -6 + bob, 10, 13, 4); g.fill();
    g.fillStyle = '#26303d';
    g.fillRect(-5, 5, 4, 6);
    g.fillRect(1, 5, 4, 6);
    g.fillStyle = p.skin;
    g.beginPath(); g.arc(0, -7 + bob, 4.4, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function lighten(hex, amt) { return shift(hex, amt); }
function darken(hex, amt) { return shift(hex, -amt); }
function shift(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}
