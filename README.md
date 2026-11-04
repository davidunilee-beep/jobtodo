# jobtodo — 오늘의 기록

오늘 할일 프로그램.

날짜를 선택해 할 일과 하루 메모를 남기는 한국어 달력 앱입니다. HTML, CSS, JavaScript와 Vercel 설정 API를 사용하며 빌드나 패키지 설치가 필요 없습니다.

## 기능

- 실시간 현재 날짜·시간 표시 (사용 중인 기기의 현지 시간)
- 월별 달력, 이전·다음 달 이동, 오늘로 돌아가기
- 날짜별 할 일 추가·완료·삭제와 진행률
- 날짜별 하루 메모 자동 저장 및 기록한 날짜 표시
- 월별 기록 일수·완료한 할 일 집계
- JSON 백업 내보내기·불러오기
- 모바일·태블릿·데스크톱 반응형 화면, 키보드 조작 지원
- Supabase 이메일 회원가입·로그인, 로그인 세션 복원 및 로그아웃

## 실행

달력은 `index.html`을 브라우저에서 열면 사용할 수 있습니다. 로그인은 `/api/config`를 제공하는 서버가 필요합니다.

로컬 로그인 테스트: Node.js 22 이상에서 `.env.example`을 `.env.local`로 복사하고 실제 Supabase 공개 설정을 입력한 뒤 `npm run dev`를 실행해 `http://127.0.0.1:4173`에 접속하세요. 라이브러리 설치는 필요 없습니다. `.env.local`은 Git에 올라가지 않습니다. 로컬 서버는 웹 파일과 공개 설정 API만 제공하며 환경 변수 파일은 제공하지 않습니다.

검증: `npm test` (npm이 없으면 `node --test tests/config.test.cjs tests/auth.test.cjs`)

## GitHub에 올리기

GitHub에서 빈 저장소를 만든 뒤 프로젝트 폴더에서 실행합니다. `<저장소 주소>`는 본인의 GitHub 저장소 주소로 바꾸세요.

```sh
git add .
git commit -m "Create daily journal calendar app"
git branch -M main
git remote add origin <저장소 주소>
git push -u origin main
```

이미 origin이 등록돼 있다면 `git remote add` 단계는 생략하세요.

## Vercel 배포

1. Vercel에서 **Add New → Project**를 선택합니다.
2. 위 GitHub 저장소를 Import합니다.
3. Framework Preset을 **Other**로 선택합니다.
4. Root Directory는 기본값인 저장소 루트를 사용합니다.
5. Build Command와 Output Directory는 별도로 지정하지 않고 기본값으로 둡니다. 이 프로젝트는 빌드 과정이 없습니다.
6. 아래 Supabase 환경 변수를 등록한 후 Deploy합니다. 이미 배포했다면 변수를 등록한 후 **Redeploy**해야 합니다.

공식 안내: https://vercel.com/docs/deployments

## 저장 방식

기록은 현재 브라우저의 `localStorage`에 저장됩니다. 로그인은 계정 인증만 제공하며, 기록의 서버 저장·계정별 분리·기기 간 동기화는 포함하지 않습니다. 같은 브라우저에서는 로그인한 계정이 달라도 동일한 기록이 보입니다. 로그아웃해도 기존 기록은 유지됩니다. 브라우저·기기·도메인이 달라지면 기록이 공유되지 않습니다. 로컬에서 작성한 기록을 배포 주소로 옮기려면 백업 내보내기 후 새 주소에서 불러오세요. 브라우저 데이터 삭제 시 기록도 지워지므로 정기적으로 백업하세요.

백업을 불러오면 다른 날짜의 기록은 유지되며, 같은 날짜의 기록은 백업 내용으로 바뀝니다. 메모는 날짜당 50,000자, 할 일은 항목당 300자 및 날짜당 1,000개까지 지원합니다.

