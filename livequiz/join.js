import { db, auth, ensureAnonAuth, Fire, GameStatus } from "./firebase.js";
const { doc, getDoc, setDoc, onSnapshot } = Fire;

// Load confetti via CDN
const script = document.createElement('script');
script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
document.head.appendChild(script);

// State
let currentGameId = null;
let currentQIndex = -1;
let hasAnswered = false;
let gameUnsubscribe = null;
let profile = { name: "", score: 0 };

// DOM
const screens = {
    join: document.getElementById("screen-join"),
    lobby: document.getElementById("screen-lobby"),
    question: document.getElementById("screen-question"),
    feedback: document.getElementById("screen-feedback"),
    end: document.getElementById("screen-end")
};

const joinBtn = document.getElementById("joinBtn");
const joinPin = document.getElementById("joinPin");
const joinName = document.getElementById("joinName");
const joinStatus = document.getElementById("joinStatus");
const welcomeName = document.getElementById("welcomeName");
const studentTimer = document.getElementById("studentTimer");
const feedbackMsg = document.getElementById("feedback-msg");
const feedbackIcon = document.getElementById("feedback-icon");
const pointsWon = document.getElementById("points-won");
const currentScoreEl = document.getElementById("currentScore");
const finalRank = document.getElementById("finalRank");
const finalScore = document.getElementById("finalScore");

function showScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove("active"));
    screens[screenId].classList.add("active");
}

// 1. Join Logic
joinBtn.addEventListener("click", async () => {
    const pin = joinPin.value.trim();
    const name = joinName.value.trim();

    if (!/^\d{6}$/.test(pin)) return (joinStatus.textContent = "Enter 6-digit PIN");
    if (name.length < 2) return (joinStatus.textContent = "Name too short");

    joinStatus.textContent = "Joining...";
    const user = await ensureAnonAuth();

    const pinSnap = await getDoc(doc(db, "pins", pin));
    if (!pinSnap.exists()) return (joinStatus.textContent = "PIN not found!");

    currentGameId = pinSnap.data().gameId;
    profile.name = name;

    // Register student with score 0
    await setDoc(doc(db, "games", currentGameId, "players", user.uid), {
        name, score: 0, lastEarned: 0
    }, { merge: true });

    welcomeName.textContent = `Welcome, ${name}!`;
    showScreen("lobby");
    startListening();
});

// 2. Real-time Listening (Single Listener Pattern)
function startListening() {
    if (gameUnsubscribe) gameUnsubscribe();

    gameUnsubscribe = onSnapshot(doc(db, "games", currentGameId), async (snap) => {
        const game = snap.data();
        if (!game) return;

        switch (game.status) {
            case GameStatus.LOBBY:
                showScreen("lobby");
                break;

            case GameStatus.QUESTION:
                if (currentQIndex !== game.qIndex) {
                    currentQIndex = game.qIndex;
                    hasAnswered = false;
                    prepareQuestion(game);
                }
                break;

            case GameStatus.REVEAL:
                if (currentQIndex === game.qIndex) {
                    showFeedback(game);
                }
                break;

            case GameStatus.FINISHED:
                showFinalResults();
                break;
        }
    });

}

// 3. Question Logic
async function prepareQuestion(game) {
    showScreen("question");

    // UI Reset
    document.querySelectorAll(".answer-btn").forEach(btn => btn.classList.remove("disabled", "selected"));

    // Local Timer Logic
    const start = game.questionStartMs;
    const duration = game.questionDurationSec * 1000;

    // Visual bar
    studentTimer.style.transition = "none";
    studentTimer.style.width = "100%";

    const updateBar = () => {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, duration - elapsed);
        const pc = (remaining / duration) * 100;
        studentTimer.style.width = pc + "%";
        if (remaining > 0 && !hasAnswered) requestAnimationFrame(updateBar);
    };
    requestAnimationFrame(updateBar);

    // Fetch quiz questions
    const quizSnap = await getDoc(doc(db, "quizzes", game.quizId));
    const quiz = quizSnap.data();
    const q = quiz.questions[game.qIndex];

    document.querySelectorAll(".answer-btn").forEach((btn, i) => {
        btn.onclick = () => {
            if (hasAnswered) return;
            hasAnswered = true;
            btn.classList.add("selected");
            document.querySelectorAll(".answer-btn").forEach(b => b.classList.add("disabled"));
            submitAnswer(i);
        };
    });
}

async function submitAnswer(index) {
    const uid = auth.currentUser.uid;
    // Write answer - ID prevents duplicates (uid_qIndex)
    await setDoc(doc(db, "games", currentGameId, "answers", `${uid}_${currentQIndex}`), {
        uid,
        index,
        qIndex: currentQIndex,
        clientTimeMs: Date.now()
    });

    // Display "Waiting for host..."
    feedbackMsg.textContent = "Answer Locked!";
    feedbackIcon.textContent = "🔒";
    pointsWon.textContent = "Calculating scores...";
    showScreen("feedback");
}

async function showFeedback(game) {
    const uid = auth.currentUser.uid;

    // Wait briefly so the host's batch score update has time to propagate
    await new Promise(r => setTimeout(r, 1200));

    const pSnap = await getDoc(doc(db, "games", currentGameId, "players", uid));
    const pData = pSnap.data() || { score: 0, lastEarned: 0 };

    const lastEarned = pData.lastEarned || 0;
    const isCorrect = lastEarned > 0;

    feedbackMsg.textContent = isCorrect ? "CORRECT! 🎉" : "WRONG!";
    feedbackIcon.textContent = isCorrect ? "✅" : "❌";
    pointsWon.textContent = lastEarned > 0 ? `+${lastEarned.toLocaleString()} pts` : "Better luck next question!";
    currentScoreEl.textContent = (pData.score || 0).toLocaleString();

    if (isCorrect) {
        document.getElementById("sfxCorrect")?.play().catch(() => { });
        if (window.confetti) {
            window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
    } else {
        document.getElementById("sfxWrong")?.play().catch(() => { });
    }
}

async function showFinalResults() {
    const uid = auth.currentUser.uid;

    // Fetch all players to calculate rank
    const pSnap = await getDocs(query(collection(db, "games", currentGameId, "players"), orderBy("score", "desc")));
    let rank = 0;
    let score = 0;

    pSnap.docs.forEach((d, i) => {
        if (d.id === uid) {
            rank = i + 1;
            score = d.data().score;
        }
    });

    const rankText = rank === 1 ? "🥇 1st PLACE" : rank === 2 ? "🥈 2nd PLACE" : rank === 3 ? "🥉 3rd PLACE" : `#${rank} Place`;
    finalRank.textContent = rankText;
    finalScore.innerHTML = `You earned <span style="color:var(--accent-secondary); font-size:2rem; display:block; margin:10px 0;">${score.toLocaleString()}</span> points!`;

    showScreen("end");

    // Celebratory confetti for top 3
    if (rank <= 3 && window.confetti) {
        const duration = 5 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min, max) => Math.random() * (max - min) + min;

        const interval = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) return clearInterval(interval);
            const particleCount = 50 * (timeLeft / duration);
            window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            window.confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    }
}
