// City generation and static art: a sun-soaked grid city, "Palma Verde".
// The whole ground is baked once into an offscreen canvas (roads, sidewalks,
// buildings with drop shadows, palms, beach and sea) and blitted per frame;
// only movable things (cars, people, cops, effects) are drawn live.

import {
  TILE, CITY_W, CITY_H, WORLD_W, WORLD_H, ROAD_PERIOD, ROAD_WIDTH,
  COLORS, BUILDING_PALETTE,
} from './config.js';
import { makeRng, pick, randRange } from './random.js';

export const ROAD = 0;
export const WALK = 1;
export const BUILDING = 2;
export const SAND = 3;
export const WATER = 4;
export const PARK = 5;

export function isRoadTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= CITY_W || ty >= CITY_H) return false;
  return (tx % ROAD_PERIOD) < ROAD_WIDTH || (ty % ROAD_PERIOD) < ROAD_WIDTH;
}

export function isBeachTile(tx) { return tx >= 56; }
export function isWaterTile(tx) { return tx >= 59; }

export class World {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed * 7919 + 13);
    this.buildings = [];   // {x,y,w,h,color,height,roof}
    this.palms = [];       // {x,y,r}
    this.trees = [];
    this.props = [];       // benches, hydrants, lamps (visual only)
    this.mapCanvas = null;
    this.miniCanvas = null;
    this.generate();
    this.bake();
    this.bakeMinimap();
  }

  // ---- generation -------------------------------------------------------

  generate() {
    const rng = this.rng;
    // City blocks are the 4x4 tile squares between road bands.
    for (let by = 0; by < CITY_H; by += ROAD_PERIOD) {
      for (let bx = 0; bx < CITY_W; bx += ROAD_PERIOD) {
        const x0 = (bx + ROAD_WIDTH) * TILE;
        const y0 = (by + ROAD_WIDTH) * TILE;
        const w = (ROAD_PERIOD - ROAD_WIDTH) * TILE;
        const h = (ROAD_PERIOD - ROAD_WIDTH) * TILE;
        if (bx >= 54 * 1 && x0 > 54 * TILE) continue; // beach strip is open sand

        const roll = rng();
        if (roll < 0.14) { this.makePark(x0, y0, w, h); continue; }
        if (roll < 0.2) { this.makeParkingLot(x0, y0, w, h); continue; }

        // Split the block into 1-3 buildings with a little breathing room.
        const cols = rng() < 0.45 ? 2 : 1;
        const rows = rng() < 0.35 ? 2 : 1;
        const pad = 10;
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const bw = w / cols;
            const bh = h / rows;
            const bx2 = x0 + c * bw + pad + randRange(rng, -3, 3);
            const by2 = y0 + r * bh + pad + randRange(rng, -3, 3);
            const ww = bw - pad * 2 + randRange(rng, -6, 6);
            const hh = bh - pad * 2 + randRange(rng, -6, 6);
            if (ww < 40 || hh < 40) continue;
            const tall = rng();
            this.buildings.push({
              x: bx2, y: by2, w: ww, h: hh,
              color: pick(rng, BUILDING_PALETTE),
              height: tall > 0.75 ? randRange(rng, 18, 30) : randRange(rng, 6, 16),
              roof: rng() < 0.4,
              windows: rng(),
            });
          }
        }
      }
    }
    // Palms along the beach promenade and scattered on sidewalks.
    for (let ty = 2; ty < CITY_H; ty += 3) {
      for (let tx = 2; tx < CITY_W - 2; tx += 3) {
        if (isRoadTile(tx, ty)) continue;
        const px = (tx + 0.5) * TILE, py = (ty + 0.5) * TILE;
        if (tx >= 54) { this.palms.push({ x: px, y: py, r: 16 }); continue; }
        if (this.rng() < 0.18 && !this.insideBuilding(px, py, 12)) {
          this.palms.push({ x: px, y: py, r: randRange(this.rng, 13, 18) });
        }
      }
    }
    for (let i = 0; i < 90; i++) {
      const x = this.rng() * WORLD_W * 0.86;
      const y = this.rng() * WORLD_H;
      if (isRoadTile(Math.floor(x / TILE), Math.floor(y / TILE))) continue;
      if (this.insideBuilding(x, y, 10)) continue;
      this.props.push({ x, y, kind: this.rng() < 0.5 ? 'hydrant' : 'lamp' });
    }
  }

  makePark(x, y, w, h) {
    const rng = this.rng;
    for (let i = 0; i < 7; i++) {
      this.trees.push({
        x: x + randRange(rng, 20, w - 20),
        y: y + randRange(rng, 20, h - 20),
        r: randRange(rng, 10, 16),
      });
    }
    this.parks = this.parks || [];
    this.parks.push({ x, y, w, h });
  }

  makeParkingLot(x, y, w, h) {
    this.lots = this.lots || [];
    this.lots.push({ x, y, w, h });
  }

  insideBuilding(x, y, pad = 0) {
    for (const b of this.buildings) {
      if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
    }
    return false;
  }

  // ---- static art -------------------------------------------------------

  bake() {
    const c = document.createElement('canvas');
    c.width = WORLD_W; c.height = WORLD_H;
    const g = c.getContext('2d');
    const rng = makeRng(this.seed * 31 + 5);

    // Ground / sidewalk base.
    g.fillStyle = COLORS.sidewalk;
    g.fillRect(0, 0, WORLD_W, WORLD_H);

    // Sidewalk tile joints.
    g.strokeStyle = 'rgba(0,0,0,0.06)';
    g.lineWidth = 1;
    for (let i = 0; i <= CITY_W; i++) {
      g.beginPath(); g.moveTo(i * TILE, 0); g.lineTo(i * TILE, WORLD_H); g.stroke();
      g.beginPath(); g.moveTo(0, i * TILE); g.lineTo(WORLD_W, i * TILE); g.stroke();
    }

    // Beach and sea on the east edge.
    const beachX = 54 * TILE;
    g.fillStyle = COLORS.sand;
    g.fillRect(beachX, 0, WORLD_W - beachX, WORLD_H);
    const waterX = 59 * TILE;
    g.fillStyle = COLORS.waterDeep;
    g.fillRect(waterX, 0, WORLD_W - waterX, WORLD_H);
    g.fillStyle = COLORS.water;
    g.fillRect(waterX, 0, WORLD_W - waterX - 60, WORLD_H);
    // Foam line.
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 6;
    for (let y = 0; y < WORLD_H; y += 26) {
      g.beginPath();
      g.moveTo(waterX, y);
      g.quadraticCurveTo(waterX - 14, y + 13, waterX, y + 26);
      g.stroke();
    }
    // Dune speckles.
    for (let i = 0; i < 900; i++) {
      g.fillStyle = rng() < 0.5 ? 'rgba(190,165,105,0.35)' : 'rgba(255,245,210,0.5)';
      g.fillRect(beachX + rng() * (waterX - beachX), rng() * WORLD_H, 2, 2);
    }

    // Parks.
    for (const p of this.parks || []) {
      g.fillStyle = COLORS.grass;
      g.fillRect(p.x, p.y, p.w, p.h);
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(p.x + 8, p.y + p.h / 2);
      g.lineTo(p.x + p.w - 8, p.y + p.h / 2);
      g.stroke();
    }
    // Parking lots (asphalt + stall lines).
    for (const p of this.lots || []) {
      g.fillStyle = '#4a4a4f';
      g.fillRect(p.x, p.y, p.w, p.h);
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 2;
      for (let i = 14; i < p.w - 10; i += 26) {
        g.beginPath(); g.moveTo(p.x + i, p.y + 6); g.lineTo(p.x + i, p.y + 44); g.stroke();
        g.beginPath(); g.moveTo(p.x + i, p.y + p.h - 44); g.lineTo(p.x + i, p.y + p.h - 6); g.stroke();
      }
    }

    // Roads: asphalt bands for every road row/column.
    g.fillStyle = COLORS.asphalt;
    for (let t = 0; t < CITY_W; t += ROAD_PERIOD) {
      g.fillRect(t * TILE, 0, ROAD_WIDTH * TILE, WORLD_H);
      g.fillRect(0, t * TILE, WORLD_W, ROAD_WIDTH * TILE);
    }
    // Slight tone variation per road tile to avoid a flat slab look.
    for (let ty = 0; ty < CITY_H; ty++) {
      for (let tx = 0; tx < CITY_W; tx++) {
        if (!isRoadTile(tx, ty)) continue;
        g.fillStyle = rng() < 0.5 ? COLORS.asphalt : COLORS.asphaltLight;
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      }
    }

    // Kerbs.
    g.strokeStyle = '#cfc7b8';
    g.lineWidth = 3;
    for (let t = 0; t < CITY_W; t += ROAD_PERIOD) {
      g.beginPath(); g.moveTo(t * TILE, 0); g.lineTo(t * TILE, WORLD_H); g.stroke();
      g.beginPath(); g.moveTo((t + ROAD_WIDTH) * TILE, 0); g.lineTo((t + ROAD_WIDTH) * TILE, WORLD_H); g.stroke();
      g.beginPath(); g.moveTo(0, t * TILE); g.lineTo(WORLD_W, t * TILE); g.stroke();
      g.beginPath(); g.moveTo(0, (t + ROAD_WIDTH) * TILE); g.lineTo(WORLD_W, (t + ROAD_WIDTH) * TILE); g.stroke();
    }

    // Lane dashes down the centre of each road band, skipped at junctions.
    g.strokeStyle = COLORS.lane;
    g.lineWidth = 3;
    g.setLineDash([14, 14]);
    for (let t = 0; t < CITY_W; t += ROAD_PERIOD) {
      const cx = (t + 1) * TILE;
      const cy = (t + 1) * TILE;
      for (let s = 0; s < CITY_W; s++) {
        if (s % ROAD_PERIOD < ROAD_WIDTH) continue;
        g.beginPath(); g.moveTo(cx, s * TILE + 6); g.lineTo(cx, (s + 1) * TILE - 6); g.stroke();
        g.beginPath(); g.moveTo(s * TILE + 6, cy); g.lineTo((s + 1) * TILE - 6, cy); g.stroke();
      }
    }
    g.setLineDash([]);

    // Crosswalks at each junction.
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let ty = 0; ty < CITY_H; ty += ROAD_PERIOD) {
      for (let tx = 0; tx < CITY_W; tx += ROAD_PERIOD) {
        const x = tx * TILE, y = ty * TILE;
        for (let i = 0; i < ROAD_WIDTH * TILE; i += 12) {
          g.fillRect(x + i + 2, y - 12, 7, 10);
          g.fillRect(x + i + 2, y + ROAD_WIDTH * TILE + 2, 7, 10);
          g.fillRect(x - 12, y + i + 2, 10, 7);
          g.fillRect(x + ROAD_WIDTH * TILE + 2, y + i + 2, 10, 7);
        }
      }
    }

    // Beach promenade line.
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(beachX + 4, 0); g.lineTo(beachX + 4, WORLD_H); g.stroke();

    // Buildings, drawn with a small parallax "height": a dark wall slab
    // offset toward the street, then the roof plane on top of it.
    for (const b of this.buildings) {
      const off = Math.max(4, b.height * 0.7);
      g.fillStyle = 'rgba(35, 25, 20, 0.3)';
      g.fillRect(b.x + off, b.y + off, b.w, b.h);
    }
    for (const b of this.buildings) {
      const off = Math.max(4, b.height * 0.7);
      // South and east wall faces catch a little shade.
      g.fillStyle = darken(b.color, 60);
      g.fillRect(b.x, b.y + b.h - off * 0.45, b.w, off * 0.45);
      g.fillRect(b.x + b.w - off * 0.45, b.y, off * 0.45, b.h);
      // The roof plane sits up-left of its footprint.
      g.fillStyle = lighten(b.color, 10);
      g.fillRect(b.x - off * 0.55, b.y - off * 0.55, b.w, b.h);
      // Roof edge / parapet.
      g.strokeStyle = 'rgba(0,0,0,0.22)';
      g.lineWidth = 3;
      g.strokeRect(b.x - off * 0.55 + 1.5, b.y - off * 0.55 + 1.5, b.w - 3, b.h - 3);
      // Roof furniture: AC units and a stairwell box.
      g.fillStyle = 'rgba(0,0,0,0.16)';
      const n = 2 + Math.floor(b.windows * 3);
      for (let i = 0; i < n; i++) {
        const rw = 10 + rng() * 18, rh = 8 + rng() * 14;
        g.fillRect(b.x - off * 0.55 + 8 + rng() * (b.w - rw - 16), b.y - off * 0.55 + 8 + rng() * (b.h - rh - 16), rw, rh);
      }
      // Sunlit top edge.
      g.fillStyle = 'rgba(255,240,210,0.35)';
      g.fillRect(b.x - off * 0.55, b.y - off * 0.55, b.w, 4);
    }

    // Trees and palms.
    for (const t of this.trees || []) drawTree(g, t.x, t.y, t.r, rng);
    for (const p of this.palms) drawPalm(g, p.x, p.y, p.r);

    // Small street furniture.
    for (const p of this.props) {
      if (p.kind === 'hydrant') {
        g.fillStyle = '#d64b3f';
        g.beginPath(); g.arc(p.x, p.y, 3, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = '#5a5a5a';
        g.fillRect(p.x - 1.5, p.y - 8, 3, 8);
        g.fillStyle = '#ffe9a8';
        g.beginPath(); g.arc(p.x, p.y - 9, 3, 0, Math.PI * 2); g.fill();
      }
    }

    this.mapCanvas = c;
  }

  bakeMinimap() {
    const S = 200;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    const k = S / WORLD_W;
    g.fillStyle = '#24343a';
    g.fillRect(0, 0, S, S);
    for (let ty = 0; ty < CITY_H; ty++) {
      for (let tx = 0; tx < CITY_W; tx++) {
        const x = tx * TILE * k, y = ty * TILE * k;
        if (isRoadTile(tx, ty)) { g.fillStyle = '#7d8a8f'; g.fillRect(x, y, TILE * k + 0.5, TILE * k + 0.5); }
        else if (isWaterTile(tx)) { g.fillStyle = '#1f6f88'; g.fillRect(x, y, TILE * k + 0.5, TILE * k + 0.5); }
        else if (isBeachTile(tx)) { g.fillStyle = '#b9a678'; g.fillRect(x, y, TILE * k + 0.5, TILE * k + 0.5); }
      }
    }
    for (const b of this.buildings) {
      g.fillStyle = '#3b4a50';
      g.fillRect(b.x * k, b.y * k, Math.max(1, b.w * k), Math.max(1, b.h * k));
    }
    this.miniCanvas = c;
  }

  // ---- queries ----------------------------------------------------------

  solidAt(x, y) {
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return true;
    if (x > 58 * TILE) return true; // the sea is not drivable
    return this.insideBuilding(x, y, -2);
  }

  // Push a circle out of any building it overlaps. Returns true on contact.
  collideCircle(e, r) {
    let hit = false;
    for (const b of this.buildings) {
      const nx = Math.max(b.x, Math.min(e.x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(e.y, b.y + b.h));
      const dx = e.x - nx, dy = e.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        e.x = nx + (dx / d) * r;
        e.y = ny + (dy / d) * r;
        hit = true;
      }
    }
    return hit;
  }

  nearestRoadCenter(x, y) {
    // Snap to the nearest road centre line (used by cops and traffic spawns).
    const t = ROAD_PERIOD * TILE;
    const cx = Math.round((x - TILE) / t) * t + TILE;
    const cy = Math.round((y - TILE) / t) * t + TILE;
    return { x: cx, y: cy };
  }

  // A random point on a lane of the road grid, away from the player.
  randomRoadPoint(rng, avoidX = 0, avoidY = 0, minDist = 500) {
    for (let i = 0; i < 40; i++) {
      const horizontal = rng() < 0.5;
      const t = Math.floor(rng() * (CITY_W / ROAD_PERIOD)) * ROAD_PERIOD * TILE + TILE;
      const along = rng() * WORLD_W * 0.85;
      const lane = (rng() < 0.5 ? -1 : 1) * 20;
      const x = horizontal ? along : t + lane;
      const y = horizontal ? t + lane : along;
      if (Math.hypot(x - avoidX, y - avoidY) > minDist) return { x, y, horizontal };
    }
    return { x: TILE * 31, y: TILE * 31, horizontal: true };
  }
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

function drawTree(g, x, y, r, rng) {
  g.fillStyle = 'rgba(30,30,20,0.25)';
  g.beginPath(); g.arc(x + r * 0.4, y + r * 0.4, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#3f7d3a';
  g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#549b45';
  g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.7, 0, Math.PI * 2); g.fill();
  if (rng) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(x - r * 0.4, y - r * 0.4, r * 0.3, 0, Math.PI * 2); g.fill(); }
}

function drawPalm(g, x, y, r) {
  g.fillStyle = 'rgba(30,30,20,0.28)';
  g.beginPath(); g.ellipse(x + r * 0.5, y + r * 0.5, r * 1.1, r * 0.7, 0, 0, Math.PI * 2); g.fill();
  // Fronds.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    g.strokeStyle = i % 2 ? '#2f7a3a' : '#3d8f45';
    g.lineWidth = r * 0.32;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8,
      x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
    g.stroke();
  }
  g.fillStyle = '#8a6b3f';
  g.beginPath(); g.arc(x, y, r * 0.22, 0, Math.PI * 2); g.fill();
}
