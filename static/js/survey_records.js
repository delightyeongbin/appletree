const recordsBody = document.getElementById("recordsBody");
const refreshBtn = document.getElementById("refreshBtn");
const excelBtn = document.getElementById("excelBtn");
const chartCanvas = document.getElementById("recordsChart");
const itemSelect = document.getElementById("itemSelect");
const kpiTotal = document.getElementById("kpiTotal");
const kpiRecognized = document.getElementById("kpiRecognized");
const kpiAverage = document.getElementById("kpiAverage");

let recordsChart = null;
let allRecords = [];

function updateKpis(items) {
    const total = items.length;
    const recognizedCount = items.filter((item) => item.recognized).length;
    const numeric = items
        .map((item) => Number(item.itemValue))
        .filter((v) => Number.isFinite(v));

    const recognizedRate = total ? ((recognizedCount / total) * 100).toFixed(1) : "0.0";
    const average = numeric.length
        ? (numeric.reduce((sum, v) => sum + v, 0) / numeric.length).toFixed(2)
        : "-";

    kpiTotal.textContent = `${total}건`;
    kpiRecognized.textContent = `${recognizedRate}%`;
    kpiAverage.textContent = average === "-" ? "-" : average;
}

function formatDate(value) {
    if (!value) {
        return "-";
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        return value;
    }
    return d.toLocaleString("ko-KR");
}

function renderEmpty(message) {
    recordsBody.innerHTML = `<tr><td colspan="7" class="empty">${message}</td></tr>`;
}

function renderRows(items) {
    if (!items.length) {
        renderEmpty("저장된 측정 기록이 없습니다.");
        return;
    }

    recordsBody.innerHTML = "";
    items.forEach((item) => {
        const tr = document.createElement("tr");
        const statusText = item.recognized ? "인식됨" : "대기";
        const statusClass = item.recognized ? "status-ok" : "status-wait";

        tr.innerHTML = `
            <td>${item.dataId}</td>
            <td>${item.surveyName || "-"}</td>
            <td>${item.itemName || "-"}</td>
            <td>${item.itemValue ?? "-"}</td>
            <td>${item.itemUnit || "-"}</td>
            <td class="${statusClass}">${statusText}</td>
            <td>${formatDate(item.createdAt)}</td>
        `;
        recordsBody.appendChild(tr);
    });
}

function populateItemSelect(items) {
    const itemNames = [...new Set(items.map((item) => item.itemName).filter(Boolean))];
    const currentValue = itemSelect.value;

    itemSelect.innerHTML = "";

    if (!itemNames.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "항목 없음";
        itemSelect.appendChild(option);
        itemSelect.disabled = true;
        return;
    }

    const allOption = document.createElement("option");
    allOption.value = "__all__";
    allOption.textContent = "전체";
    itemSelect.appendChild(allOption);

    itemNames.forEach((itemName) => {
        const option = document.createElement("option");
        option.value = itemName;
        option.textContent = itemName;
        itemSelect.appendChild(option);
    });

    itemSelect.disabled = false;
    itemSelect.value = currentValue === "__all__" || itemNames.includes(currentValue) ? currentValue : "__all__";
}

