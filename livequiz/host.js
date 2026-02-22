import { db, auth, ensureAnonAuth, TS, Fire, GameStatus, calculatePoints } from "./firebase.js";
const { doc, setDoc, getDocs, collection, query, orderBy, onSnapshot, updateDoc, writeBatch } = Fire;

// Helper: strip markdown bold/italic markers from text
function cleanText(t) {
    return t ? t.replace(/\*\*/g, "").replace(/\*/g, "").replace(/^\d+[.):] ?/, "").trim() : "";
}

// ── State ──────────────────────────────────────────────────────────────────
let currentGameId = null;
let currentQuiz = null;
let players = {};
let timerInterval = null;
let lbUnsubscribe = null;
let lbLimit = 10;
let lbFrozen = false;
let lastRanks = {};
let allQuizzes = []; // { id, title, questions }
let selectedQuizId = null;

// ── Audio ──────────────────────────────────────────────────────────────────
const sounds = {
    lobby: new Audio("https://assets.mixkit.co/active_storage/sfx/123/123-preview.mp3"),
    game: new Audio("quiz)background.mp3"),  // local bg during gameplay
    correct: new Audio("https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3"),
    tick: new Audio("https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3"),
    podium: new Audio("https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3"),
    cheer: new Audio("popper.mp3")  // Updated to popper.mp3 as requested
};
sounds.lobby.loop = true;
sounds.game.loop = true;

function stopAllBg(keepGameMusic = false) {
    sounds.lobby.pause(); sounds.lobby.currentTime = 0;
    if (!keepGameMusic) {
        sounds.game.pause(); sounds.game.currentTime = 0;
    }
    sounds.podium.pause();
}

// ── DOM ────────────────────────────────────────────────────────────────────
const views = {
    setup: document.getElementById("view-setup"),
    lobby: document.getElementById("view-lobby"),
    question: document.getElementById("view-question"),
    podium: document.getElementById("view-podium")
};

const quizSearchInput = document.getElementById("quizSearchInput");
const quizResults = document.getElementById("quizResults");
const selectedQuizBadge = document.getElementById("selectedQuizBadge");
const selectedQuizTitle = document.getElementById("selectedQuizTitle");
const clearQuizBtn = document.getElementById("clearQuizBtn");
const modeSelect = document.getElementById("modeSelect");
const createBtn = document.getElementById("createBtn");
const lobbyPin = document.getElementById("lobbyPin");
const playerCountEl = document.getElementById("playerCount");
const playerListEl = document.getElementById("playerList");
const startBtn = document.getElementById("startBtn");
const qTitle = document.getElementById("qTitle");
const qCounter = document.getElementById("qCounter");
const timerEl = document.getElementById("timer");
const optionsList = document.getElementById("optionsList");
const nextBtn = document.getElementById("nextBtn");
const answerStats = document.getElementById("answerStats");
const confettiCanvas = document.getElementById("confetti-canvas");

// Creation/Tab Elements
const tabSelect = document.getElementById("tabSelect");
const tabCreate = document.getElementById("tabCreate");
const sectionSelect = document.getElementById("sectionSelect");
const sectionCreate = document.getElementById("sectionCreate");
const quizTitleInput = document.getElementById("quizTitleInput");
const creationModeSelect = document.getElementById("creationMode");
const manualModeForm = document.getElementById("manualModeForm");
const importModeGuide = document.getElementById("importModeGuide");
const manualQ = document.getElementById("manualQ");
const manualOpts = document.querySelectorAll(".manual-opt");

// ── Confetti ───────────────────────────────────────────────────────────────
let confettiParticles = [];
let confettiRAF = null;

