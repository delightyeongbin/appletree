const surveyList = document.getElementById("surveyList");
const refreshBtn = document.getElementById("refreshBtn");

function formatDate(value) {
    if (!value) {
        return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString("ko-KR");
}

function renderEmpty(message) {
    surveyList.innerHTML = `<div class="empty">${message}</div>`;
}

function renderSurveys(items) {
    if (!items.length) {
        renderEmpty("생성된 조사명이 없습니다. 먼저 조사명 생성하기에서 조사를 만들어주세요.");
        return;
    }

    surveyList.innerHTML = "";
    items.forEach((survey) => {
        const item = document.createElement("article");
        item.className = "survey-item";

        const itemNames = Array.isArray(survey.items) ? survey.items.filter(Boolean) : [];
        const preview = itemNames.length ? itemNames.join(", ") : "조사항목 없음";

        item.innerHTML = `
            <div>
                <h2>${survey.name}</h2>
                <div class="survey-meta">
                    <span class="meta-chip">조사 ID ${survey.surveyId}</span>
                    <span class="meta-chip">${survey.weeks}주</span>
                    <span class="meta-chip">항목 ${itemNames.length}개</span>
                    <span class="meta-chip">${formatDate(survey.createdAt)}</span>
                </div>
                <div class="items-preview">조사항목: ${preview}</div>
            </div>
            <button class="enter-btn" type="button" data-survey-id="${survey.surveyId}">입장</button>
        `;
        surveyList.appendChild(item);
    });
}

async function enterSurvey(surveyId) {
    try {
        const response = await fetch(`/api/surveys/${surveyId}`);
        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error || "조사 조회 실패");
        }

        sessionStorage.setItem(
            "activeSurvey",
            JSON.stringify({
                surveyId: data.item.surveyId,
                name: data.item.name,
                weeks: data.item.weeks,
                items: Array.isArray(data.item.items) ? data.item.items : [],
                createdAt: data.item.createdAt,
            })
        );
        window.location.href = "/survey/run";
    } catch (error) {
        alert(`조사 입장 실패: ${error.message}`);
    }
}

async function loadSurveys() {
    renderEmpty("조사 목록을 불러오는 중입니다...");
    refreshBtn.disabled = true;

    try {
        const response = await fetch("/api/surveys?limit=200");
        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error || "조사 목록 조회 실패");
        }
        renderSurveys(data.items || []);
    } catch (error) {
        renderEmpty(`오류: ${error.message}`);
    } finally {
        refreshBtn.disabled = false;
    }
}

surveyList.addEventListener("click", (event) => {
    const button = event.target.closest(".enter-btn");
    if (!button) {
        return;
    }
    enterSurvey(button.dataset.surveyId);
});

refreshBtn.addEventListener("click", loadSurveys);
loadSurveys();
