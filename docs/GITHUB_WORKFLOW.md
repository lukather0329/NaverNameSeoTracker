# GitHub Workflow

## 브랜치 전략

- `main`: 보호 브랜치
- `dev`: 통합 브랜치
- `feature/*`: 기능 단위 작업

## 권장 흐름

1. `dev`에서 최신 코드 pull
2. `feature/api-accounts` 같은 기능 브랜치 생성
3. 기능 구현 후 PR 생성
4. 리뷰 후 `dev` 병합
5. 릴리스 시 `main` 반영

## 커밋 예시

- `feat: add api account connection validation`
- `fix: prevent duplicate rank tracking jobs`
