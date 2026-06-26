FROM python:3.11-slim

# ODBC 드라이버 및 필요한 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    unixodbc \
    unixodbc-dev \
    && curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# requirements.txt 복사 및 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 앱 파일 복사
COPY . .

# .env 파일은 Render의 환경 변수를 사용하므로 제외
# Render 환경 변수: DB_SERVER, DB_DATABASE, DB_USERNAME, DB_PASSWORD

# 포트 설정
EXPOSE 5000

# 프로덕션 서버 실행
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "120", "app:app"]
