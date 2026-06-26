from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import StringIO
from pathlib import Path
from typing import Any

import pyodbc
from flask import Flask, Response, jsonify, render_template, request


app = Flask(__name__)


def load_dotenv_file() -> None:
    """Load key=value pairs from local .env into process env when missing."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv_file()


def get_mssql_connection() -> pyodbc.Connection:
    """Return an MS-SQL connection using configured environment values."""
    server = (
        os.getenv("MSSQL_SERVER")
        or os.getenv("DB_SERVER")
        or "ms1901.gabiadb.com"
    )
    database = (
        os.getenv("MSSQL_DATABASE")
        or os.getenv("DB_DATABASE")
        or os.getenv("DB_NAME")
        or "yujincast"
    )
    username = (
        os.getenv("MSSQL_USERNAME")
        or os.getenv("DB_USERNAME")
        or os.getenv("DB_USER")
    )
    password = (
        os.getenv("MSSQL_PASSWORD")
        or os.getenv("DB_PASSWORD")
    )
    driver = (
        os.getenv("MSSQL_DRIVER")
        or os.getenv("DB_DRIVER")
        or "SQL Server"
    )

    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={database}",
    ]

    if username and password:
        parts.extend([f"UID={username}", f"PWD={password}"])
    else:
        local_servers = {"localhost", "127.0.0.1", ".", "(local)"}
        is_local = server.lower() in local_servers or server.lower().startswith("127.")
        if not is_local:
            raise RuntimeError("원격 SQL Server는 DB_USERNAME/DB_PASSWORD(또는 MSSQL_USERNAME/MSSQL_PASSWORD)가 필요합니다.")
        parts.append("Trusted_Connection=yes")

    conn_str = ";".join(parts) + ";"
    print(f"DEBUG: Connection string: {conn_str[:100]}...")  # 첫 100자만 출력 (비밀번호 마스크)
    print(f"DEBUG: Driver: {driver}")
    print(f"DEBUG: Server: {server}")
    print(f"DEBUG: Database: {database}")
    print(f"DEBUG: Username: {username}")
    return pyodbc.connect(conn_str)


def initialize_database() -> None:
    create_master_table_sql = """
    IF OBJECT_ID(N'dbo.orchard_survey_master', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.orchard_survey_master (
            survey_id INT IDENTITY(1,1) PRIMARY KEY,
            survey_name NVARCHAR(200) NOT NULL,
            survey_weeks INT NOT NULL,
            item_schema NVARCHAR(MAX) NULL,
            created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
        );
    END
    """

    create_data_table_sql = """
    IF OBJECT_ID(N'dbo.orchard_survey_data', N'U') IS NULL
    BEGIN
        CREATE TABLE dbo.orchard_survey_data (
            data_id BIGINT IDENTITY(1,1) PRIMARY KEY,
            survey_id INT NOT NULL,
            item_order INT NOT NULL,
            item_name NVARCHAR(120) NOT NULL,
            item_value DECIMAL(18,4) NULL,
            item_unit NVARCHAR(40) NULL,
            raw_input NVARCHAR(2000) NULL,
            recognized BIT NOT NULL DEFAULT 1,
            created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
            CONSTRAINT FK_orchard_survey_data_master
                FOREIGN KEY (survey_id) REFERENCES dbo.orchard_survey_master(survey_id)
        );
        CREATE INDEX IX_orchard_survey_data_survey_id
            ON dbo.orchard_survey_data (survey_id, item_order);
    END
    """

    conn = get_mssql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(create_master_table_sql)
        cursor.execute(create_data_table_sql)
        conn.commit()
    finally:
        conn.close()


def to_decimal_or_none(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def fetch_measurements(limit: int) -> list[dict[str, Any]]:
    initialize_database()
    conn = get_mssql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT TOP ({limit})
                d.data_id,
                d.survey_id,
                m.survey_name,
                d.item_order,
                d.item_name,
                d.item_value,
                d.item_unit,
                d.raw_input,
                d.recognized,
                CONVERT(VARCHAR(33), d.created_at, 127) AS created_at
            FROM dbo.orchard_survey_data d
            INNER JOIN dbo.orchard_survey_master m
                ON d.survey_id = m.survey_id
            ORDER BY d.data_id DESC
            """
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    result = []
    for row in rows:
        result.append(
            {
                "dataId": int(row[0]),
                "surveyId": int(row[1]),
                "surveyName": row[2],
                "itemOrder": int(row[3]),
                "itemName": row[4],
                "itemValue": float(row[5]) if row[5] is not None else None,
                "itemUnit": row[6] or "",
                "rawInput": row[7] or "",
                "recognized": bool(row[8]),
                "createdAt": str(row[9]),
            }
        )
    return result


def fetch_surveys(limit: int) -> list[dict[str, Any]]:
    initialize_database()
    conn = get_mssql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            f"""
            SELECT TOP ({limit})
                survey_id,
                survey_name,
                survey_weeks,
                item_schema,
                CONVERT(VARCHAR(33), created_at, 127) AS created_at
            FROM dbo.orchard_survey_master
            ORDER BY survey_id DESC
            """
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    result = []
    for row in rows:
        items = []
        if row[3]:
            try:
                items = json.loads(row[3])
            except (TypeError, json.JSONDecodeError):
                items = []
        result.append(
            {
                "surveyId": int(row[0]),
                "name": row[1],
                "weeks": int(row[2]),
                "items": items,
                "createdAt": str(row[4]),
            }
        )
    return result


def fetch_survey_detail(survey_id: int) -> dict[str, Any] | None:
    initialize_database()
    conn = get_mssql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT
                survey_id,
                survey_name,
                survey_weeks,
                item_schema,
                CONVERT(VARCHAR(33), created_at, 127) AS created_at
            FROM dbo.orchard_survey_master
            WHERE survey_id = ?
            """,
            survey_id,
        )
        row = cursor.fetchone()
    finally:
        conn.close()

    if not row:
        return None

    items = []
    if row[3]:
        try:
            items = json.loads(row[3])
        except (TypeError, json.JSONDecodeError):
            items = []

    return {
        "surveyId": int(row[0]),
        "name": row[1],
        "weeks": int(row[2]),
        "items": items,
        "createdAt": str(row[4]),
    }


@app.route("/")
def home() -> str:
    return render_template("index.html")


@app.route("/survey/setup")
def survey_setup() -> str:
    return render_template("survey_setup.html")


@app.route("/survey/enter")
def survey_enter() -> str:
    return render_template("survey_enter.html")


@app.route("/survey/run")
def survey_run() -> str:
    return render_template("survey_run.html")


@app.route("/survey/records")
def survey_records() -> str:
    return render_template("survey_records.html")


@app.route("/api/health")
def health():
    return jsonify({"ok": True, "service": "apple-tree-voice-survey"})


@app.route("/api/db/init", methods=["POST"])
def init_db():
    try:
        initialize_database()
        return jsonify({"ok": True, "message": "MS-SQL 테이블 준비 완료"})
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500


@app.route("/api/surveys", methods=["GET"])
def list_surveys():
    limit = request.args.get("limit", default=100, type=int)
    if limit is None:
        limit = 100
    limit = max(1, min(limit, 1000))

    try:
        items = fetch_surveys(limit)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

    return jsonify({"ok": True, "items": items, "count": len(items)})


@app.route("/api/surveys", methods=["POST"])
def create_survey():
    payload = request.get_json(silent=True) or {}
    survey_name = str(payload.get("name", "")).strip()
    survey_weeks = payload.get("weeks", 1)
    items = payload.get("items", [])

    if not survey_name:
        return jsonify({"ok": False, "error": "조사명은 필수입니다."}), 400
    if not isinstance(items, list) or not items:
        return jsonify({"ok": False, "error": "조사항목은 최소 1개 이상 필요합니다."}), 400

    try:
        survey_weeks = int(survey_weeks)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "조사주수 형식이 올바르지 않습니다."}), 400

    try:
        initialize_database()
        conn = get_mssql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO dbo.orchard_survey_master (survey_name, survey_weeks, item_schema)
                OUTPUT INSERTED.survey_id
                VALUES (?, ?, ?)
                """,
                survey_name,
                survey_weeks,
                json.dumps(items, ensure_ascii=False),
            )
            survey_id = int(cursor.fetchone()[0])
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

    return jsonify({"ok": True, "surveyId": survey_id})


