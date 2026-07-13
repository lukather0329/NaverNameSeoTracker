# Company PC Handoff

Last updated: 2026-07-14
Current repo: `D:\Codex\NaverNameSeoTracker`
Primary remote: `https://github.com/lukather0329/NaverNameSeoTracker.git`
Current focus branch: `feature/rank-tracking`

## 1. Sync status as of 2026-07-14

- `main`
  - synced with `origin/main`
- `dev`
  - synced with `origin/dev`
- `feature/api-accounts`
  - synced with `origin/feature/api-accounts`
  - latest commit: `af888e7 docs: add company handoff checklist`
- `feature/products`
  - synced with `origin/feature/products`
  - latest commit: `85075ee feat: add product management workflow`
- `feature/seo-title-apply`
  - synced with `origin/feature/seo-title-apply`
  - latest commit: `24bb8fc feat: add SEO title apply workflow`
- `feature/rank-tracking`
  - synced with `origin/feature/rank-tracking`
  - latest commit: `aee6b69 feat: add rank tracking management workflow`
- `feature/reports`
  - synced with `origin/feature/reports`
  - not started beyond base scaffold

## 2. First steps on company PC

1. Open Git Bash.
2. Move to the project folder.
3. Fetch all remote branches.
4. Check out the branch to continue.
5. Pull the latest branch state.

```bash
cd /d/codex/NaverNameSeoTracker
git fetch --all --prune
git checkout feature/rank-tracking
git pull origin feature/rank-tracking
```

## 3. What is completed already

- `feature/api-accounts`
  - API account registration, update, active toggle, connection test flow
- `feature/products`
  - product registration, update, bulk paste registration flow
- `feature/seo-title-apply`
  - SEO title candidate registration, validation apply, live apply, rollback flow
- `feature/rank-tracking`
  - rank tracking job registration form
  - job enable and disable toggle
  - immediate run action
  - server endpoints for `POST /jobs`, `PUT /jobs/:id`, `POST /jobs/:id/run`

## 4. Recommended next work order

1. Verify `feature/rank-tracking` on the company PC.
2. Continue `feature/reports`.
3. Merge validated feature branches into `dev`.
4. Prepare MVP and OMS adapter connection points.

## 5. Rank tracking verification checklist

- start server without route errors
- open web app and enter `추적 작업`
- register one test job
- click `즉시 추적`
- confirm one row appears in `랭킹 결과`
- confirm enable and disable toggle works

## 6. Suggested commands for immediate verification

```bash
cd /d/codex/NaverNameSeoTracker
git checkout feature/rank-tracking
git pull origin feature/rank-tracking
npm install
npm run dev
```

## 7. After verification, continue with these tasks

- replace mock tracking provider with real Naver shopping collection logic
- add scheduler execution history and failure logs
- add filters by experiment, product, provider, and status
- start `feature/reports` report summary and export flow
- define MVP and OMS sync adapter interface

## 8. Routine sync rule

Whenever work is pushed, update this file with:

- sync date
- current focus branch
- latest completed branch and commit
- next branch to continue
- first 3 actions to do on the other PC
