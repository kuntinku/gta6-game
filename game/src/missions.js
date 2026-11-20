// Missions and the story of "Palma Verde: Sun & Crime". Each mission is a
// chain of objectives with a world marker, a name and a payout; a courier
// boss named El Coco hands the jobs out over a cracked phone speaker.

import { TILE, WORLD_W } from './config.js';

export const STORY = [
  {
    name: 'Sunblock',
    giver: 'Rico',
    brief: 'Rico needs wheels that are not his. Boost any car and bring it to the impound lot.',
    type: 'getCar',
    reward: 250,
  },
  {
    name: 'Taco Run',
    giver: 'Lola',
    brief: 'Pick up Lola\'s "special order" downtown, then deliver it before it cools.',
    type: 'delivery',
    reward: 400,
  },
  {
    name: 'Heatwave',
    giver: 'El Coco',
    brief: 'El Coco wants a police cruiser parked at the boathouse. Try not to be followed.',
    type: 'getCopCar',
    reward: 550,
  },
  {
    name: 'Palm Royale',
    giver: 'Lola',
    brief: 'A sports car is idling outside the casino. It wants a new owner. You.',
    type: 'getSportsCar',
    reward: 700,
  },
  {
    name: 'The Long Goodbye',
    giver: 'El Coco',
    brief: 'One last job: lose the heat completely and meet El Coco on the pier.',
    type: 'escape',
    reward: 900,
  },
];

export function makeMissionRunner(game) {
  const state = {
    index: 0,
    stage: 'brief',     // brief | active | done
    objective: null,    // {x, y, label}
    timer: 0,
    banner: 0,
    bannerText: '',
    completedMoney: 0,
    game,

    current() { return STORY[Math.min(this.index, STORY.length - 1)]; },

    begin() {
      const m = this.current();
      const rng = game.rng;
      this.stage = 'active';
      this.showBanner(`MISSION: ${m.name}`);
      if (m.type === 'delivery') {
        this.objective = { x: rng() * WORLD_W * 0.6 + TILE * 12, y: rng() * WORLD_H * 0.6 + TILE * 12, label: 'Pick up the package' };
        this.phase = 'pickup';
      } else if (m.type === 'escape') {
        this.objective = null;
        this.phase = 'loseHeat';
        this.timer = 0;
      } else {
        this.objective = null;
        this.phase = 'getCar';
      }
    },

    showBanner(text) { this.banner = 4; this.bannerText = text; },

    update(dt) {
      const g = this.game;
      if (this.banner > 0) this.banner -= dt;
      if (this.stage !== 'active') return;
      const m = this.current();

      if (m.type === 'delivery') {
        if (this.phase === 'pickup' && Math.hypot(g.player.x - this.objective.x, g.player.y - this.objective.y) < 60) {
          this.phase = 'dropoff';
          this.objective = { x: TILE * 6, y: TILE * 44, label: 'Deliver the package' };
          this.showBanner('PICKED UP — NOW DELIVER');
        } else if (this.phase === 'dropoff' && Math.hypot(g.player.x - this.objective.x, g.player.y - this.objective.y) < 60) {
          this.complete();
        }
      } else if (m.type === 'getCar' || m.type === 'getSportsCar' || m.type === 'getCopCar') {
        const car = g.player.inCar;
        const want = m.type === 'getCopCar' ? 'police' : m.type === 'getSportsCar' ? 'sports' : null;
        if (car && (!want || car.type === want)) {
          // Drive to the boathouse marker.
          if (!this.objective) this.objective = { x: TILE * 52, y: TILE * 34, label: `Bring it to the ${m.type === 'getCopCar' ? 'boathouse' : 'lot'}` };
          if (Math.hypot(g.player.x - this.objective.x, g.player.y - this.objective.y) < 70) this.complete();
        }
      } else if (m.type === 'escape') {
        if (g.wanted.stars === 0 && g.copContactTimer > 6) this.complete();
        else if (g.wanted.stars > 0) g.copContactTimer = 0;
      }
    },

    complete() {
      const g = this.game;
      const m = this.current();
      g.player.money += m.reward;
      this.completedMoney += m.reward;
      this.stage = 'done';
      this.objective = null;
      this.showBanner(`MISSION PASSED — $${m.reward}`);
      g.saveProgress();
      this.index++;
      if (this.index < STORY.length) {
        setTimeoutLike(g, 3, () => { this.stage = 'brief'; this.begin(); });
      } else {
        this.showBanner('STORY COMPLETE — PALMA VERDE IS YOURS');
      }
    },
  };
  return state;
}

// Deterministic "setTimeout": the game loop drives pending callbacks so
// screenshots stay reproducible from the seed alone.
const pending = [];
export function setTimeoutLike(game, seconds, fn) {
  pending.push({ game, at: game.time + seconds, fn });
}
export function runTimers(game, dt) {
  for (let i = pending.length - 1; i >= 0; i--) {
    if (pending[i].game !== game) continue;
    if (game.time >= pending[i].at) {
      const fn = pending[i].fn;
      pending.splice(i, 1);
      fn();
    }
  }
}
