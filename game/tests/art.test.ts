import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtLibrary, drawHumanoid, type CharacterPose } from '../src/art.ts';

interface DrawingState {
  globalAlpha: number; fillStyle: string; strokeStyle: string;
  lineWidth: number; lineJoin: string; lineCap: string;
  transforms: number[][]; clips: number;
}

/** Geometry/state contract checks; intentionally no color or path snapshots. */
class ArtContext implements DrawingState {
  globalAlpha = .43;
  fillStyle = '#182736';
  strokeStyle = '#625343';
  lineWidth = 2.5;
  lineJoin = 'round';
  lineCap = 'round';
  transforms = [[1, 0, 0, 1, 123.25, -456.75]];
  clips = 1;
  commands = 0;
  imageSmoothingEnabled = true;
  private saved: DrawingState[] = [];
  get depth() { return this.saved.length; }
  state(): DrawingState {
    return { globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth, lineJoin: this.lineJoin, lineCap: this.lineCap,
      transforms: this.transforms.map(value => [...value]), clips: this.clips };
  }
  save() { this.saved.push(this.state()); }
  restore() { Object.assign(this, this.saved.pop()!); }
  private record(...values: number[]) {
    assert.ok(values.every(Number.isFinite), 'all emitted geometry must be finite');
    this.commands++;
  }
  transform(...values: number[]) { this.record(...values); this.transforms.push(values); }
  translate(...values: number[]) { this.transform(...values); }
  rotate(...values: number[]) { this.transform(...values); }
  scale(...values: number[]) { this.transform(...values); }
  clip() { this.clips++; }
  beginPath() {}
  closePath() {}
  moveTo(...values: number[]) { this.record(...values); }
  lineTo(...values: number[]) { this.record(...values); }
  fillRect(...values: number[]) { this.record(...values); }
  fill() { this.record(); }
  stroke() { this.record(this.lineWidth); }
}

test('all character layers emit finite geometry and restore the caller state across poses and equipment', () => {
  const actions: Partial<CharacterPose>[] = [
    {}, { moving: 1, moveAngle: -.8, gaitPhase: 2.7 }, { attack: -.6 }, { attack: .1 }, { attack: .32 },
    { attack: .74 }, { cast: .8 }, { dodging: true, dodgeProgress: .55 },
    { impact: .7, impactAngle: .4, hitFlash: .11 }, { dead: true },
    { outfit: { head: null, chest: null, hands: null, legs: null, boots: null, cloak: null } },
  ];
  for (const kind of ['player', 'stalker', 'brute', 'caster'] as const) {
    for (let facing = 0; facing < 8; facing++) for (const action of actions) {
      const c = new ArtContext(), before = c.state();
      drawHumanoid(c as unknown as CanvasRenderingContext2D, {
        kind, angle: facing * Math.PI / 4, attackAngle: facing * Math.PI / 4 + .3,
        time: 4.7, moving: 0, attack: 0, hitFlash: 0, dodging: false, ...action,
      });
      assert.ok(c.commands > 0);
      assert.deepEqual(c.state(), before, `${kind} restores transforms, alpha and drawing styles`);
      assert.equal(c.depth, 0);
    }
  }
});

test('travelling through thousands of prop seeds reuses a finite procedural sprite library', () => {
  const canvases: Array<{ width: number; height: number; context: ArtContext }> = [];
  const art = new ArtLibrary((width, height) => {
    const canvas = { width, height, context: new ArtContext(), getContext() { return this.context; } };
    canvases.push(canvas);
    return canvas as unknown as HTMLCanvasElement;
  });
  const first = [art.getTree(42, false), art.getTree(42, true), art.getRock(42), art.getGrass(42), art.getShrine()];
  for (let seed = -5000; seed <= 5000; seed++) {
    art.getTree(seed, false); art.getTree(seed, true); art.getRock(seed); art.getGrass(seed); art.getShrine();
  }
  assert.ok(canvases.length <= 161, '48 variants per tree family, 32 rocks, 32 grasses, one shrine');
  const storedPixels = canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);
  assert.ok(storedPixels * 4 < 7.5 * 1024 * 1024, 'the full RGBA prop library stays below 7.5MiB');
  const commands = canvases.reduce((sum, canvas) => sum + canvas.context.commands, 0);
  const again = [art.getTree(42, false), art.getTree(42, true), art.getRock(42), art.getGrass(42), art.getShrine()];
  assert.ok(again.every((sprite, index) => sprite === first[index]));
  assert.equal(canvases.reduce((sum, canvas) => sum + canvas.context.commands, 0), commands,
    'cache hits never redraw the geometry');
});
