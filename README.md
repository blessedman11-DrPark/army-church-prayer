# ⛪ 육군본부교회 중보기도 출석표 & Vercel 배포 가이드

구글 시트('중보기도신청자관리')와 실시간으로 연동되는 **주간 중보기도 신청 웹 사이트**입니다.

---

## 1. 🐙 GitHub 업로드 및 Vercel 무료 배포 가이드 (5분 완성)

이 웹 사이트는 백엔드 서버 구축 없이 **Vercel(무료 호스팅)**을 통해 누구나 접속할 수 있는 전용 URL(예: `https://your-app.vercel.app`)로 몇 분 만에 100% 무료 배포할 수 있습니다.

### 1단계: GitHub 가입 및 새 저장소(Repository) 생성
1. [GitHub](https://github.com/) 접속 후 로그인 (계정이 없으시면 회원가입).
2. 우측 상단의 **[+]** ➔ **[New repository]** 클릭.
3. **Repository name**: `army-church-prayer` (원하는 이름 입력)
4. **Public** 선택 ➔ **[Create repository]** 클릭.

### 2단계: 프로젝트 소스코드 GitHub에 업로드 (Push)
이 폴더(`중보기도신청사이트`)에서 터미널/PowerShell을 열고 아래 명령어를 입력합니다:

```bash
git init
git add .
git commit -m "Feat: 육군본부교회 중보기도 출석표 웹사이트 완성"
git branch -M main
git remote add origin https://github.com/사용자아이디/army-church-prayer.git
git push -u origin main
```
*(또는 GitHub 웹사이트 상의 `uploading an existing file`을 눌러 파일들을 drag & drop으로 올리셔도 됩니다!)*

### 3단계: Vercel 가입 및 GitHub 연동
1. [Vercel](https://vercel.com/) 접속 ➔ **[Sign Up]** ➔ **[Continue with GitHub]** 클릭하여 로그인.
2. Vercel 대시보드에서 **[Add New...]** ➔ **[Project]** 클릭.
3. Import Git Repository 목록에서 방금 올린 **`army-church-prayer`** 선택 후 **[Import]** 클릭.

### 4단계: 배포 실행 (Deploy)
1. 별도의 환경설정 수정 없이 하단의 **[Deploy]** 버튼을 클릭합니다.
2. 약 30초 후 축하 폭죽과 함께 배포가 완료되며, 무료 도메인 주소(예: `https://army-church-prayer.vercel.app`)가 즉시 발급됩니다!

---

## 2. 📊 구글 시트 백엔드(GAS) 설정 방법 (최초 1회)

### 1단계: Apps Script 열기
1. 준비해두신 **`중보기도신청자관리`** 구글 시트를 엽니다.
2. 상단 메뉴에서 **[확장 프로그램]** ➔ **[Apps Script]**를 클릭합니다.

### 2단계: 코드 복사 & 붙여넣기
1. `Code.gs` 창이 뜨면 기존 내용을 지우고, 이 프로젝트의 **`Code.gs`** 파일 내용을 그대로 전체 복사하여 붙여넣습니다.
2. 상단의 **[저장 (💾 아이콘)]**을 누릅니다.

### 3단계: 웹 앱(Web App) 배포
1. 우측 상단의 파란색 **[배포]** ➔ **[새 배포]** 버튼을 클릭합니다.
2. 톱니바퀴 아이콘(유형 선택)을 누르고 **[웹 앱 (Web App)]**을 선택합니다.
3. 설정값 지정:
   * **설명**: `중보기도 신청 백엔드 API`
   * **다음 사용자 권한으로 실행**: `나 (My Account)`
   * **액세스 권한 있는 사용자**: **`모든 사용자 (Anyone)`** *(★필수!)*
4. **[배포]** 버튼을 누르고 계정 액세스 승인을 진행합니다.
5. 배포 후 생성된 **`웹 앱 URL`** (https://script.google.com/macros/s/.../exec 형태)을 복사합니다.

### 4단계: Vercel 웹사이트에서 연동 URL 저장
1. Vercel로 배포된 웹사이트 주소로 접속합니다.
2. 화면 우측 하단의 **`⚙️ 연동 설정`**을 눌러 복사한 웹 앱 URL을 저장하시면 연동 완료!
