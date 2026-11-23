const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '..', 'src', 'pinch.ts');
const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(result.diagnostics?.length || 0, 0);
const mod = new Module(file, module);
mod.filename = file; mod.paths = module.paths; mod._compile(result.outputText, file);
const { pinchDistance, pinchScale } = mod.exports;
assert.equal(pinchDistance([{pageX:0,pageY:0},{pageX:0,pageY:100}]), 100);
assert.equal(pinchDistance([{pageX:10,pageY:40},{pageX:70,pageY:120}]),100);
assert.equal(pinchDistance([{pageX:1,pageY:1}]),0);
assert.equal(pinchScale(200,100),2);
assert.equal(pinchScale(400,100),3);
assert.equal(pinchScale(80,100),1);
assert.equal(pinchScale(90,0),1);
assert.equal(pinchScale(120,NaN),1);
console.log('✓ pinch zoom: 8 checks passed');
