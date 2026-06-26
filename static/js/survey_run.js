const surveyNameView = document.getElementById("surveyNameView");
const surveyWeeksView = document.getElementById("surveyWeeksView");
const surveyItemsView = document.getElementById("surveyItemsView");
const rawInput = document.getElementById("rawInput");
const parseBtn = document.getElementById("parseBtn");
const saveBtn = document.getElementById("saveBtn");
const saveStatus = document.getElementById("saveStatus");
const resultBody = document.getElementById("resultBody");

let currentRows = [];

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadSurvey() {
    const raw = sessionStorage.getItem("activeSurvey");
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function drawSurveyInfo(survey) {
    surveyNameView.textContent = survey.name || "새 조사";
    surveyWeeksView.textContent = `${survey.weeks || 1}주`;

    surveyItemsView.innerHTML = "";
    survey.items.forEach((item) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = item;
        surveyItemsView.appendChild(chip);
    });
}

function buildRows(parseRows) {
    resultBody.innerHTML = "";

    parseRows.forEach((row) => {
        const tr = document.createElement("tr");

        const nameTd = document.createElement("td");
        nameTd.textContent = row.item;

        const valueTd = document.createElement("td");
        valueTd.textContent = row.value ?? "-";

        const unitTd = document.createElement("td");
        unitTd.textContent = row.unit || "-";

        const statusTd = document.createElement("td");
        statusTd.textContent = row.found ? "인식됨" : "대기";
        statusTd.className = row.found ? "status-ok" : "status-wait";

        tr.append(nameTd, valueTd, unitTd, statusTd);
        resultBody.appendChild(tr);
    });
}

function extractValueTokens(text) {
    const regex = /(-?\d+(?:\.\d+)?)\s*([a-zA-Z%가-힣]*)/g;
    const tokens = [];
    let match = regex.exec(text);

    while (match) {
        tokens.push({
            value: Number(match[1]),
            unit: match[2] || "",
            start: match.index,
            end: regex.lastIndex,
        });
        match = regex.exec(text);
    }

    return tokens;
}

function normalizeCorrections(text) {
    // Voice correction rule: when user says "A 아니고 B", keep B and ignore A.
    let normalized = text;
    const correctionRegex = /(-?\d+(?:\.\d+)?\s*[a-zA-Z%가-힣]*)\s*아니고\s*(-?\d+(?:\.\d+)?\s*[a-zA-Z%가-힣]*)/g;

    let previous;
    do {
        previous = normalized;
        normalized = normalized.replace(correctionRegex, "$2");
    } while (normalized !== previous);

    return normalized;
}

function parseInputByItems(text, items) {
    const normalizedText = normalizeCorrections(text);
    const tokens = extractValueTokens(normalizedText);
    const consumed = new Set();

    const rows = items.map((item) => {
        const pattern = new RegExp(`${escapeRegExp(item)}\\s*[:=]?\\s*(-?\\d+(?:\\.\\d+)?)\\s*([a-zA-Z%가-힣]*)`, "i");
        const match = normalizedText.match(pattern);

        if (!match) {
            return { item, found: false, value: null, unit: "", assignedTokenIndex: -1 };
        }

        const foundIndex = tokens.findIndex(
            (token, index) => token.value === Number(match[1]) && token.unit === (match[2] || "") && !consumed.has(index)
        );
        if (foundIndex >= 0) {
            consumed.add(foundIndex);
        }

        return {
            item,
            found: true,
            value: Number(match[1]),
            unit: match[2] || "",
            assignedTokenIndex: foundIndex,
        };
    });

    let tokenCursor = 0;
    rows.forEach((row) => {
        if (row.found) {
            return;
        }

        while (tokenCursor < tokens.length && consumed.has(tokenCursor)) {
            tokenCursor += 1;
        }

        if (tokenCursor >= tokens.length) {
            return;
        }

        row.found = true;
        row.value = tokens[tokenCursor].value;
        row.unit = tokens[tokenCursor].unit;
        row.assignedTokenIndex = tokenCursor;
        consumed.add(tokenCursor);
        tokenCursor += 1;
    });

    return rows.map(({ assignedTokenIndex, ...row }) => row);
}

const survey = loadSurvey();

if (!survey || !Array.isArray(survey.items) || survey.items.length === 0) {
    resultBody.innerHTML = '<tr><td class="empty-state" colspan="4">조사 설정 데이터가 없습니다. 조사 설정 화면에서 다시 시작해주세요.</td></tr>';
    parseBtn.disabled = true;
    saveBtn.disabled = true;
    rawInput.disabled = true;
} else {
    drawSurveyInfo(survey);
    currentRows = survey.items.map((item) => ({ item, found: false, value: null, unit: "" }));
    buildRows(currentRows);

    parseBtn.addEventListener("click", () => {
        currentRows = parseInputByItems(rawInput.value, survey.items);
        buildRows(currentRows);
        saveStatus.textContent = "";
    });

    saveBtn.addEventListener("click", async () => {
        if (!survey.surveyId) {
            saveStatus.textContent = "조사 ID가 없어 저장할 수 없습니다. 조사 설정에서 다시 시작하세요.";
            return;
        }

        if (!currentRows.length) {
            currentRows = parseInputByItems(rawInput.value, survey.items);
            buildRows(currentRows);
        }

        saveBtn.disabled = true;
        saveStatus.textContent = "DB 저장 중...";

        try {
            const response = await fetch(`/api/surveys/${survey.surveyId}/measurements`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rawInput: rawInput.value,
                    rows: currentRows,
                }),
            });
            const data = await response.json();

            if (!response.ok || !data.ok) {
                throw new Error(data.error || "저장 실패");
            }

            saveStatus.textContent = `DB 저장 완료: ${data.inserted}건`;
        } catch (error) {
            saveStatus.textContent = `DB 저장 실패: ${error.message}`;
        } finally {
            saveBtn.disabled = false;
        }
    });
}
