# Company PC Handoff

Last updated: 2026-07-17
Current repo: `D:\Codex\NaverNameSeoTracker`
Primary remote: `https://github.com/lukather0329/NaverNameSeoTracker.git`
Current focus branch: `feature/reports`

## 1. Sync status as of 2026-07-17

- `main`
  - synced with `origin/main`
- `dev`
  - synced with `origin/dev`
- `feature/api-accounts`
  - latest pushed commit: `af888e7 docs: add company handoff checklist`
- `feature/products`
  - latest pushed commit: `85075ee feat: add product management workflow`
- `feature/seo-title-apply`
  - latest pushed commit: `24bb8fc feat: add SEO title apply workflow`
- `feature/rank-tracking`
  - latest pushed commit: `1c0b5a1 docs: refresh company PC handoff status`
- `feature/reports`
  - current working branch
  - latest pushed commit: `f2d9f99 feat: track active report sort state`
  - report screen, filters, summary cards, experiment report table, and CSV export flow are implemented
  - saved report filter presets are implemented with local persistence, active preset display, and recent-use reorder
  - report CSV exports include active filter summary rows
  - report table shows applied filters and empty-state recovery actions
  - report top summary chips show experiment count, result count, effective count, worse count, completed count, and running count
  - workspace build re-verified on 2026-07-17 with `npm run build`
  - local API health and snapshot verified after dotenv/prisma bootstrap fix on 2026-07-16
  - sample seed data restored and snapshot data verified on 2026-07-16
  - API account save flow verified on 2026-07-16
- SEARCH_AD live connection test added on 2026-07-16 (COMMERCE/CUSTOM remain validation-only)

## 2. First steps on company PC

```bash
cd /d/codex/NaverNameSeoTracker
git fetch --all --prune
git checkout feature/reports
git pull origin feature/reports
```

## 3. What was added on this branch

- `reports` navigation menu
- report summary cards for experiment count, effective count, active jobs, tracked keywords, average delta
- experiment-level report table
- CSV export for experiment report
- CSV export for ranking results
- CSV filter summary rows for both report exports
- report filters for search, product, experiment, status, judgement, tracked window, custom date range, and sort
- saved report filter presets with save/load/delete flow
- active report preset display and recent-use reorder behavior
- applied report filter summary block above the report table
- report empty-state recovery actions for invalid date range and full filter reset
- report top summary chips for result count, effective/worse count, completed count, and running count
- improved report mobile layout and chip wrapping behavior
- API account registration form
- API account active toggle
- API account connection test endpoint and UI
- SEARCH_AD real external-call test via Naver SearchAd `/ncc/campaigns`
- API account test logs are now stored in `SystemLog` and shown in the account screen
- Horizon UI style applied to the main dashboard and account/report cards
- shared/package/server/web TypeScript build blockers fixed
- Vite env typing and workspace build scripts aligned
- server dotenv load order fixed so Prisma reads `DATABASE_URL` during runtime
- `prisma/seed.ts` repaired to provide stable sample report data

## 4. Recommended next work order

1. Verify `feature/reports` UI rendering in browser and do a final report-branch UX pass.
2. Test saved report presets, filter reset behavior, and empty-state recovery actions.
3. Test both CSV downloads and confirm the exported filter summary matches the visible filters.
4. Run one SEARCH_AD live test and confirm a new log row appears in API account history.
5. Decide whether `feature/reports` is ready to merge into `dev`.
6. After report merge readiness is confirmed, move to COMMERCE real adapter work or MVP/OMS integration planning.

## 5. Report branch verification checklist

- run `npm run build` once and confirm success
- create `.env` from `ENV.example` if local env file is missing
- run `npm run prisma:generate`
- run `npm run prisma:seed`
- open the app and click `API 계정`
- save one API account and run `연결 테스트`
- confirm validation message appears
- open the app and click `리포트`
- confirm summary cards render with seeded values
- confirm the top summary chip row shows experiment/result/effective/worse/completed/running counts
- confirm experiment table data matches current snapshot
- change filters and confirm the `적용 중인 필터` block updates immediately
- save one report preset, reload it, and confirm it moves to the top after use
- trigger a no-result state and confirm recovery actions are visible
- click `실험 리포트 CSV`
- click `랭킹 결과 CSV`
- confirm the exported CSV includes filter summary rows at the top
- confirm downloaded file opens correctly in Excel

## 6. Commands for immediate verification

```bash
cd /d/codex/NaverNameSeoTracker
git checkout feature/reports
git pull origin feature/reports
npm install
npm run build
npm run prisma:generate
npm run prisma:seed
npm run dev
```

## 7. Likely next improvements after this branch

- add a real Naver COMMERCE external-call test adapter for saved API accounts
- merge validated `feature/reports` into `dev`
- move CSV generation to server endpoint if file volume grows
- add shareable server-side report snapshots if multiple operators need the same view
- keep a cleaner demo seed dataset for report verification
- merge report view with rank-tracking improvements if needed

## 8. Current phase summary

- `feature/reports` is in late-stage polish, not open-ended exploration.
- The branch already covers the expected report UX surface for MVP verification.
- The next meaningful milestone is branch validation and merge readiness, not more endless UI churn.
