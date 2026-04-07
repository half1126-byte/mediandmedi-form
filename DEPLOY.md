# 배포 가이드

## Vercel 배포 (권장)

### 방법 1: Vercel CLI
```bash
npx vercel login
npx vercel --prod
```

### 방법 2: GitHub 연동
1. GitHub에서 새 저장소 생성 (예: `mediandmedi-form`)
2. 코드 푸시:
```bash
git remote add origin https://github.com/YOUR_USERNAME/mediandmedi-form.git
git push -u origin master
```
3. [vercel.com](https://vercel.com) 접속 → "Import Project" → GitHub 저장소 선택
4. 환경 변수 설정 (Settings → Environment Variables):
   - `NOTION_API_KEY`
   - `NOTION_MAIN_DB_ID`
   - `NOTION_TASK_DB_ID`
   - `NOTION_CHANGE_DB_ID`

## Notion 연동 (나중에)
1. `.env.local`에 실제 Notion API 키 입력
2. `src/app/api/submit/route.ts` 에서 데모 모드 → Notion 모드 전환
3. `src/app/api/change/route.ts` 에서 데모 모드 → Notion 모드 전환
