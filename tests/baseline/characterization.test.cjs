'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const frozen = require('../../docs/audit/baseline-characterization.json');
const inventory = require('../../docs/audit/source-inventory.json');
const root = path.resolve(__dirname, '../..');

for (const scenario of frozen.cases) {
  test(`baseline contract: ${scenario.id}`, () => {
    const entry = inventory.files.find((file) => file.source_path === `bin/${scenario.module}.js`);
    const target = entry.target_path;
    assert.ok(fs.existsSync(path.join(root, target)), `Missing implementation: ${target}`);
    const implementation = require(path.join(root, target));
    let actual;
    try { actual = { returned: implementation[scenario.function](...structuredClone(scenario.args)) }; }
    catch (error) { actual = { threw: { name: error.name, message: error.message } }; }
    assert.deepEqual(actual, scenario.result);
  });
}

test('baseline was captured from the audited source hashes', () => {
  assert.equal(frozen.baseline_commit, inventory.baseline_commit);
  for (const source of frozen.sources) assert.equal(source.sha256, inventory.files.find((file) => file.source_path === source.path).sha256);
});
