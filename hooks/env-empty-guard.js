#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

function inspect(command) {
  const text = String(command || '');
  const setting = /(?:^|[;&|])\s*(?:(?:npx\s+)?supabase\s+secrets\s+set|gh\s+secret\s+set)\b/i.test(text);
  if (!setting) return { allowed: true, scope: 'not_a_secret_write' };
  const emptyAssignments = [...text.matchAll(/\b([A-Z][A-Z0-9_]*)=(?:""|''|(?=\s|$))/g)].map((match) => match[1]);
  const emptyBody = /\bgh\s+secret\s+set\s+[^\s]+[\s\S]*--body(?:=|\s+)(?:""|'')(?=\s|$)/i.test(text);
  return emptyAssignments.length || emptyBody ? { allowed: false, reason: 'EMPTY_SECRET_VALUE', variable_names: emptyAssignments } : { allowed: true, scope: 'no_literal_empty_secret_detected', limitation: 'Runtime values still require provider/server validation' };
}

if (require.main === module) {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
    const result = inspect(input.tool_input?.command || input.arguments?.command || '');
    if (!result.allowed) { console.error(`BLOCKED: ${result.reason}. Configure a real secret or explicitly remove an unused integration; values are never logged.`); process.exitCode = 2; }
  } catch { console.error('BLOCKED: SECRET_WRITE_INPUT_COULD_NOT_BE_VALIDATED'); process.exitCode = 2; }
}
module.exports = { inspect };
