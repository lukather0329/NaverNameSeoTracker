# Company PC Handoff

Last updated: 2026-07-16
Current repo: `D:\Codex\NaverNameSeoTracker`
Primary remote: `https://github.com/lukather0329/NaverNameSeoTracker.git`
Current focus branch: `feature/reports`

## 1. Sync status as of 2026-07-16

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
  - added report screen, summary cards, experiment report table, CSV export flow
  - workspace build verified on 2026-07-16 with `npm run build`

## 2. First steps on company PC

```bash
cd /d/codex/NaverNameSeoTracker
git fetch --all --prune
git checkout feature/reports
git pull origin feature/reports
```

## 3. What was added on this branch

- `리포트` navigation menu
- report summary cards for experiment count, effective count, active jobs, tracked keywords, average delta
- experiment-level report table
- CSV export for experiment report
- CSV export for ranking results
- shared/package/server/web TypeScript build blockers fixed
- Vite env typing and workspace build scripts aligned

## 4. Recommended next work order

1. Verify `feature/reports` UI rendering in browser.
2. Test both CSV downloads with real snapshot data.
3. Backfill report APIs or server-side export if needed.
4. Merge validated feature branches into `dev`.

## 5. Report branch verification checklist

- run `npm run build` once and confirm success
- open the app and click `리포트`
- confirm summary cards render
- confirm experiment table data matches current snapshot
- click `실험 리포트 CSV`
- click `랭킹 결과 CSV`
- confirm downloaded file opens correctly in Excel

## 6. Commands for immediate verification

```bash
cd /d/codex/NaverNameSeoTracker
git checkout feature/reports
git pull origin feature/reports
npm install
npm run build
npm run dev
```

## 7. Likely next improvements after this branch

- add report date range filter
- add experiment/product filters
- move CSV generation to server endpoint if file volume grows
- add management summary section for weekly reporting
- merge report view with rank-tracking improvements if needed