function launchConfetti() {
    confettiCanvas.style.display = "block";
    const ctx = confettiCanvas.getContext("2d");
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    const COLORS = ["#facc15", "#6366f1", "#ec4899", "#10b981", "#f97316", "#38bdf8", "#a78bfa"];
    confettiParticles = Array.from({ length: 180 }, () => ({
        x: Math.random() * confettiCanvas.width,
        y: Math.random() * -confettiCanvas.height,
        r: Math.random() * 10 + 5,
        d: Math.random() * 180,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        tilt: Math.random() * 10 - 10,
        tiltAngle: 0,
        tiltIncrement: Math.random() * 0.07 + 0.05,
        fall: Math.random() * 4 + 2
    }));

    // Play pop sound
    sounds.cheer.currentTime = 0;
    sounds.cheer.play().catch(() => { });
    sounds.podium.play().catch(() => { });

    function drawConfetti() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiParticles.forEach(p => {
            ctx.beginPath();
            ctx.save();
            ctx.translate(p.x + p.r, p.y + p.r);
            ctx.rotate(p.tiltAngle);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
            ctx.restore();

            p.tiltAngle += p.tiltIncrement;
            p.y += p.fall;
            p.tilt = Math.sin(p.tiltAngle) * 15;

            if (p.y > confettiCanvas.height) {
                p.y = -20;
                p.x = Math.random() * confettiCanvas.width;
            }
        });
        confettiRAF = requestAnimationFrame(drawConfetti);
    }
    drawConfetti();

    // Stop after 8 seconds
    setTimeout(() => {
        cancelAnimationFrame(confettiRAF);
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        confettiCanvas.style.display = "none";
    }, 8000);
}

// ── Quiz Search UI ─────────────────────────────────────────────────────────
function renderQuizResults(filter = "") {
    const term = filter.toLowerCase().trim();
    const matches = term
        ? allQuizzes.filter(q => q.title.toLowerCase().includes(term))
        : allQuizzes;

    quizResults.innerHTML = "";
    if (matches.length === 0) {
        quizResults.innerHTML = `<div class="quiz-result-item" style="opacity:0.5; cursor:default;">No quizzes found</div>`;
    } else {
        matches.forEach(q => {
            const div = document.createElement("div");
            div.className = "quiz-result-item";
            div.innerHTML = `<div style="font-weight:700">${q.title}</div>
                <div class="quiz-q-count">${q.questions.length} question${q.questions.length !== 1 ? "s" : ""}</div>`;
            div.addEventListener("click", () => selectQuiz(q));
            quizResults.appendChild(div);
        });
    }
    quizResults.style.display = "block";
}

function selectQuiz(q) {
    selectedQuizId = q.id;
    selectedQuizTitle.textContent = q.title;
    selectedQuizBadge.style.display = "flex";
    quizResults.style.display = "none";
    quizSearchInput.value = "";
}

function clearSelection() {
    selectedQuizId = null;
    selectedQuizBadge.style.display = "none";
    quizSearchInput.value = "";
    quizResults.style.display = "none";
}

quizSearchInput.addEventListener("input", () => {
    renderQuizResults(quizSearchInput.value);
});

quizSearchInput.addEventListener("focus", () => {
    if (allQuizzes.length) renderQuizResults(quizSearchInput.value);
});

document.addEventListener("click", (e) => {
    if (!document.querySelector(".quiz-search-wrap").contains(e.target)) {
        quizResults.style.display = "none";
    }
});

clearQuizBtn.addEventListener("click", clearSelection);

// ── Leaderboard UI Helpers ─────────────────────────────────────────────────
function toggleLbFreeze() {
    lbFrozen = !lbFrozen;
    const btns = [document.getElementById("freezeLbBtn"), document.getElementById("freezeGameLbBtn")];
    btns.forEach(btn => {
        if (btn) {
            btn.textContent = lbFrozen ? "Resume" : "Freeze";
            btn.classList.toggle("active", lbFrozen);
        }
    });
    if (lbFrozen) {
        if (lbUnsubscribe) lbUnsubscribe();
    } else {
        startLeaderboardListener();
    }
}

function toggleLbLimit() {
    lbLimit = (lbLimit === 10) ? 50 : 10;
    const btn = document.getElementById("toggleTopBtn");
    if (btn) {
        btn.textContent = lbLimit === 50 ? "Top 50" : "Top 10";
        btn.classList.toggle("active", lbLimit === 50);
    }
    if (!lbFrozen) startLeaderboardListener();
}

