import { test, expect } from '@playwright/test';

test('local game supports movement, combat, dodge, pause, recovery, and clean restart',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button',{name:'ENTER THE WOODS'})).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button',{name:'ENTER THE WOODS'}).click();
  await expect(page.locator('#overlay')).toBeHidden();
  // Read-only instrumentation is available on the development build.
  const initial=await page.evaluate(()=>{const g=(window as any).__evergrowing;return{x:g.sim.player.x,y:g.sim.player.y};});
  await page.keyboard.down('d');await page.waitForTimeout(350);await page.keyboard.up('d');
  const moved=await page.evaluate(()=>(window as any).__evergrowing.sim.player.x);
  expect(moved-initial.x).toBeGreaterThan(30);
  await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(()=>(window as any).__evergrowing.sim.player.dodgeCharges)).toBeLessThan(2);
  // Arrange one visible target using the same spawn API as encounters.
  await page.evaluate(()=>{const g=(window as any).__evergrowing;g.sim.reset();g.sim.enemies=[];g.renderer.reset();g.sim.spawnEnemy('stalker',34,0);});
  const target=await page.evaluate(()=>{const g=(window as any).__evergrowing,r=g.renderer;return{x:(34-r.cameraX+r.width/2)/r.width*innerWidth,y:(-r.cameraY+r.worldHeight/2)/r.height*innerHeight};});
  await page.mouse.move(target.x,target.y);await page.mouse.down();
  await expect.poll(()=>page.evaluate(()=>(window as any).__evergrowing.sim.kills)).toBeGreaterThan(0);
  await page.mouse.up();
  await page.mouse.click(1000,400,{button:'right'});
  await expect.poll(()=>page.evaluate(()=>(window as any).__evergrowing.sim.player.mana)).toBeLessThan(90);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading',{name:'PAUSED'})).toBeVisible();
  const pausedTime=await page.evaluate(()=>(window as any).__evergrowing.sim.time);
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>(window as any).__evergrowing.sim.time)).toBe(pausedTime);
  await page.selectOption('#display-mode','clean');
  await expect(page.locator('#visual')).toHaveText('CLEAN');
  await page.getByRole('button',{name:'RESUME',exact:true}).click();
  await page.evaluate(()=>{const g=(window as any).__evergrowing;g.sim.player.hp=50;g.sim.enemies=[];});
  await page.keyboard.press('q');
  await expect.poll(()=>page.evaluate(()=>(window as any).__evergrowing.sim.player.hp)).toBeGreaterThan(80);
  await page.evaluate(()=>{const g=(window as any).__evergrowing;g.sim.player.hp=0;g.sim.player.dead=true;});
  await expect(page.getByRole('heading',{name:'YOU FELL'})).toBeVisible();
  await page.getByRole('button',{name:'TRY AGAIN'}).click();
  expect(await page.evaluate(()=>(window as any).__evergrowing.sim.player.hp)).toBe(100);
  expect(await page.evaluate(()=>(window as any).__evergrowing.sim.kills)).toBe(0);
  await page.keyboard.down('w');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('w');
  await expect(page.getByRole('heading',{name:'PAUSED'})).toBeVisible();
  await page.getByRole('button',{name:'RESUME',exact:true}).click();
  const y=await page.evaluate(()=>(window as any).__evergrowing.sim.player.y);
  await page.waitForTimeout(150);
  expect(Math.abs(await page.evaluate(()=>(window as any).__evergrowing.sim.player.y)-y)).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('all generated assets and shader modes render without external media',async({page})=>{
  const requests:string[]=[];page.on('request',request=>requests.push(request.url()));
  await page.goto('/');await page.getByRole('button',{name:'ENTER THE WOODS'}).click();
  for(const mode of ['PHOSPHOR','CLEAN','CRT']){await page.keyboard.press('v');await expect(page.locator('#visual')).toHaveText(mode);}
  const stats=await page.evaluate(()=>{const g=(window as any).__evergrowing;const ctx=g.renderer.ctx,data=ctx.getImageData(0,0,g.renderer.width,g.renderer.height).data;let bright=0;for(let i=0;i<data.length;i+=4)if(data[i]+data[i+1]+data[i+2]>90)bright++;return{bright,width:g.renderer.width,height:g.renderer.height,webgl:!!g.fx.gl};});
  expect(stats.bright).toBeGreaterThan(stats.width*stats.height*.04);
  expect(requests.filter(url=>/^https?:/.test(url)&&!url.startsWith('http://127.0.0.1:5173'))).toEqual([]);
});
