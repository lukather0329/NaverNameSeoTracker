# Company PC Handoff

Last updated: 2026-07-13
Current repo: `D:\Codex\NaverNameSeoTracker`
Primary remote: `https://github.com/lukather0329/NaverNameSeoTracker.git`

## 1. First steps on company PC

1. Open Git Bash.
2. Move to the project folder.
3. Sync the remote branches.
4. Check out the branch you want to continue.

```bash
cd /d/codex/NaverNameSeoTracker
git fetch --all --prune
git branch -r
git checkout feature/rank-tracking
git pull origin feature/rank-tracking
```

## 2. What was just completed

- `feature/api-accounts`
  - API account registration, update, activation toggle, connection test flow
- `feature/products`
  - Product registration, update, bulk paste registration flow
- `feature/seo-title-apply`
  - SEO title candidate registration, validation/live apply, rollback flow
- `feature/rank-tracking`
  - Rank tracking job registration UI
  - Job enable/disable toggle
  - Immediate run action
  - Server endpoints for `POST /jobs`, `PUT /jobs/:id`, `POST /jobs/:id/run`

## 3. Branches already pushed to GitHub

- `main`
- `dev`
- `feature/api-accounts`
- `feature/products`
- `feature/seo-title-apply`
- `feature/rank-tracking`
- `feature/reports`

## 4. Recommended next work order

1. Finish `feature/rank-tracking` verification on the company PC.
2. Start or continue `feature/reports`.
3. Merge feature branches into `dev` after local review.
4. Prepare MVP/OMS adapter connection points.

## 5. Rank tracking branch check list

- Confirm the server starts without route errors.
- Confirm the web screen opens the `추적 작업` menu.
- Register a test job.
- Run `즉시 추적` once.
- Confirm a result row appears in `랭킹 결과`.

## 6. Suggested commands for immediate verification

```bash
cd /d/codex/NaverNameSeoTracker
git checkout feature/rank-tracking
git pull origin feature/rank-tracking
npm install
npm run dev
```

## 7. After verification, continue with these tasks

- Replace mock tracking provider with real Naver shopping collection logic.
- Add scheduler execution history and failure logs.
- Add job filters by experiment, product, and status.
- Add report summary cards and export structure.
- Define MVP/OMS sync adapter interface.

## 8. Team note for future syncs

Every time work is pushed, update this file with:

- latest completed branch
- latest commit purpose
- exact next branch to continue
- first 3 actions to do on the other PC