function renderLeaderboard(data) {
    const lists = [document.getElementById("leaderboardList"), document.getElementById("gameLeaderboardList")];
    lists.forEach(list => {
        if (!list) return;
        list.innerHTML = "";
        data.forEach((p, i) => {
            const rank = i + 1;
            const row = document.createElement("div");
            row.className = "lb-row";
            if (lastRanks[p.id]) {
                if (rank < lastRanks[p.id]) row.classList.add("rank-up");
                else if (rank > lastRanks[p.id]) row.classList.add("rank-down");
            }
            lastRanks[p.id] = rank;
            row.innerHTML = `
                <div class="lb-rank">#${rank}</div>
                <div class="lb-name">${p.name}</div>
                <div class="lb-score">${(p.score || 0).toLocaleString()}</div>
            `;
            list.appendChild(row);
        });
        if (data.length === 0) {
            list.innerHTML = `<p style="color: var(--text-muted); text-align: center;">Waiting for heroes...</p>`;
        }
    });
}

function startLeaderboardListener() {
    if (lbUnsubscribe) lbUnsubscribe();
    if (!currentGameId || lbFrozen) return;

    const q = query(
        collection(db, "games", currentGameId, "players"),
        orderBy("score", "desc"),
        Fire.limit(lbLimit)
    );

    lbUnsubscribe = onSnapshot(q, (snap) => {
        const newPlayers = [];
        players = {}; // Reset global player list
        snap.forEach(d => {
            const pData = { id: d.id, ...d.data() };
            newPlayers.push(pData);
            players[d.id] = pData; // Populate for startBtn check
        });
        renderLeaderboard(newPlayers);
        playerCountEl.textContent = `${snap.size} Players Joined`;

        // Update battle log if in lobby
        const logEl = document.getElementById("lobbyLog");
        if (logEl && views.lobby.style.display !== "none") {
            logEl.innerHTML = newPlayers.map(p => `<div>⚔️ ${p.name} joined the battle</div>`).join("");
        }
    });
}

// ── Tab & Creation Logic ──────────────────────────────────────────────────
tabSelect.addEventListener("click", () => {
    tabSelect.classList.add("active");
    tabCreate.classList.remove("active");
    sectionSelect.style.display = "block";
    sectionCreate.style.display = "none";
    clearSelection();
});

tabCreate.addEventListener("click", () => {
    tabCreate.classList.add("active");
    tabSelect.classList.remove("active");
    sectionCreate.style.display = "block";
    sectionSelect.style.display = "none";
    clearSelection(); // Clear search selection if we're creating
});

creationModeSelect.addEventListener("change", () => {
    if (creationModeSelect.value === "manual") {
        manualModeForm.style.display = "flex";
        importModeGuide.style.display = "none";
    } else {
        manualModeForm.style.display = "none";
        importModeGuide.style.display = "block";
    }
});

// ── Initialization ─────────────────────────────────────────────────────────
async function init() {
    await ensureAnonAuth();
    await loadQuizzes();

    // Initialize Lucide icons
    if (window.lucide) {
        window.lucide.createIcons();
    }

    // Leaderboard buttons
    document.getElementById("freezeLbBtn")?.addEventListener("click", toggleLbFreeze);
    document.getElementById("freezeGameLbBtn")?.addEventListener("click", toggleLbFreeze);
    document.getElementById("toggleTopBtn")?.addEventListener("click", toggleLbLimit);

    // If redirected from importer with a quizId, auto-select it
    const params = new URLSearchParams(window.location.search);
    const quizId = params.get("quizId");
    if (quizId) {
        const found = allQuizzes.find(q => q.id === quizId);
        if (found) selectQuiz(found);
    }
}

async function loadQuizzes() {
    const snap = await getDocs(collection(db, "quizzes"));
    allQuizzes = [];
    snap.forEach(d => {
        const data = d.data();
        allQuizzes.push({ id: d.id, title: data.title || "Untitled", questions: data.questions || [] });
    });
}

// ── View Switching ─────────────────────────────────────────────────────────
function showView(viewId) {
    Object.values(views).forEach(v => v.style.display = "none");
    views[viewId].style.display = (viewId === "setup" || viewId === "question") ? "flex" : "grid";
    if (viewId === "podium") views.podium.style.display = "flex";

    // Stop lobby music when entering any game phase
    if (viewId !== "setup" && viewId !== "lobby") {
        sounds.lobby.pause();
        sounds.lobby.currentTime = 0;
    }

    if (viewId === "lobby") {
        stopAllBg(); // Clear all including game music if we're back in lobby
        sounds.lobby.play().catch(() => { });
    }
}

