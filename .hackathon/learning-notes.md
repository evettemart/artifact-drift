# Learning Notes

Short answers are fine. You do not need to paste transcripts.

## AI Usage Summary

Bob (agent mode) was used throughout — for initial scaffolding, agent implementation, API orchestration wiring, bug diagnosis, and the readiness review. Claude's vision API (`claude-3-5-sonnet-20241022`) is embedded directly in the `designIntentStatic` agent to extract infrastructure resources from uploaded architecture diagram images. We used Bob interactively to implement each of the five agents, debug live-mode pipeline issues, and trace data flow through the SQLite persistence layer.

## Useful AI Help

The most valuable AI contribution was diagnosing and fixing a non-obvious data scoping bug in the Drift page: findings were always filtered to zero rows because `f.scanId` (the completed run ID) never matched `scanId` (the workspace ID) in the client-side filter. Bob identified both the root cause and the fix — scoping the `getFindings` API call to `runId || scanId` and removing the stale cross-ID client filters — in one pass after inspecting the actual SQLite rows.

Bob also generated the full `DriftAnalysisAgent` rewrite (replacing a 73-line stub with a 360-line self-contained engine implementing all 8 drift types, index-based lookups, fuzzy resource matching, and attribute/tag/SG comparison) from the `.claude/agents/drift-analysis-agent.md` spec in a single turn.

## Human Review And Corrections

- The AWS integration global fallback required human diagnosis: all integrations were stored under `projectId: 'demo-project'` while workspace scans had different project IDs. The 3-level fallback (project → all-project → global) was designed based on reading the existing terraform pattern, but required a DB inspection to confirm the mismatch.
- The `driftComparison` function and `runId` state were observed to conflict — `runId` in the dropdown held a completed `scan-xxx` ID but findings used `"planned__deployed"` as their run key. Required human verification of the actual DB values before the fix was applied.
- Agent spec imports were flagged as unused by TypeScript (`RelationshipType`, `DEFAULT_SEVERITY_WEIGHTS`) and corrected.

## Iteration Or Pivot

Initial `DriftAnalysisAgent` used a comparator injection pattern (`new DriftAnalysisAgent(detectDrift)`) that delegated all logic to `detectDrift` in `analysis.ts`. The spec called for a self-contained class with indexing and fuzzy matching. We pivoted to the spec's design and kept backward compatibility via a `LegacyComparator` type so `analysis.ts` didn't need a full rewrite — then updated `runFullAnalysis` to use the new config-object constructor and fully activate the engine.

The three-layer graph initially had an empty `deployed` layer because `POST /analyze` hardcoded `awsResources: []`. The fix required understanding both the agent wiring gap and the project-ID mismatch in the integration table — two independent issues that both had to be resolved.

## With One More Day

- Add an automated test suite: at minimum, unit tests for `driftAnalysis.ts` covering each of the 8 drift types with fixture data, and an integration test for `POST /analyze` using mock integrations.
- Implement a `DEMO.md` step-by-step demo script so any team member can reproduce the walkthrough reliably.
- Extend the drift engine to support multi-account AWS (currently single-region, first integration only).
- Add a dashboard chart that shows drift trends across scan runs over time (the data is already in the DB, the UI just doesn't visualize it yet).
