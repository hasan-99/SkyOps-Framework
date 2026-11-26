'use strict';

const fs = require('node:fs');
const { request } = require('../../framework/cloud-transport.cjs');
const { pullWorkPacket } = require('../../bin/work-packet.js');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
(async () => {
  const result = input.action === 'pull' ? await pullWorkPacket(input.options || {}) : await request(input.resource, input.options || {});
  console.log(JSON.stringify(result));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