// ── 1. Setup Phase ─────────────────────────────────────────────────────────
createBtn.addEventListener("click", async () => {
    let quizIdToStart = selectedQuizId;

    // Handle Manual Creation
    if (tabCreate.classList.contains("active") && creationModeSelect.value === "manual") {
        const title = quizTitleInput.value.trim();
        const question = manualQ.value.trim();
        const options = Array.from(manualOpts).map(i => i.value.trim()).filter(v => v);
        const correctIndex = parseInt(document.querySelector('input[name="correct"]:checked')?.value || "0");

        if (!title || !question || options.length < 2) {
            return alert("Please enter a title, question, and at least 2 options!");
        }

        const newQuiz = {
            title,
            questions: [{
                question,
                options,
                correctIndex
            }],
            createdAt: TS()
        };

        const docRef = await Fire.addDoc(collection(db, "quizzes"), newQuiz);
        quizIdToStart = docRef.id;
    }

    if (!quizIdToStart) return alert("Please select or create a quiz first!");

    const quizSnap = await Fire.getDoc(doc(db, "quizzes", quizIdToStart));
    currentQuiz = quizSnap.data();
    currentQuiz.id = quizIdToStart;
    const gameMode = modeSelect.value;

    const pin = String(Math.floor(100000 + Math.random() * 900000));
    currentGameId = crypto.randomUUID();

    await setDoc(doc(db, "games", currentGameId), {
        pin,
        status: GameStatus.LOBBY,
        quizId: selectedQuizId,
        gameMode,
        qIndex: -1,
        hostUid: auth.currentUser.uid,
        createdAt: TS(),
        correctAnswerIndex: -1
    });

    await setDoc(doc(db, "pins", pin), { gameId: currentGameId });
    lobbyPin.textContent = pin;
    showView("lobby");
    startLeaderboardListener();
});

// Removed old listenToPlayers as it's merged into startLeaderboardListener

startBtn.addEventListener("click", () => {
    if (Object.keys(players).length === 0) return alert("Wait for players!");
    // Start bg music here — inside a user gesture so autoplay is allowed
    sounds.game.play().catch(() => { });
    goToNextQuestion();
});

// ── 3. Question Phase ──────────────────────────────────────────────────────
async function goToNextQuestion() {
    const nextIndex = (currentQuiz.currentQIndex ?? -1) + 1;
    currentQuiz.currentQIndex = nextIndex;

    if (nextIndex >= currentQuiz.questions.length) {
        return showPodium();
    }

    showView("question");
    nextBtn.style.display = "none";
    answerStats.style.display = "block";

    const q = currentQuiz.questions[nextIndex];
    qTitle.textContent = cleanText(q.question);
    qCounter.textContent = `Question ${nextIndex + 1} of ${currentQuiz.questions.length}`;

    let duration = 20;
    if (modeSelect?.value === "speed" || currentQuiz.gameMode === "speed") duration = 10;
    if (modeSelect?.value === "survival" || currentQuiz.gameMode === "survival") duration = 60;

    await updateDoc(doc(db, "games", currentGameId), {
        status: GameStatus.QUESTION,
        qIndex: nextIndex,
        questionStartMs: Date.now(),
        questionDurationSec: duration,
        correctAnswerIndex: -1
    });

    renderOptions(q.options);
    startTimer(duration);
    listenToAnswers(nextIndex);
}

function renderOptions(options) {
    optionsList.innerHTML = "";
    const colors = ["var(--kahoot-red)", "var(--kahoot-blue)", "var(--kahoot-green)", "var(--kahoot-yellow)"];
    options.forEach((opt, i) => {
        const div = document.createElement("div");
        div.className = "glass-card flex-center";
        div.style.padding = "20px";
        div.style.background = colors[i % 4];
        div.style.fontSize = "1.5rem";
        div.style.fontWeight = "800";
        div.textContent = cleanText(opt);
        optionsList.appendChild(div);
    });
}

