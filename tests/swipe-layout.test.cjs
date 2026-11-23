const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '..', 'src', 'swipe-layout.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length || 0, 0, 'TypeScript transpilation errors');
const mod = new Module(file, module);
mod.filename = file;
mod.paths = module.paths;
mod._compile(compiled.outputText, file);
const { fitPhotoAtTop, formatPhotoMonth } = mod.exports;
// Landscape: should start at top, not occupy a tall centered image frame.
assert.deepEqual(fitPhotoAtTop(390, 700, 1920, 1080), {width: 390, height: 219.375});
// Portrait: use the full height without cropping the original.
const portrait = fitPhotoAtTop(390, 700, 1080, 1920);
assert.ok(Math.abs(portrait.height - 693.3333333333333) < 0.001);
assert.ok(Math.abs(portrait.width - 390) < 0.001);
// Extreme portrait: use the viewport height and retain original aspect ratio.
const long = fitPhotoAtTop(390, 700, 500, 2000);
assert.equal(long.height, 700);
assert.equal(long.width, 175);
assert.deepEqual(fitPhotoAtTop(0, 700, 100, 100), {width: 0, height: 0});
assert.deepEqual(fitPhotoAtTop(390, 700, NaN, 0), {width: 390, height: 700});
console.log('✓ photo geometry: 5 checks passed');

// The V1.3 screenshot showed year 58772: creationTime came in milliseconds.
const timestamp = Date.UTC(2026, 10, 23, 12, 0, 0);
assert.match(formatPhotoMonth(timestamp), /nov\. 2026/);
assert.match(formatPhotoMonth(Math.floor(timestamp / 1000)), /nov\. 2026/);
assert.equal(formatPhotoMonth(NaN), '');
console.log('✓ photo date normalization: 3 checks passed');
