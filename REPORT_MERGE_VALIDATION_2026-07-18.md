# Report Merge Validation Status

Validation date: 2026-07-18
Branch: `feature/reports`
Target merge branch: `dev`

## 1. Summary

Current result: `automated checks passed`

Automated checks completed today:

- `npm.cmd run prisma:generate` -> passed
- `npm.cmd run prisma:seed` -> passed
- `npm.cmd run build` -> passed

Branch is not fully merge-approved yet because manual report UI checks and API regression checks still need to be completed.

## 2. Detailed results

### Passed

- Prisma Client generate completed successfully after stopping local project dev processes
- root workspace build completed successfully
- server TypeScript build completed successfully
- web TypeScript and Vite production build completed successfully
- Prisma seed completed successfully with the current schema and seed script

### Notes

- stale temporary Prisma engine files still exist under `node_modules\\.prisma\\client`, but they did not block the successful rerun once local dev processes were stopped
- the earlier failure was consistent with a Windows file-lock issue while project-local dev servers were active

## 3. Practical rule for next runs

Before retrying Prisma generate on this machine in the future:

1. Stop the local `NaverNameSeoTracker` dev server processes.
2. Run `npm.cmd run prisma:generate`.
3. Restart dev servers only after generate completes.

## 4. Manual checks still required

The following checklist items still need a person in the browser:

- report UI render check on desktop and narrow width
- report filter behavior check
- report preset save/load/delete/persist check
- empty-state recovery action check
- CSV file opening and visual content check in Excel
- API account validation test check
- SEARCH_AD live test check if credentials are available

## 5. Merge decision status

Current merge status: `manual validation pending`

Why:

- automated validation now passes
- manual branch verification is still pending

## 6. Next action

Use [REPORT_MERGE_CHECKLIST.md](D:\Codex\NaverNameSeoTracker\REPORT_MERGE_CHECKLIST.md) as the step-by-step pass/fail checklist.

After the manual checklist passes, `feature/reports` can be reviewed for merge into `dev`.

## 7. Observed process state during the original failure

The following project-local dev processes were running when Prisma generate previously failed on Saturday, July 18, 2026:

- workspace `npm run dev`
- server `tsx watch src/server.ts`
- web `vite`

Stopping those processes allowed `npm.cmd run prisma:generate` to succeed on the retry.

## 8. Local smoke checks before manual browser validation

- http://localhost:5173 responded with HTTP 200 on Saturday, July 18, 2026.
- http://localhost:4300/api/snapshot responded with HTTP 200 on Saturday, July 18, 2026.
- This confirms the local web shell and main API snapshot endpoint were both reachable before manual browser validation.

## 9. Snapshot data sanity before manual validation

- http://localhost:4300/api/snapshot returned structured data with the following counts on Saturday, July 18, 2026:
  - products: 1
  - experiments: 1
  - results: 2
  - jobs: 1
  - api accounts: 2
  - logs: 1
- Dashboard sample values at that moment:
  - running experiments: 1
  - up count: 1
  - down count: 1
  - average rank delta: -3.5
- This confirms the manual report UI checks will not be starting from an empty dataset.
