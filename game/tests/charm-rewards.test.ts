import test from 'node:test';
import assert from 'node:assert/strict';
import { generateItem, generateRewardItem } from '../src/items.ts';
import { eventRewards } from '../src/poi-rewards.ts';
import type { EventKind, EventRecord } from '../src/poi-content.ts';
import { validItem } from '../src/item-validation.ts';
import { rollEnemyLoot } from '../src/loot.ts';

test('every item-giving event can roll charms, including themed rewards and boss chests', () => {
  const kinds: EventKind[] = ['camp','caravan','graveyard','reliquary','cursedChest',
    'ruinedChapel','beastDen','quarry','hamlet','crossing','corruptedGrove','bossLair'];
  for (const kind of kinds) {
    let charms = 0, items = 0;
    for (let seed = 0; seed < 2000; seed++) {
      const site: EventRecord = {id:`audit:${kind}:${seed}`,kind,seed,name:'Reward study',x:0,y:0,
        biome:'verdant',level:16,phase:'completed',choice:'goods',delivered:0,wavesCleared:6,bonusGranted:false};
      const reward = eventRewards(site);
      items += reward.items.length;
      for (const item of reward.items) {
        if (item.kind !== 'charm') {
          if (kind === 'beastDen') assert.equal(item.recipe.materialId,'leather');
          if (kind === 'corruptedGrove' && item.kind === 'weapon') assert.equal(item.recipe.profileId,'ember-staff');
          continue;
        }
        charms++;
        assert.ok(validItem(item), `${kind}: valid stone without equipment material/profile`);
        assert.ok(item.itemLevel >= site.level);
      }
      if (kind === 'bossLair') {
        assert.equal(reward.items.length,3);
        assert.ok(['rare','epic','legendary'].includes(reward.items[0].tier));
      }
      if (seed === 118) assert.deepEqual(eventRewards(site),reward,'retries preserve item identities and rolls');
    }
    assert.ok(items > 0, kind);
    assert.ok(charms/items > .025 && charms/items < .08, `${kind}: ${charms}/${items}`);
  }
});

test('reward charm rolls never replace explicit shop/forge equipment requests or double-roll generic loot', () => {
  let themed = 0, generic = 0;
  for(let seed=0;seed<10000;seed++) {
    const item=generateRewardItem(seed,16,'chest',undefined,'rare','leather');
    const loose=generateRewardItem(seed,16,undefined,undefined,'rare');
    themed+=Number(item.kind==='charm');generic+=Number(loose.kind==='charm');
    assert.equal(item.tier,'rare');
    assert.equal(generateItem(seed,16,'chest',undefined,'rare','leather').kind,'chest');
  }
  assert.equal(themed,generic,'one shared charm roll, irrespective of the equipment theme');
  assert.ok(generic>400&&generic<600,`${generic}/10000`);
});

test('dungeon chest first-item rolls include charms at the shared five-percent rate', () => {
  for(const encounter of ['chest','bossChest'] as const) {
    let charms=0;
    for(let seed=0;seed<10000;seed++) {
      const [item]=rollEnemyLoot({seed,level:16,rank:'veteran',kind:'stalker',biome:'verdant',firstKill:true,encounter});
      assert.ok(item);
      charms+=Number(item.kind==='charm');
    }
    assert.ok(charms>400&&charms<600,`${encounter}: ${charms}/10000`);
  }
});
