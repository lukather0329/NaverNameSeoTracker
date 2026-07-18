# Report Merge Validation Status

Validation date: 2026-07-18
Branch: `feature/reports`
Target merge branch: `dev`

## 1. Summary

Current result: `partially verified`

Automated checks completed today:

- `npm.cmd run prisma:seed` -> passed
- `npm.cmd run build` -> passed
- `npm.cmd run prisma:generate` -> blocked by Windows file-lock issue

Branch is not fully merge-approved yet because manual report UI checks and API regression checks still need to be completed, and `prisma:generate` should be re-run once the local lock issue is cleared.

## 2. Detailed results

### Passed

- root workspace build completed successfully
- server TypeScript build completed successfully
- web TypeScript and Vite production build completed successfully
- Prisma seed completed successfully with the current schema and seed script

### Blocked

- `npm.cmd run prisma:generate`
- observed error:
  - `EPERM: operation not permitted, rename ... node_modules\.prisma\client\query_engine-windows.dll.node.tmp... -> ... query_engine-windows.dll.node`
- likely cause:
  - local Windows file lock on Prisma engine binary
  - usually caused by a running process, antivirus scan, or stale handle on `.prisma\client`

## 3. Recommended fix for blocked item

Try these in order on the machine where validation is being run:

1. Stop any running dev server, Node process, or Prisma-related watcher.
2. Re-run `npm.cmd run prisma:generate`.
3. If it still fails, close terminals and retry once.
4. If it still fails, inspect whether security software or another process is holding `node_modules\.prisma\client\query_engine-windows.dll.node`.

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

Current merge status: `not yet approved`

Why:

- manual branch verification is still pending
- Prisma generate should be re-run successfully after lock issue is cleared

## 6. Next action

Use [REPORT_MERGE_CHECKLIST.md](D:\Codex\NaverNameSeoTracker\REPORT_MERGE_CHECKLIST.md) as the step-by-step pass/fail checklist.

After the blocked Prisma step is cleared and the manual checklist passes, `feature/reports` can be reviewed for merge into `dev`.
