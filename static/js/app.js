const voiceButton = document.getElementById("voiceButton");
const voiceRing = document.getElementById("voiceRing");
const voiceTitle = document.getElementById("voiceTitle");
const voiceHint = document.getElementById("voiceHint");

let recognition = null;
let listening = false;

function setListeningState(isListening) {
    listening = isListening;
    voiceRing.classList.toggle("listening", isListening);

    if (isListening) {
        voiceTitle.textContent = "음성을 듣고 있습니다...";
        voiceHint.textContent = "말씀하신 측정값을 분석 중입니다.";
    } else {
        voiceTitle.textContent = "음성으로 측정을 시작하세요";
        voiceHint.textContent = "예시) “잎 길이 7.5cm”, “과실 가로 8.2cm”";
    }
}

function initVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        voiceButton.addEventListener("click", () => {
            alert("현재 브라우저는 음성 입력(Web Speech API)을 지원하지 않습니다.");
        });
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListeningState(true);
    recognition.onend = () => setListeningState(false);

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        voiceTitle.textContent = "입력 인식 완료";
        voiceHint.textContent = `"${transcript}"`;
    };

    recognition.onerror = () => {
        setListeningState(false);
        voiceTitle.textContent = "음성 인식 오류";
        voiceHint.textContent = "다시 눌러서 측정을 시작해주세요.";
    };

    voiceButton.addEventListener("click", () => {
        if (listening) {
            recognition.stop();
            return;
        }
        recognition.start();
    });
}

initVoiceInput();
