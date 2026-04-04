# GitHub · Vercel 배포 (Novel Agent)

Next.js 앱은 저장소의 **`onehandbook/`** 폴더 안에만 있습니다. `package.json`도 그 안에만 있으므로, Vercel에는 **반드시 Root Directory를 지정**해야 합니다. (루트에서 빌드하면 “No Next.js version detected” 오류가 납니다.)

**기존 GitHub 저장소(예: `onehandbook`) 그대로** 쓰면 됩니다.

## 1. Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com) 로그인 → **Add New… → Project**.
2. **Import Git Repository**에서 저장소 선택.
3. **Configure Project**에서:
   - **Root Directory** → **Edit** → `onehandbook` 입력 후 **Continue** (또는 폴더 선택).
   - Framework가 **Other**로 바뀌면 배포는 되어도 **404**가 날 수 있습니다. 저장소의 **`onehandbook/vercel.json`**에 `"framework": "nextjs"`가 있으므로 Git에 푸시한 뒤 재배포하면 Next로 고정됩니다.
   - 대시보드에서 **Framework Preset**을 **Next.js**로 바꿀 수 있으면 그렇게 해도 됩니다.
4. **Environment Variables**: 로컬 `onehandbook/.env.local`과 동일한 키를 입력합니다.  
   - 키 목록: **`docs/VERCEL-ENV.md`**, 템플릿: **`docs/vercel-env-template.env`**
5. **Deploy** 클릭.

### 이미 프로젝트를 만든 경우 (빌드 실패 시)

1. 프로젝트 → **Settings** → **General** → **Root Directory** → **Edit**
2. `onehandbook` 으로 저장
3. **Deployments**에서 최신 배포 **⋯** → **Redeploy**

## 2. 배포 후 확인

- 프로덕션 URL에서 로그인·OAuth 동작 확인.
- **Supabase** → Authentication: Site URL·Redirect URLs에 프로덕션 도메인과 `/auth/callback` 포함.

## 3. 로컬 Vercel CLI (선택)

```bash
npm i -g vercel
cd /path/to/OHB/onehandbook
vercel login
vercel link
vercel
```

`onehandbook` 안에서 링크하면 Root가 맞게 잡히기 쉽습니다.