function drawAllItemsChart(items) {
    const itemOrderMap = new Map();
    const surveyMap = new Map();

    items.forEach((item) => {
        if (item.itemValue === null || item.itemValue === undefined || Number.isNaN(Number(item.itemValue))) {
            return;
        }

        const itemName = item.itemName || "미분류";
        const surveyName = item.surveyName || "미분류 조사";
        const itemOrder = Number.isFinite(Number(item.itemOrder)) ? Number(item.itemOrder) : 9999;

        if (!itemOrderMap.has(itemName)) {
            itemOrderMap.set(itemName, itemOrder);
        }

        if (!surveyMap.has(surveyName)) {
            surveyMap.set(surveyName, {});
        }

        const itemBucket = surveyMap.get(surveyName);
        itemBucket[itemName] = (itemBucket[itemName] || 0) + Number(item.itemValue);
    });

    const labels = [...itemOrderMap.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([label]) => label);

    if (!labels.length) {
        return;
    }

    const palette = [
        { bg: "rgba(31, 95, 56, 0.88)", border: "rgba(24, 74, 43, 1)" },
        { bg: "rgba(47, 122, 70, 0.84)", border: "rgba(34, 94, 53, 1)" },
        { bg: "rgba(63, 157, 95, 0.8)", border: "rgba(46, 116, 70, 1)" },
        { bg: "rgba(102, 176, 122, 0.8)", border: "rgba(71, 128, 88, 1)" },
        { bg: "rgba(140, 198, 155, 0.82)", border: "rgba(95, 150, 115, 1)" },
        { bg: "rgba(179, 221, 191, 0.88)", border: "rgba(124, 168, 138, 1)" },
    ];

    const datasets = [...surveyMap.entries()].map(([surveyName, itemBucket], index) => {
        const color = palette[index % palette.length];
        return {
            label: surveyName,
            data: labels.map((label) => Number((itemBucket[label] || 0).toFixed(2))),
            backgroundColor: color.bg,
            borderColor: color.border,
            borderWidth: 1,
            borderRadius: 2,
            stack: "total",
        };
    });

    recordsChart = new Chart(chartCanvas, {
        type: "bar",
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: "right",
                    labels: {
                        boxWidth: 14,
                        color: "#243d2f",
                        font: {
                            size: 12,
                            weight: "700",
                        },
                    },
                },
                tooltip: {
                    mode: "index",
                    intersect: false,
                    callbacks: {
                        label(context) {
                            return `${context.dataset.label}: ${context.parsed.y}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: "#1f3a2d",
                        font: {
                            size: 12,
                            weight: "700",
                        },
                    },
                    grid: {
                        display: false,
                    },
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        color: "#4d6657",
                        font: {
                            size: 11,
                        },
                    },
                    grid: {
                        color: "rgba(60, 92, 70, 0.12)",
                    },
                    title: {
                        display: true,
                        text: "합계 · 값",
                        color: "#47624f",
                        font: {
                            size: 12,
                            weight: "700",
                        },
                    },
                },
            },
        },
    });
}

function drawSingleItemChart(items, selectedItemName) {
    if (!chartCanvas || typeof Chart === "undefined") {
        return;
    }

    const filtered = items.filter((item) => item.itemName === selectedItemName);
    const surveyTotals = new Map();

    filtered.forEach((item) => {
        const numeric = Number(item.itemValue);
        if (!Number.isFinite(numeric)) {
            return;
        }
        const surveyName = item.surveyName || "미분류 조사";
        surveyTotals.set(surveyName, (surveyTotals.get(surveyName) || 0) + numeric);
    });

    const sortedRows = [...surveyTotals.entries()]
        .map(([surveyName, value]) => ({ surveyName, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value);

    const labels = sortedRows.map((row) => row.surveyName);
    const values = sortedRows.map((row) => row.value);

    if (!labels.length) {
        return;
    }

    const barColors = values.map((_, index) => {
        const alpha = Math.max(0.9 - index * 0.08, 0.35);
        return `rgba(47, 122, 70, ${alpha})`;
    });

    recordsChart = new Chart(chartCanvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: selectedItemName,
                data: values,
                backgroundColor: barColors,
                borderColor: "rgba(24, 74, 43, 1)",
                borderWidth: 1,
                borderRadius: 6,
                barThickness: 36,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false,
                    labels: {
                        boxWidth: 14,
                        color: "#243d2f",
                        font: {
                            size: 12,
                            weight: "700",
                        },
                    },
                },
                tooltip: {
                    callbacks: {
                        label(context) {
                            return `${selectedItemName}: ${context.parsed.y}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    ticks: {
                        color: "#1f3a2d",
                        font: {
                            size: 12,
                            weight: "700",
                        },
                    },
                    grid: {
                        display: false,
                    },
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: "#4d6657",
                        font: {
                            size: 11,
                        },
                    },
                    grid: {
                        color: "rgba(60, 92, 70, 0.12)",
                    },
                    title: {
                        display: true,
                        text: "합계 · 값",
                        color: "#47624f",
                        font: {
                            size: 12,
                            weight: "700",
                        },
                    },
                },
            },
        },
    });
}

function drawChart(items, selectedItemName) {
    if (!chartCanvas || typeof Chart === "undefined") {
        return;
    }

    if (recordsChart) {
        recordsChart.destroy();
    }

    if (selectedItemName === "__all__") {
        drawAllItemsChart(items);
        return;
    }

    drawSingleItemChart(items, selectedItemName);
}

async function loadRecords() {
    renderEmpty("기록을 불러오는 중입니다...");
    refreshBtn.disabled = true;

    try {
        const response = await fetch("/api/measurements?limit=300");
        const data = await response.json();
        if (!response.ok || !data.ok) {
            throw new Error(data.error || "기록 조회 실패");
        }
        allRecords = data.items || [];
        updateKpis(allRecords);
        renderRows(allRecords);
        populateItemSelect(allRecords);
        drawChart(allRecords, itemSelect.value);
    } catch (error) {
        renderEmpty(`오류: ${error.message}`);
        updateKpis([]);
        populateItemSelect([]);
        drawChart([], "");
    } finally {
        refreshBtn.disabled = false;
    }
}

refreshBtn.addEventListener("click", loadRecords);
excelBtn.addEventListener("click", () => {
    window.location.href = "/api/measurements/export?limit=5000";
});
itemSelect.addEventListener("change", () => {
    drawChart(allRecords, itemSelect.value);
});
loadRecords();
