'use strict';

const { maybeAutoReport } = require('../../bin/auto-report.js');
maybeAutoReport().then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error.message); process.exitCode = 1; });
