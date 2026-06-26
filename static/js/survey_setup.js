const itemList = document.getElementById("itemList");
const addItemBtn = document.getElementById("addItem");
const deleteItemBtn = document.getElementById("deleteItem");
const moveUpBtn = document.getElementById("moveUp");
const moveDownBtn = document.getElementById("moveDown");
const startSurveyBtn = document.getElementById("startSurvey");
const addItemModal = document.getElementById("addItemModal");
const addItemInput = document.getElementById("addItemInput");
const addItemConfirmBtn = document.getElementById("addItemConfirm");
const addItemCancelBtn = document.getElementById("addItemCancel");

let selectedItem = itemList.querySelector(".item.selected");

function getNextItemName() {
    return `새 항목 ${itemList.children.length + 1}`;
}

function openAddItemModal() {
    addItemInput.value = getNextItemName();
    addItemModal.classList.add("open");
    addItemModal.setAttribute("aria-hidden", "false");
    addItemInput.focus();
    addItemInput.select();
}

function closeAddItemModal() {
    addItemModal.classList.remove("open");
    addItemModal.setAttribute("aria-hidden", "true");
}

function createItemFromModal() {
    const name = addItemInput.value.trim() || getNextItemName();

    const li = document.createElement("li");
    li.className = "item";
    li.tabIndex = 0;
    li.textContent = name;
    itemList.appendChild(li);
    setSelected(li);
    closeAddItemModal();
}

function setSelected(item) {
    if (!item) {
        return;
    }
    if (selectedItem) {
        selectedItem.classList.remove("selected");
    }
    selectedItem = item;
    selectedItem.classList.add("selected");
    selectedItem.focus();
}

itemList.addEventListener("click", (event) => {
    const target = event.target.closest(".item");
    if (!target) {
        return;
    }
    setSelected(target);
});

addItemBtn.addEventListener("click", () => {
    openAddItemModal();
});

addItemConfirmBtn.addEventListener("click", createItemFromModal);

addItemCancelBtn.addEventListener("click", closeAddItemModal);

addItemInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        createItemFromModal();
    }
});

addItemModal.addEventListener("click", (event) => {
    if (event.target === addItemModal) {
        closeAddItemModal();
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && addItemModal.classList.contains("open")) {
        closeAddItemModal();
    }
});

deleteItemBtn.addEventListener("click", () => {
    if (!selectedItem) {
        alert("삭제할 조사항목을 먼저 선택하세요.");
        return;
    }

    const next = selectedItem.nextElementSibling || selectedItem.previousElementSibling;
    selectedItem.remove();
    selectedItem = null;

    if (next) {
        setSelected(next);
    }
});

moveUpBtn.addEventListener("click", () => {
    if (!selectedItem || !selectedItem.previousElementSibling) {
        if (!selectedItem) {
            alert("순서를 변경할 조사항목을 먼저 선택하세요.");
        }
        return;
    }

    const prev = selectedItem.previousElementSibling;
    itemList.insertBefore(selectedItem, prev);
    setSelected(selectedItem);
});

moveDownBtn.addEventListener("click", () => {
    if (!selectedItem || !selectedItem.nextElementSibling) {
        if (!selectedItem) {
            alert("순서를 변경할 조사항목을 먼저 선택하세요.");
        }
        return;
    }

    const next = selectedItem.nextElementSibling;
    itemList.insertBefore(next, selectedItem);
    setSelected(selectedItem);
});

startSurveyBtn.addEventListener("click", async () => {
    const surveyName = document.getElementById("surveyName").value.trim() || "새 조사";
    const surveyWeeks = Number(document.getElementById("surveyWeeks").value) || 1;
    const surveyItems = [...itemList.querySelectorAll(".item")]
        .map((item) => item.textContent.trim())
        .filter(Boolean);

    if (!surveyItems.length) {
        alert("최소 1개 이상의 조사항목이 필요합니다.");
        return;
    }

    startSurveyBtn.disabled = true;
    startSurveyBtn.textContent = "조사 생성 중...";

    let createdSurveyId = null;

    try {
        const initRes = await fetch("/api/db/init", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });
        const initJson = await initRes.json();
        if (!initRes.ok || !initJson.ok) {
            throw new Error(initJson.error || "DB 초기화 실패");
        }

        const createRes = await fetch("/api/surveys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: surveyName,
                weeks: surveyWeeks,
                items: surveyItems,
            }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok || !createJson.ok) {
            throw new Error(createJson.error || "조사 생성 실패");
        }

        createdSurveyId = createJson.surveyId;
    } catch (error) {
        alert(`조사 생성 실패: ${error.message}`);
        startSurveyBtn.disabled = false;
        startSurveyBtn.innerHTML = '<i class="fa-solid fa-play"></i> 조사 시작';
        return;
    }

    const surveyPayload = {
        surveyId: createdSurveyId,
        name: surveyName,
        weeks: surveyWeeks,
        items: surveyItems,
        createdAt: new Date().toISOString(),
    };

    sessionStorage.setItem("activeSurvey", JSON.stringify(surveyPayload));
    window.location.href = "/survey/run";
});
