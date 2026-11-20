// Transient visual effects: sparks, blood, muzzle flashes, smoke, explosions
// and tyre skid marks, all drawn as short-lived decal particles.

export function makeEffects() {
  return {
    particles: [],
    decals: [],

    spark(x, y) {
      for (let i = 0; i < 6; i++) {
        this.particles.push({
          x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160,
          life: 0.25, max: 0.25, kind: 'spark',
        });
      }
    },
    muzzle(x, y) {
      this.particles.push({ x, y, vx: 0, vy: 0, life: 0.09, max: 0.09, kind: 'muzzle' });
    },
    blood(x, y) {
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x, y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90,
          life: 0.5, max: 0.5, kind: 'blood',
        });
      }
      this.decals.push({ x, y, r: 7 + Math.random() * 5, kind: 'blood' });
      if (this.decals.length > 120) this.decals.shift();
    },
    smoke(x, y, big = false) {
      this.particles.push({
        x, y, vx: (Math.random() - 0.5) * 24, vy: -20 - Math.random() * 20,
        life: big ? 1.1 : 0.6, max: big ? 1.1 : 0.6, kind: 'smoke', r: big ? 14 : 7,
      });
    },
    explosion(x, y) {
      for (let i = 0; i < 26; i++) {
        this.particles.push({
          x, y, vx: (Math.random() - 0.5) * 320, vy: (Math.random() - 0.5) * 320,
          life: 0.5 + Math.random() * 0.4, max: 0.9, kind: 'fire',
        });
      }
      this.smoke(x, y, true);
      this.decals.push({ x, y, r: 22, kind: 'scorch' });
    },
    skid(car) {
      const back = car.angle + Math.PI;
      const ox = Math.cos(back) * car.w * 0.3, oy = Math.sin(back) * car.w * 0.3;
      const px = Math.cos(car.angle + Math.PI / 2) * car.h * 0.4;
      const py = Math.sin(car.angle + Math.PI / 2) * car.h * 0.4;
      this.decals.push({ x: car.x + ox + px, y: car.y + oy + py, r: 2.5, kind: 'skid' });
      this.decals.push({ x: car.x + ox - px, y: car.y + oy - py, r: 2.5, kind: 'skid' });
      if (this.decals.length > 400) this.decals.splice(0, 40);
    },
    update(dt) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.life -= dt;
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        if (p.kind === 'smoke') p.r += dt * 14;
        if (p.life <= 0) this.particles.splice(i, 1);
      }
    },
  };
}