@app.route("/api/surveys/<int:survey_id>/measurements", methods=["POST"])
def save_measurements(survey_id: int):
    payload = request.get_json(silent=True) or {}
    rows = payload.get("rows", [])
    raw_input = str(payload.get("rawInput", ""))

    if not isinstance(rows, list) or not rows:
        return jsonify({"ok": False, "error": "저장할 데이터가 없습니다."}), 400

    insert_params = []
    for index, row in enumerate(rows, start=1):
        item_name = str(row.get("item", "")).strip()
        if not item_name:
            continue
        item_value = to_decimal_or_none(row.get("value"))
        item_unit = str(row.get("unit", "")).strip() or None
        recognized = 1 if bool(row.get("found", False)) else 0
        insert_params.append(
            (
                survey_id,
                index,
                item_name,
                item_value,
                item_unit,
                raw_input,
                recognized,
            )
        )

    if not insert_params:
        return jsonify({"ok": False, "error": "유효한 데이터가 없습니다."}), 400

    try:
        initialize_database()
        conn = get_mssql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT COUNT(1) FROM dbo.orchard_survey_master WHERE survey_id = ?",
                survey_id,
            )
            exists = int(cursor.fetchone()[0]) > 0
            if not exists:
                return jsonify({"ok": False, "error": "조사 ID를 찾을 수 없습니다."}), 404

            cursor.executemany(
                """
                INSERT INTO dbo.orchard_survey_data (
                    survey_id,
                    item_order,
                    item_name,
                    item_value,
                    item_unit,
                    raw_input,
                    recognized
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                insert_params,
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

    return jsonify({"ok": True, "inserted": len(insert_params)})


@app.route("/api/surveys/<int:survey_id>", methods=["GET"])
def get_survey_detail(survey_id: int):
    try:
        survey = fetch_survey_detail(survey_id)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

    if not survey:
        return jsonify({"ok": False, "error": "조사를 찾을 수 없습니다."}), 404

    return jsonify({"ok": True, "item": survey})


@app.route("/api/measurements", methods=["GET"])
def get_measurements():
    limit = request.args.get("limit", default=200, type=int)
    if limit is None:
        limit = 200
    limit = max(1, min(limit, 1000))

    try:
        result = fetch_measurements(limit)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

    return jsonify({"ok": True, "items": result, "count": len(result)})


@app.route("/api/measurements/export", methods=["GET"])
def export_measurements_csv():
    limit = request.args.get("limit", default=1000, type=int)
    if limit is None:
        limit = 1000
    limit = max(1, min(limit, 5000))

    try:
        items = fetch_measurements(limit)
    except Exception as exc:
        return jsonify({"ok": False, "error": str(exc)}), 500

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "조사ID", "조사명", "항목순서", "항목", "값", "단위", "상태", "입력시간", "원문입력"])

    for item in items:
        writer.writerow(
            [
                item["dataId"],
                item["surveyId"],
                item["surveyName"],
                item["itemOrder"],
                item["itemName"],
                item["itemValue"] if item["itemValue"] is not None else "",
                item["itemUnit"],
                "인식됨" if item["recognized"] else "대기",
                item["createdAt"],
                item["rawInput"],
            ]
        )

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"measurement_records_{stamp}.csv"
    csv_text = output.getvalue()
    output.close()

    return Response(
        "\ufeff" + csv_text,
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
