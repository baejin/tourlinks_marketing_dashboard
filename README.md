# Tourlinks Marketing Dashboard

React/Vite 기반 Tourlinks 마케팅 대시보드입니다.

## Scripts

```bash
npm install
npm run dev
npm run build
```

GitHub Pages는 `main` 브랜치의 `/docs` 폴더를 배포 소스로 사용합니다.

## Supabase Setup

Supabase SQL Editor에서 `supabase/schema.sql`을 실행한 뒤 Authentication에서 Email provider를 활성화하세요.

이 앱은 로그인한 사용자별로 `dashboard_documents` 테이블에 대시보드 JSON을 저장합니다.
