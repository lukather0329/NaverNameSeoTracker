# Report Branch Merge Checklist

Last updated: 2026-07-17
Target branch: `feature/reports`
Merge target: `dev`

## 1. Goal

This checklist defines the minimum verification required before merging the report branch into `dev`.

The branch should be considered merge-ready only when:

- report UI renders correctly on desktop and narrow-width layouts
- report filters behave consistently
- saved presets work without data loss
- CSV exports match the visible filter state
- seeded snapshot data and API account validation flows still work

## 2. Environment Prep

Run these once before validation:

```bash
cd /d/codex/NaverNameSeoTracker
git checkout feature/reports
git pull origin feature/reports
npm install
npm run prisma:generate
npm run prisma:seed
npm run build
npm run dev
```

## 3. Report UI Checks

- Open the app and go to `리포트`.
- Confirm the hero, filter panel, summary cards, management summary, and table all render.
- Confirm the top summary chips show:
  - `실험`
  - `추적 결과`
  - `효과 있음`
  - `악화`
  - `완료`
  - `진행 중`
- Confirm the top chip row wraps cleanly on narrow width.
- Confirm the preset row stacks cleanly on narrow width.

## 4. Filter Checks

- Change `검색`, `상품`, `실험`, `상태`, `판단`, `기간`, and `정렬`.
- Confirm the table updates immediately.
- Confirm `적용 중인 필터` updates immediately.
- Confirm non-default sort appears in `적용 중인 필터`.
- Confirm the top `필터 초기화` button is disabled when nothing is active.
- Confirm the top `필터 초기화` button becomes enabled when any filter or sort changes.

## 5. Preset Checks

- Save a new preset.
- Load the saved preset.
- Confirm the loaded preset becomes the active preset.
- Confirm the loaded preset moves to the top of the saved preset list.
- Delete a preset and confirm it disappears immediately.
- Refresh the page and confirm presets persist in local storage.

## 6. Empty-State Checks

- Force a no-result state with filters.
- Confirm the empty-state guidance card appears.
- Confirm `전체 필터 초기화` restores the table.
- Force an invalid date range.
- Confirm the warning card appears.
- Confirm the empty-state recovery action clears the invalid range.

## 7. Export Checks

- Download `실험 리포트 CSV`.
- Download `랭킹 결과 CSV`.
- Confirm each file opens correctly in Excel.
- Confirm each file includes filter summary rows at the top.
- Confirm the filter summary rows match the visible filters on screen.

## 8. API Regression Checks

- Go to `API 계정`.
- Save or open one account.
- Run one validation test.
- If SEARCH_AD credentials are available, run one live test.
- Confirm a new log row appears in account history.

## 9. Merge Decision

Mark the branch ready only when all of the following are true:

- `npm run build` passes
- report verification items pass
- export verification items pass
- API regression checks pass
- no unresolved UI wording or layout issues remain

## 10. Recommended Next Step After Pass

If this checklist passes:

1. Merge `feature/reports` into `dev`.
2. Re-run build and smoke checks on `dev`.
3. Move to the next major workstream:
   - COMMERCE real adapter
   - MVP/OMS integration planning
   - shared reporting/export backend improvements

## 11. Latest Automated Validation

- Latest automated validation snapshot: [REPORT_MERGE_VALIDATION_2026-07-18.md](D:\Codex\NaverNameSeoTracker\REPORT_MERGE_VALIDATION_2026-07-18.md)
- Latest automated status: `npm.cmd run prisma:generate`, `npm.cmd run prisma:seed`, and `npm.cmd run build` all passed on Saturday, July 18, 2026. Manual browser validation is still pending.
- Manual validation log template: [REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md](D:\Codex\NaverNameSeoTracker\REPORT_MANUAL_VALIDATION_LOG_2026-07-18.md)
