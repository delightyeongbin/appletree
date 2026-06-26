# AppleTreeVoiceSurvey

사과나무 측정 조사 프로그램의 Flask 초기 버전입니다.

## 기능 (현재)
- 시작 화면 UI (모바일 앱 스타일)
- 음성 입력 시작 버튼 (브라우저 Web Speech API 연동)
- Flask 기본 라우트
- MS-SQL 연결 준비 코드 (`app.py`)

## 실행 방법
1. 폴더 이동
   - `cd AppleTreeVoiceSurvey`
2. 가상환경 생성 및 활성화
   - `python -m venv .venv`
   - Windows PowerShell: `.\.venv\Scripts\Activate.ps1`
3. 패키지 설치
   - `pip install -r requirements.txt`
4. 앱 실행
   - `python app.py`
5. 브라우저 접속
   - `http://127.0.0.1:5000`

## MS-SQL 설정 (나중에 입력)
`.env.example` 항목을 참고해 환경변수로 설정하면 됩니다.