웹 폰트는 Google Fonts에서 불러오며, 연결되지 않으면 시스템 글꼴을 사용합니다. 로그인용 `supabase-js` v2는 jsDelivr CDN에서 불러옵니다. 로그인 서비스에 연결되지 않아도 달력과 기록 기능은 계속 사용할 수 있습니다.

## 파일 구성

- `index.html`: 화면 구조
- `styles.css`: 달력·반응형 디자인
- `app.js`: 날짜·기록·브라우저 저장·백업 처리
- `auth.js`: CDN 라이브러리 로드, 회원가입·로그인 팝업·세션·로그아웃
- `api/config.js`: Vercel 환경 변수에서 공개 Supabase 설정 제공
- `vercel.json`: Vercel 정적 배포 설정
- `.env.example`: 로컬 환경 변수 예시
- `scripts/dev.cjs`: API를 포함한 로컬 개발 서버
- `tests/`: 공개 설정과 인증 흐름 검증

## Supabase 설정

Vercel의 기존 Supabase 연동이 다른 프로젝트를 가리키는 경우 `JOBTODO_SUPABASE_URL`과 `JOBTODO_SUPABASE_PUBLISHABLE_KEY`를 함께 등록하면 이 앱에서 우선 사용합니다. 두 값 중 하나만 등록하면 다른 프로젝트의 키와 섞이지 않도록 설정 오류를 반환합니다. 기존 연동이 관리하는 변수는 그대로 유지합니다.

Vercel 프로젝트의 **Settings → Environment Variables**에서 배포 환경(Production 및 필요한 경우 Preview)에 등록하세요.

| 변수 | 값 |
| --- | --- |
| `SUPABASE_URL` | Supabase 프로젝트 URL (`https://…supabase.co`) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase 공개 publishable 키 (`sb_publishable_…`) |

기존 프로젝트의 `SUPABASE_ANON_KEY`도 지원합니다. Vercel 연동이 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 또는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 등록한 경우도 그대로 읽습니다. `VITE_` 접두사의 동일 변수도 지원합니다. 접두사 없는 변수를 우선 사용하고, publishable 키를 anon 키보다 우선합니다.

브라우저는 `/api/config`에서 URL과 공개 키 두 값만 받습니다. `service_role`, `sb_secret_…` 키는 브라우저에 전달하면 안 되며, 이 API는 공개 키 자리에 등록된 해당 키를 거부합니다. `SUPABASE_SERVICE_ROLE_KEY` 등의 서버 비밀 키는 읽거나 반환하지 않습니다.

Supabase 대시보드에서 다음 설정을 확인하세요.

1. **Authentication → Sign In / Providers**에서 이메일 로그인을 활성화합니다.
2. **Authentication → URL Configuration**의 Site URL에 실제 Vercel 운영 주소를 입력합니다.
3. Redirect URLs에 운영 주소의 루트 URL(`https://your-app.vercel.app/`)과 테스트에 쓸 URL(`http://127.0.0.1:4173/`)을 추가합니다. Preview 배포에서도 인증 메일을 테스트하려면 해당 주소도 허용합니다.
4. 이메일 확인이 활성화되어 있으면 회원가입 후 인증 메일 안내를 표시합니다. 이메일을 인증한 후 로그인하세요. 이메일 확인이 꺼져 있으면 회원가입 즉시 로그인됩니다.
5. 가입 비밀번호는 앱에서 최소 8자로 제한합니다. Supabase에 더 강한 비밀번호 정책이 설정돼 있다면 그 정책도 충족해야 합니다.

실제 가입·로그인은 올바른 Supabase 프로젝트 설정과 네트워크 연결이 있어야 확인할 수 있습니다.

공식 참고: [Supabase CDN 설치](https://supabase.com/docs/reference/javascript/installing), [이메일 회원가입](https://supabase.com/docs/reference/javascript/auth-signup), [공개 API 키](https://supabase.com/docs/guides/getting-started/api-keys), [Vercel 환경 변수](https://vercel.com/docs/environment-variables).
