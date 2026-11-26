'use strict';

const fs = require('node:fs');
const queue = require('../../bin/sync-queue.js');
const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
(async () => {
  if (input.action === 'enqueue') {
    for (let index = 0; index < (input.count || 1); index++) queue.enqueue({ ...input.item, client_report_id: (input.count || 1) > 1 ? `${input.item.client_report_id}-${index}` : input.item.client_report_id });
    console.log(JSON.stringify({ enqueued: input.count || 1 }));
  } else if (input.action === 'post') console.log(JSON.stringify(await queue.postOnce(input.item, input.token)));
  else if (input.action === 'read') console.log(JSON.stringify(queue.readQueue()));
  else throw new Error('UNKNOWN_TEST_ACTION');
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
