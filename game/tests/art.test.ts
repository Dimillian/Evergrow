import { drawCharacterPortrait } from '../src/character-portrait.ts';
import { initialPlayer } from '../src/simulation.ts';
import { playerPose } from '../src/character-pose.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ArtLibrary, drawHumanoid, type CharacterPose } from '../src/art.ts';
import { WEAPON_PROFILES, SHIELD_PROFILES } from '../src/weapon-content.ts';
import { HAIR_STYLES, SKIN_PALETTES, ACCESSORIES, FACIAL_HAIR, DEFAULT_APPEARANCE } from '../src/appearance-content.ts';

interface DrawingState {
  globalCompositeOperation: string; globalAlpha: number; fillStyle: string; strokeStyle: string;
  lineWidth: number; lineJoin: string; lineCap: string;
  transforms: number[][]; clips: number;
}

/** Geometry/state contract checks; intentionally no color or path snapshots. */
class ArtContext implements DrawingState {
  globalCompositeOperation = 'source-over';
  globalAlpha = .43;
  fillStyle = '#182736';
  strokeStyle = '#625343';
  lineWidth = 2.5;
  lineJoin = 'round';
  lineCap = 'round';
  transforms = [[1, 0, 0, 1, 123.25, -456.75]];
  clips = 1;
  commands = 0;
  fillColors = new Set<string>();
  fillOrder: string[] = [];
  imageSmoothingEnabled = true;
  private saved: DrawingState[] = [];
  get depth() { return this.saved.length; }
  state(): DrawingState {
    return { globalCompositeOperation: this.globalCompositeOperation, globalAlpha: this.globalAlpha, fillStyle: this.fillStyle, strokeStyle: this.strokeStyle,
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
  // Exercise the enlarged-portrait detail path as well as the ordinary geometry.
  getTransform() { return { a: 4, b: 0 }; }
  createLinearGradient(...values: number[]) { this.record(...values); return { addColorStop: (offset: number, _color: string) => this.record(offset) }; }
  createRadialGradient(...values: number[]) { return this.createLinearGradient(...values); }
  clip() { this.clips++; }
  beginPath() {}
  closePath() {}
  moveTo(...values: number[]) { this.record(...values); }
  lineTo(...values: number[]) { this.record(...values); }
  clearRect(...values: number[]) { this.record(...values); }
  ellipse(...values: number[]) { this.record(...values); }
  fillRect(...values: number[]) { this.fillColors.add(this.fillStyle); this.record(...values); }
  fill() { this.fillColors.add(this.fillStyle); this.fillOrder.push(this.fillStyle); this.record(); }
  stroke() { this.record(this.lineWidth); }
}

test('all character layers emit finite geometry and restore the caller state across poses and equipment', () => {
  const actions: Partial<CharacterPose>[] = [
    {}, { moving: 1, moveAngle: -.8, gaitPhase: 2.7 }, { attack: -.6 }, { attack: .1 }, { attack: .32 },
    { attack: .74 }, { cast: .8 }, { dodging: true, dodgeProgress: .55 },
    { impact: .7, impactAngle: .4, hitFlash: .11 }, { dead: true },
    { outfit: { head: null, chest: null, hands: null, legs: null, boots: null, cloak: null } },
  ];
  for (const kind of ['player', 'stalker', 'brute', 'caster', 'hound', 'archer', 'wisp'] as const) {
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

test('appearance study parts preserve finite drawing and canvas state across coverage, facings and actions', () => {
  for (const [index, hair] of HAIR_STYLES.entries()) for (let facing = 0; facing < 16; facing++) {
    for (const covered of [false, true]) for (const action of [{}, {moving:1, gaitPhase:2.7}, {attack:.4}, {cast:.6}, {dead:true}]) {
      const c = new ArtContext(), before = c.state();
      drawHumanoid(c as unknown as CanvasRenderingContext2D, {
        kind:'player', angle:facing * Math.PI / 8, attackAngle:facing * Math.PI / 8, time:2,
        moving:0, attack:0, hitFlash:0, dodging:false, ...action, ...(covered ? {} : {outfit:{head:null}}),
        appearance:{...DEFAULT_APPEARANCE, hair:hair.id, skin:SKIN_PALETTES[index % SKIN_PALETTES.length].id,
          accessory:ACCESSORIES[facing % ACCESSORIES.length].id, facialHair:FACIAL_HAIR[facing % FACIAL_HAIR.length].id},
      });
      assert.deepEqual(c.state(), before, `${hair.id} restores the drawing state`);
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
  assert.ok(canvases.length <= 257, '48 layered living trees, 48 dead trees, 32 rocks, 32 grasses, one shrine');
  const storedPixels = canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height, 0);
  assert.ok(storedPixels * 4 < 20 * 1024 * 1024, 'the full layered RGBA prop library stays below 20MiB');
  const commands = canvases.reduce((sum, canvas) => sum + canvas.context.commands, 0);
  const again = [art.getTree(42, false), art.getTree(42, true), art.getRock(42), art.getGrass(42), art.getShrine()];
  assert.ok(again.every((sprite, index) => sprite === first[index]));
  assert.equal(canvases.reduce((sum, canvas) => sum + canvas.context.commands, 0), commands,
    'cache hits never redraw the geometry');
});


test('every weapon family and shield silhouette draws finite connected equipment at all facings', () => {
  for (const weapon of WEAPON_PROFILES) for (let facing = 0; facing < 8; facing++) for (const attack of [0, .18, .32, .7]) {
    const offhands: CharacterPose['offHand'][] = weapon.hands === 2 ? [null] : [null,
      ...SHIELD_PROFILES.map(shield => ({ kind: 'shield' as const, visual: shield.visual })),
      { kind: 'weapon', visual: WEAPON_PROFILES.find(profile => profile.family === 'dagger')!.visual }];
    for (const offHand of offhands) {
      const c = new ArtContext(), before = c.state(), angle = facing * Math.PI / 4;
      drawHumanoid(c as unknown as CanvasRenderingContext2D, { kind: 'player', angle, attackAngle: angle,
        time: 3.2, moving: .6, attack, attackKind: weapon.attackKind === 'melee' ? 'melee' : 'ranged',
        weapon: weapon.visual, grip: weapon.hands === 2 ? 'two-handed' : 'one-handed', offHand,
        attackHand: offHand?.kind === 'weapon' ? 'off' : 'main', guard: .7,
        hitFlash: .05, dodging: false });
      assert.ok(c.commands > 0, weapon.name); assert.deepEqual(c.state(), before); assert.equal(c.depth, 0);
    }
  }
});


test('inventory and hall portraits retain saved armor colors and helmet visibility', () => {
  const player=initialPlayer(0,0);
  player.character.look.armorTints={chest:'teal',head:'violet'};
  player.character.look.showHelmet=true;
  const outfit=playerPose(player,0).outfit!;
  const chest=outfit.chest!.material.base,helmet=outfit.head!.material.base;
  for(const visible of [false,true]){
    player.character.look.showHelmet=visible;
    const ctx=new ArtContext();
    drawCharacterPortrait(ctx as unknown as CanvasRenderingContext2D,player,0,Math.PI/2,300,400);
    assert.ok(ctx.fillColors.has(chest),'portrait draws the saved chest tint');
    assert.equal(ctx.fillColors.has(helmet),visible,'portrait follows the saved helmet visibility');
  }
});


test('front-facing cape renders behind the legs; rear-facing cape covers them', () => {
  for (const angle of [Math.PI / 2, -Math.PI / 2]) {
    const ctx = new ArtContext();
    drawHumanoid(ctx as unknown as CanvasRenderingContext2D, {
      kind: 'player', angle, attackAngle: angle, time: 0, moving: 0, attack: 0, hitFlash: 0, dodging: false,
      outfit: {
        cloak: { base: '#a11233', shadow: '#443322', highlight: '#b13355', trim: '#ccbb99', seed: 1 },
        legs: { style: 'leather', seed: 2, material: { base: '#617231', shadow: '#334422', edge: '#aabb88', trim: '#998877' } },
      },
    });
    const cape = ctx.fillOrder.indexOf('#a11233'), leg = ctx.fillOrder.indexOf('#617231');
    assert.ok(cape >= 0 && leg >= 0);
    assert.equal(cape < leg, angle > 0);
    assert.equal(ctx.depth, 0);
  }
});
