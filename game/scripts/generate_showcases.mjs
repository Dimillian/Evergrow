import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\ManHua\\.gemini\\antigravity\\brain\\b49cd4e5-b124-4c57-85aa-00894d3a8954';
const PORT = 5195;

async function run() {
  console.log('Launching Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  await page.goto(`http://127.0.0.1:${PORT}/tools/skills.html?skill=fireball`);
  await page.waitForSelector('#arena');
  
  console.log('Generating reaction showcase images inside browser...');
  
  const results = await page.evaluate(async () => {
    const { Simulation } = await import('/src/simulation.ts');
    const { World } = await import('/src/world.ts');
    const { Renderer } = await import('/src/renderer.ts');
    const { PostFX } = await import('/src/postfx.ts');
    const { damageEnemy } = await import('/src/combat-damage.ts');
    
    function createRig(w = 640, h = 520) {
      const renderer = new Renderer();
      renderer.resize(w, h);
      const fx = new PostFX(renderer.canvas);
      const world = new World(7319);
      const query = {
        seed: world.seed,
        blocked: (x, y, r) => world.blocked(x, y, r),
        move: (x, y, dx, dy, r) => world.move(x, y, dx, dy, r)
      };
      const sim = new Simulation(query, { spawn: false, seed: 7319, startX: 0, startY: 0 });
      sim.setCombatViewport({ x: -w / 2, y: -h / 2, width: w, height: h });
      return { renderer, fx, world, sim, w, h };
    }
    
    function renderFrame(rig, plateTarget) {
      const { renderer, fx, world, sim, w, h } = rig;
      renderer.plateEnemy = plateTarget;
      renderer.plateOpacity = 1;
      renderer.cameraX = 35;
      renderer.cameraY = 0;
      renderer.render(sim, world, 1 / 60, { phase: 'playing', reducedMotion: false });
      fx.render(renderer.canvas, 0.05);
      
      const comp = document.createElement('canvas');
      comp.width = w;
      comp.height = h;
      const ctx = comp.getContext('2d');
      ctx.drawImage(renderer.canvas, 0, 0);
      renderer.renderUI(ctx, sim, world, { phase: 'playing', reducedMotion: false });
      return comp;
    }
    
    function makePairedShowcase(leftCanvas, rightCanvas, titleLeft, titleRight, subLeft, subRight, accentColor) {
      const totalW = 1300, totalH = 580;
      const combined = document.createElement('canvas');
      combined.width = totalW;
      combined.height = totalH;
      const ctx = combined.getContext('2d');
      
      // Dark background
      ctx.fillStyle = '#080c11';
      ctx.fillRect(0, 0, totalW, totalH);
      
      // Draw left panel
      ctx.drawImage(leftCanvas, 5, 35, 640, 500);
      // Draw right panel
      ctx.drawImage(rightCanvas, 655, 35, 640, 500);
      
      // Panel dividing line
      ctx.strokeStyle = '#1a2634';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(650, 10);
      ctx.lineTo(650, totalH - 10);
      ctx.stroke();
      
      // Header banners
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      
      // Left Banner
      ctx.fillStyle = '#101c2a';
      ctx.fillRect(15, 8, 620, 24);
      ctx.strokeStyle = '#263b52';
      ctx.strokeRect(15, 8, 620, 24);
      ctx.fillStyle = '#9bdbea';
      ctx.fillText(titleLeft, 325, 25);
      
      // Right Banner
      ctx.fillStyle = '#1b1422';
      ctx.fillRect(665, 8, 620, 24);
      ctx.strokeStyle = accentColor;
      ctx.strokeRect(665, 8, 620, 24);
      ctx.fillStyle = accentColor;
      ctx.fillText(titleRight, 975, 25);
      
      // Bottom Caption bars
      ctx.font = '12px sans-serif';
      // Left Caption
      ctx.fillStyle = '#0a121bf2';
      ctx.fillRect(15, totalH - 38, 620, 28);
      ctx.strokeStyle = '#263b52';
      ctx.strokeRect(15, totalH - 38, 620, 28);
      ctx.fillStyle = '#c7e0ea';
      ctx.fillText(subLeft, 325, totalH - 20);
      
      // Right Caption
      ctx.fillStyle = '#0a121bf2';
      ctx.fillRect(665, totalH - 38, 620, 28);
      ctx.strokeStyle = accentColor;
      ctx.strokeRect(665, totalH - 38, 620, 28);
      ctx.fillStyle = '#fce4c8';
      ctx.fillText(subRight, 975, totalH - 20);
      
      return combined.toDataURL('image/png');
    }
    
    // --- 1. MELT SHOWCASE ---
    let meltShowcaseData;
    {
      // Left: Primed Frost
      const rigL = createRig();
      const targetL = rigL.sim.spawnEnemy('brute', 55, 0);
      targetL.hp = targetL.maxHp = 2000;
      targetL.chillTime = 4.0;
      (targetL.statusDurations ??= {}).chill = 4.0;
      
      for (let i = 0; i < 5; i++) {
        rigL.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
        rigL.renderer.handleEvents(rigL.sim.drainEvents(), false);
      }
      const canvasL = renderFrame(rigL, targetL);
      
      // Right: Melt Impact
      const rigR = createRig();
      const targetR = rigR.sim.spawnEnemy('brute', 55, 0);
      targetR.hp = targetR.maxHp = 2000;
      targetR.chillTime = 4.0;
      (targetR.statusDurations ??= {}).chill = 4.0;
      
      rigR.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
      rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      
      const context = {
        player: rigR.sim.player,
        enemies: rigR.sim.enemies,
        random: () => 0.5,
        visible: () => true,
        emit: (e) => { rigR.sim.events.push(e); },
        killed: () => {}
      };
      damageEnemy(targetR, 150, 0, false, context, false, 'fire', 150);
      rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      
      for (let i = 0; i < 3; i++) {
        rigR.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
        rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      }
      const canvasR = renderFrame(rigR, targetR);
      
      meltShowcaseData = makePairedShowcase(
        canvasL, canvasR,
        'STATE 1: ENEMY PRIMED WITH FROST (CHILLED 4s BADGE + ICE CRYSTALS)',
        'STATE 2: FIRE DAMAGE HITS -> MELT REACTION (1.6x DMG: 240, GOLD MELT TAG)',
        'Left: Top plate shows Chilled 4s badge. Target body shows ice ring, ground spikes & floating crystals.',
        'Right: Fire damage consumes frost, triggering 1.6x Melt (150 -> 240) with golden MELT label and flame sparks.',
        '#ffd177'
      );
    }
    
    // --- 2. OVERLOAD SHOWCASE ---
    let overloadShowcaseData;
    {
      // Left: Primed Burn
      const rigL = createRig();
      const targetL = rigL.sim.spawnEnemy('brute', 55, 0);
      targetL.hp = targetL.maxHp = 2000;
      targetL.burnTime = 4.0;
      targetL.burnDps = 30;
      (targetL.statusDurations ??= {}).burn = 4.0;
      
      for (let i = 0; i < 5; i++) {
        rigL.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
        rigL.renderer.handleEvents(rigL.sim.drainEvents(), false);
      }
      const canvasL = renderFrame(rigL, targetL);
      
      // Right: Overload Impact
      const rigR = createRig();
      const targetR = rigR.sim.spawnEnemy('brute', 55, 0);
      targetR.hp = targetR.maxHp = 2000;
      targetR.burnTime = 4.0;
      targetR.burnDps = 30;
      (targetR.statusDurations ??= {}).burn = 4.0;
      
      rigR.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
      rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      
      const context = {
        player: rigR.sim.player,
        enemies: rigR.sim.enemies,
        random: () => 0.5,
        visible: () => true,
        emit: (e) => { rigR.sim.events.push(e); },
        killed: () => {}
      };
      damageEnemy(targetR, 140, 0, false, context, false, 'lightning', 140);
      rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      
      for (let i = 0; i < 3; i++) {
        rigR.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
        rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      }
      const canvasR = renderFrame(rigR, targetR);
      
      overloadShowcaseData = makePairedShowcase(
        canvasL, canvasR,
        'STATE 1: ENEMY PRIMED WITH BURNING (BURN 4s BADGE + FLAME TONGUES)',
        'STATE 2: LIGHTNING HITS -> OVERLOAD REACTION (140px AOE SHOCKWAVE + OVERLOAD TAG)',
        'Left: Top plate displays Burn 4s badge. Target body shows burning aura, fire ring & rising flame tongues.',
        'Right: Lightning detonates burn into 140px radial shockwave blast, knockback, and pink OVERLOAD label.',
        '#ff77aa'
      );
    }
    
    // --- 3. SUPERCONDUCT SHOWCASE ---
    let superconductShowcaseData;
    {
      // Left: Primed Frost
      const rigL = createRig();
      const targetL = rigL.sim.spawnEnemy('brute', 55, 0);
      targetL.hp = targetL.maxHp = 2000;
      targetL.chillTime = 4.0;
      (targetL.statusDurations ??= {}).chill = 4.0;
      
      for (let i = 0; i < 5; i++) {
        rigL.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
        rigL.renderer.handleEvents(rigL.sim.drainEvents(), false);
      }
      const canvasL = renderFrame(rigL, targetL);
      
      // Right: Superconduct Impact
      const rigR = createRig();
      const targetR = rigR.sim.spawnEnemy('brute', 55, 0);
      targetR.hp = targetR.maxHp = 2000;
      targetR.chillTime = 4.0;
      (targetR.statusDurations ??= {}).chill = 4.0;
      
      rigR.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
      rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      
      const context = {
        player: rigR.sim.player,
        enemies: rigR.sim.enemies,
        random: () => 0.5,
        visible: () => true,
        emit: (e) => { rigR.sim.events.push(e); },
        killed: () => {}
      };
      damageEnemy(targetR, 150, 0, false, context, false, 'lightning', 150);
      rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      
      for (let i = 0; i < 3; i++) {
        rigR.sim.update(1/60, { moveX: 0, moveY: 0, aimX: 55, aimY: 0, attack: false, dodge: false, heal: false, skillSlot: null });
        rigR.renderer.handleEvents(rigR.sim.drainEvents(), false);
      }
      const canvasR = renderFrame(rigR, targetR);
      
      superconductShowcaseData = makePairedShowcase(
        canvasL, canvasR,
        'STATE 1: ENEMY PRIMED WITH FROST (CHILLED 4s BADGE + ICE SPIKES)',
        'STATE 2: LIGHTNING HITS -> SUPERCONDUCT (SUPERCONDUCT TAG + FRACTURE DEBUFF)',
        'Left: Top plate shows Chilled 4s badge. Target body shows frost aura, ice spikes & floating ice crystals.',
        'Right: Superconduct applies Fracture 3s armor shred debuff, ice-cyan label & cracked electric armor sparks.',
        '#76b9ee'
      );
    }
    
    return {
      melt: meltShowcaseData,
      overload: overloadShowcaseData,
      superconduct: superconductShowcaseData
    };
  });
  
  function savePng(base64Data, filename) {
    const raw = base64Data.replace(/^data:image\/png;base64,/, '');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, raw, 'base64');
    console.log(`Saved ${filename} to ${outPath}`);
  }
  
  savePng(results.melt, 'melt_showcase.png');
  savePng(results.overload, 'overload_showcase.png');
  savePng(results.superconduct, 'superconduct_showcase.png');
  
  await browser.close();
  console.log('All showcases generated successfully!');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
