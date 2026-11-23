const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

function loadTs(relative) {
  const file = path.join(__dirname, '..', relative);
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = module.paths;
  mod._compile(output, file);
  return mod.exports;
}
const {
  upsertDecision, removeDecision, countDecisions, shufflePhotos,
  suggestSourceIds, isAppAlbum, visiblePhotos, canDeleteCategory, reclassifyDecision,
} = loadTs('src/logic.ts');
const make = (id, action, category = null) => ({id, action, category, uri:'content://'+id, filename:id+'.jpg', synced:false,timestamp:0});
let state = [];
state = upsertDecision(state, make('a','keep','famille'));
state = upsertDecision(state, make('b','trash'));
assert.deepEqual(countDecisions(state), { kept:1, pending:1, deleted:0, reviewed:2 });
state = upsertDecision(state, make('b','keep','amis'));
assert.equal(state.length, 2, 'upsert should not create duplicates');
state = upsertDecision(state, make('a','deleted'));
assert.deepEqual(countDecisions(state), { kept:1, pending:0, deleted:1, reviewed:2 });
state = removeDecision(state, 'b');
assert.deepEqual(countDecisions(state), { kept:0, pending:0, deleted:1, reviewed:1 });

// V1 history suppresses already sorted photos from subsequent sessions.
assert.deepEqual(visiblePhotos([{ id:'a' },{ id:'b' },{ id:'c' }],
  [make('a','keep','famille'), make('b','trash')]), [{ id:'c' }]);
assert.deepEqual(suggestSourceIds([
  {id:'a',title:'Camera'}, {id:'b',title:'Voyages'}, {id:'c',title:'SwipeSort - Famille'},
  {id:'d',title:'Screenshots'}, {id:'e',title:'DCIM/Camera'},
]), ['a','e'], 'never select organized albums automatically');
assert.equal(isAppAlbum('swipesort - Mon album'), true);
assert.equal(isAppAlbum('Amis'), false);
assert.deepEqual(shufflePhotos([1,2,3], () => 0), [2,3,1]);
assert.deepEqual([1,2,3].sort(), [1,2,3], 'shuffle must not mutate input array');
assert.equal(canDeleteCategory({id:'famille'}, [{id:'famille'},{id:'amis'}], [make('a','keep','famille')]), false);
assert.equal(canDeleteCategory({id:'famille'}, [{id:'famille'},{id:'amis'}], [make('a','trash','famille')]), true);
assert.equal(canDeleteCategory({id:'famille'}, [{id:'famille'}], []), false);
const synced = { ...make('x','keep','famille'), synced:true };
assert.equal(reclassifyDecision([synced], 'x', 'couple')[0].synced, false);
assert.equal(reclassifyDecision([synced], 'x', 'famille')[0].synced, true);
console.log('✅ 14 logique / protection tests passed');
