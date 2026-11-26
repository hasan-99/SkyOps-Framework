# SkyOps benchmark methodology

Authority: `SKYOPS_TRANSFORMATION_PLAN.md`, Sections 21–28. This defines measurements; it does not claim an improvement.

## Reproducibility

Record the source commit, package/runtime versions, host version, model/effort settings, execution depth, CPU, RAM, OS, GPU availability, workload and dataset versions, cache state and configured limits. Keep Windows, Linux, macOS and WSL measurements distinct.

Use equivalent acceptance criteria and authorized synthetic fixtures before and after an optimization. Original workflows that cannot run must be marked unavailable. Do not invent upstream baselines for reconstructed or new behavior.

Separate cold and warm runs. Repeat deterministic local measurements and report sample count, median and range. Use percentiles only when the sample size supports them. Repeat AI-driven workloads within configured spending limits and report model variability. Quality/security failure invalidates a claimed improvement.

## Metrics

| Metric | Evidence |
| --- | --- |
| Correctness and quality | Acceptance, regression, browser, design and security results |
| Time | Measured wall time; distinguish total worker time from the parallel critical path |
| Tokens | Native input/output/cached usage when available; estimates labelled; otherwise unavailable |
| Context | SkyOps-injected UTF-8 bytes and configured/tokenizer counts; do not label this the host's entire context |
| Agents | Actual dispatch count, concurrency and retries by role |
| Tools | MCP, deterministic helper, research and integration calls |
| Infrastructure | Database calls, Edge calls, transferred bytes, storage and sync operations |
| Embeddings | Model/hash, cold/warm startup, throughput, search latency, peak RAM, disk and English/Arabic retrieval quality |

## Dataset and privacy

Use synthetic users, workspaces, teams, projects, documents and provider test accounts. Never use original private logs, client data, credentials or personal histories. Isolate caches and test directories. Any shared telemetry remains subject to the approved role/privacy boundaries.

## Budgets and publication

Record limits and whether they were reached. A budget halt is incomplete work, not a passed workflow. Do not omit mandatory checks, truncate acceptance criteria or silently drop queued writes. Publish a performance claim only with its workload, comparable measurements, quality results and limitations.

The ten end-to-end scenario specifications are recorded in `acceptance-scenarios.json`. Their initial state is not run; defining a scenario does not execute or validate it.
