# Render 배포 가이드

## 준비 사항

1. **GitHub 저장소 생성**
   - 이 프로젝트를 GitHub에 push합니다
   - `.env` 파일은 커밋하지 마세요 (`.gitignore`에 추가)

2. **Render 계정**
   - https://render.com 에서 계정 생성

## 배포 단계

### 1. Render에서 Web Service 생성

1. Render 대시보드 → "New +"  → "Web Service"
2. GitHub 저장소 연결
3. 다음 설정 입력:

   | 항목 | 값 |
   |------|-----|
   | **Name** | `appletree-voice-survey` |
   | **Environment** | `Docker` |
   | **Region** | `Singapore` (또는 가까운 지역) |
   | **Branch** | `main` |

### 2. 환경 변수 설정

Render의 "Environment" 탭에서 다음 변수들을 추가합니다:

```
DB_SERVER=ms1901.gabiadb.com
DB_DATABASE=yujincast
DB_USERNAME=pinkyj81
DB_PASSWORD=zoskek38!!
DB_DRIVER=ODBC Driver 17 for SQL Server
FLASK_ENV=production
```

⚠️ **주의**: 비밀번호는 환경 변수로 설정하고, `.env` 파일에는 포함하지 마세요.

### 3. 배포

1. "Create Web Service" 클릭
2. Render가 자동으로 Docker 이미지를 빌드하고 배포합니다
3. 배포 완료 후 제공된 URL에서 앱 확인

## 주요 파일

- **Dockerfile** - Docker 이미지 정의
- **requirements.txt** - Python 의존성
- **.dockerignore** - Docker 빌드 제외 파일
- **app.py** - Flask 애플리케이션 (PORT 환경 변수 지원)

## 트러블슈팅

### ODBC 드라이버 오류
- Dockerfile에서 `msodbcsql18` (Microsoft ODBC Driver 18)을 자동으로 설치합니다

### 데이터베이스 연결 오류
- 환경 변수가 올바르게 설정되었는지 확인
- Render 로그 확인: 대시보드의 "Logs" 탭

### 빌드 실패
- GitHub 저장소에 모든 필수 파일이 있는지 확인
- `.gitignore`에 `.env`, `__pycache__`, `.venv` 등이 포함되어 있는지 확인

## 로컬에서 Docker 테스트

```bash
# Docker 이미지 빌드
docker build -t appletree-voice-survey .

# 컨테이너 실행
docker run -p 5000:5000 \
  -e DB_SERVER=ms1901.gabiadb.com \
  -e DB_DATABASE=yujincast \
  -e DB_USERNAME=pinkyj81 \
  -e DB_PASSWORD=zoskek38!! \
  appletree-voice-survey
```

## 자동 배포 활성화

Render는 GitHub에 push할 때마다 자동으로 재배포합니다.
- "Auto-Deploy" 활성화 확인 (기본값: 활성화)