function startTimer(sec) {
    let left = sec;
    timerEl.textContent = left;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        left--;
        timerEl.textContent = left;
        if (left <= 5 && left > 0) sounds.tick.play().catch(() => { });
        if (left <= 0) {
            clearInterval(timerInterval);
            revealAnswer();
        }
    }, 1000);
}

function listenToAnswers(qIndex) {
    const answersRef = collection(db, "games", currentGameId, "answers");
    onSnapshot(answersRef, (snap) => {
        const count = snap.docs.filter(d => d.id.endsWith(`_${qIndex}`)).length;
        answerStats.textContent = `${count} / ${Object.keys(players).length} Answered`;
        if (count >= Object.keys(players).length && count > 0) {
            clearInterval(timerInterval);
            revealAnswer();
        }
    });
}

async function revealAnswer() {
    sounds.correct.play().catch(() => { });
    const qIndex = currentQuiz.currentQIndex;
    const q = currentQuiz.questions[qIndex];
    const gameRef = doc(db, "games", currentGameId);
    const gameSnap = await Fire.getDoc(gameRef);
    const gameData = gameSnap.data();

    const batch = writeBatch(db);
    const answersSnap = await getDocs(collection(db, "games", currentGameId, "answers"));
    const currentAnswers = answersSnap.docs.filter(d => d.id.endsWith(`_${qIndex}`));

    currentAnswers.forEach(ansDoc => {
        const ans = ansDoc.data();
        if (ans.index === q.correctIndex) {
            const points = calculatePoints(ans.clientTimeMs, gameData.questionStartMs, gameData.questionDurationSec);
            const playerRef = doc(db, "games", currentGameId, "players", ans.uid);
            batch.update(playerRef, { score: Fire.increment(points), lastEarned: points });
        } else {
            const playerRef = doc(db, "games", currentGameId, "players", ans.uid);
            batch.update(playerRef, { lastEarned: 0 });
        }
    });

    batch.update(gameRef, { status: GameStatus.REVEAL, correctAnswerIndex: q.correctIndex });
    await batch.commit();

    answerStats.style.display = "none";
    const items = optionsList.children;
    for (let i = 0; i < items.length; i++) {
        if (i !== q.correctIndex) {
            items[i].style.opacity = "0.3";
        } else {
            items[i].style.opacity = "1";
            items[i].style.transform = "scale(1.05)";
            items[i].style.boxShadow = "0 0 30px var(--accent-success)";
            items[i].style.border = "3px solid #10b981";
        }
    }
    // Show Next button but also auto-advance after 4 seconds
    nextBtn.style.display = "block";
    clearTimeout(window._autoAdvanceTimer);
    window._autoAdvanceTimer = setTimeout(() => goToNextQuestion(), 4000);
}

nextBtn.addEventListener("click", () => {
    clearTimeout(window._autoAdvanceTimer);
    goToNextQuestion();
});

// ── 4. Podium Phase ────────────────────────────────────────────────────────
async function showPodium() {
    await updateDoc(doc(db, "games", currentGameId), { status: GameStatus.FINISHED });

    const pSnap = await getDocs(query(collection(db, "games", currentGameId, "players"), orderBy("score", "desc")));
    const leaderboard = [];
    pSnap.forEach(d => leaderboard.push(d.data()));

    stopAllBg(false); // Stop game music now that we are at the podium
    showView("podium");

    const spots = [
        document.querySelector("#podium-1"),
        document.querySelector("#podium-2"),
        document.querySelector("#podium-3")
    ];
    spots.forEach((s, i) => {
        if (s) {
            s.style.opacity = "0"; // Initial state for animation
            s.classList.remove("reveal");
            if (leaderboard[i]) {
                s.querySelector(".name").textContent = leaderboard[i].name;
                s.querySelector(".score").textContent = `${leaderboard[i].score.toLocaleString()} pts`;
            }
        }
    });

    // Sequence the reveal
    setTimeout(() => {
        if (spots[2]) spots[2].classList.add("reveal"); // 3rd
        setTimeout(() => {
            if (spots[1]) spots[1].classList.add("reveal"); // 2nd
            setTimeout(() => {
                if (spots[0]) spots[0].classList.add("reveal"); // 1st
                launchConfetti();
            }, 800);
        }, 800);
    }, 500);
}

init();
