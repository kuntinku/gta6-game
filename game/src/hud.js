// The HUD: minimap with police blips and mission marker, wanted stars,
// health bar, money counter, objective text, speedometer and mission banners.

import { WORLD_W, VIEW_W, VIEW_H } from './config.js';

export function drawHud(g, game) {
  const { player, wanted, mission, canvas } = game;
  const W = canvas.width, H = canvas.height;

  drawMinimap(g, game);

  // Money.
  g.font = 'bold 22px Georgia, serif';
  g.textAlign = 'right';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(W - 214, 14, 200, 34);
  g.fillStyle = '#7ee08a';
  g.fillText(`$${player.money.toLocaleString('en-US')}`, W - 24, 40);

  // Wanted stars.
  const stars = Math.round(wanted.stars);
  g.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    const x = W - 205 + i * 26, y = 60;
    g.font = '22px serif';
    g.fillStyle = i < stars ? '#f2c744' : 'rgba(255,255,255,0.16)';
    g.fillText(i < stars ? '★' : '☆', x, y);
  }
  if (stars > 0) {
    g.font = 'bold 12px monospace';
    g.fillStyle = '#f2c744';
    g.fillText(stars >= 4 ? 'WANTED: LOCKDOWN' : 'WANTED', W - 205, 76);
  }

  // Health and armor bars.
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(16, 14, 200, 56);
  g.fillStyle = '#3c4a44';
  g.fillRect(24, 22, 184, 14);
  g.fillStyle = player.health > 30 ? '#6fcf7c' : '#e05c5c';
  g.fillRect(24, 22, 184 * Math.max(0, player.health / 100), 14);
  g.font = 'bold 11px monospace';
  g.fillStyle = '#cfe8d2';
  g.fillText(`HEALTH ${Math.round(player.health)}`, 26, 33);
  g.fillStyle = '#3c4a44';
  g.fillRect(24, 44, 184, 14);
  g.fillStyle = '#8fc7e8';
  g.fillRect(24, 44, 184 * Math.max(0, player.armor / 100), 14);
  g.fillText(`ARMOR ${Math.round(player.armor)}`, 26, 55);

  // Objective text.
  if (mission.stage === 'active') {
    const m = mission.current();
    g.textAlign = 'left';
    g.font = 'bold 16px Georgia, serif';
    g.fillStyle = 'rgba(0,0,0,0.6)';
    const label = mission.objective ? mission.objective.label : m.brief;
    const tw = g.measureText(label).width;
    g.fillRect(16, H - 84, tw + 24, 30);
    g.fillStyle = '#ffd98a';
    g.fillText(label, 28, H - 63);
    g.font = '13px Georgia, serif';
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillText(`${m.name} — from ${m.giver}`, 28, H - 40);
  } else if (mission.stage === 'brief') {
    g.textAlign = 'center';
    g.font = 'bold 18px Georgia, serif';
    g.fillStyle = '#ffd98a';
    g.fillText(`New job from ${mission.current().giver} — head out to start it`, W / 2, H - 40);
  }

  // Speedometer while driving.
  if (player.inCar) {
    const mph = Math.abs(Math.round(player.inCar.speed * 0.45));
    g.textAlign = 'right';
    g.font = 'bold 26px monospace';
    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(W - 170, H - 92, 154, 64);
    g.fillStyle = '#ffd98a';
    g.fillText(`${mph}`, W - 64, H - 58);
    g.font = '13px monospace';
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText('MPH', W - 64, H - 40);
    g.fillStyle = player.inCar.health > 35 ? '#9fd6a3' : '#e05c5c';
    g.fillRect(W - 156, H - 36, 126 * Math.max(0, player.inCar.health / 130), 6);
  }

  // Mission banner.
  if (mission.banner > 0) {
    const a = Math.min(1, mission.banner);
    g.textAlign = 'center';
    g.font = 'bold 34px Georgia, serif';
    g.fillStyle = `rgba(0,0,0,${0.55 * a})`;
    g.fillRect(0, H * 0.2 - 34, W, 52);
    g.fillStyle = `rgba(255,217,138,${a})`;
    g.fillText(mission.bannerText, W / 2, H * 0.2 + 4);
  }

  // Objective off-screen arrow.
  if (mission.objective) {
    const cam = game.camera;
    const sx = (mission.objective.x - cam.x) * cam.zoom + W / 2;
    const sy = (mission.objective.y - cam.y) * cam.zoom + H / 2;
    if (sx < 30 || sx > W - 30 || sy < 30 || sy > H - 30) {
      const ang = Math.atan2(mission.objective.y - cam.y, mission.objective.x - cam.x);
      const ax = W / 2 + Math.cos(ang) * 170, ay = H / 2 + Math.sin(ang) * 110;
      g.save();
      g.translate(ax, ay); g.rotate(ang);
      g.fillStyle = '#ffd98a';
      g.beginPath(); g.moveTo(16, 0); g.lineTo(-10, 8); g.lineTo(-10, -8); g.closePath(); g.fill();
      g.restore();
    }
  }

  // Controls hint on foot, small.
  if (!player.inCar && !game.shotMode) {
    g.textAlign = 'center';
    g.font = '12px monospace';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText('WASD move · SHIFT sprint · E enter/exit car · MOUSE shoot', W / 2, H - 14);
  } else if (player.inCar && !game.shotMode) {
    g.textAlign = 'center';
    g.font = '12px monospace';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText('W/S gas & brake · A/D steer · SPACE handbrake · E get out', W / 2, H - 14);
  }
}

function drawMinimap(g, game) {
  const world = game.world;
  const S = 176;
  const x0 = 16, y0 = 108;
  g.save();
  g.beginPath();
  g.arc(x0 + S / 2, y0 + S / 2, S / 2 + 6, 0, Math.PI * 2);
  g.fillStyle = 'rgba(10,14,16,0.85)';
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  g.stroke();
  g.clip();

  // Show a window of the baked minimap centred on the player.
  const k = 0.075;
  const mini = world.miniCanvas;
  const mapW = WORLD_W * k;
  g.drawImage(mini, 0, 0, mini.width, mini.height,
    x0 + S / 2 - game.player.x * k, y0 + S / 2 - game.player.y * k,
    mapW, mapW);

  const toMini = (wx, wy) => [x0 + (wx - game.player.x) * k + S / 2, y0 + (wy - game.player.y) * k + S / 2];

  // Cars.
  for (const car of game.cars) {
    if (car.health <= 0) continue;
    const [mx, my] = toMini(car.x, car.y);
    if (car.ai === 'cop') {
      g.fillStyle = car.siren ? '#ff5555' : '#5599ff';
      g.beginPath(); g.arc(mx, my, 3.4, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
  }
  // Mission marker.
  if (game.mission.objective) {
    const [mx, my] = toMini(game.mission.objective.x, game.mission.objective.y);
    g.fillStyle = '#ffd98a';
    g.beginPath();
    g.moveTo(mx, my - 5); g.lineTo(mx + 4.5, my + 3.5); g.lineTo(mx - 4.5, my + 3.5);
    g.closePath(); g.fill();
  }
  // Player arrow.
  g.save();
  g.translate(x0 + S / 2, y0 + S / 2);
  g.rotate(game.player.angle + Math.PI / 2);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.closePath(); g.fill();
  g.restore();
  g.restore();

  g.font = 'bold 11px monospace';
  g.textAlign = 'left';
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.fillText('PALMA VERDE', x0 + 8, y0 + 16);
}
