import { db, auth, ensureAnonAuth, TS, Fire } from "./firebase.js";
const { doc, setDoc, updateDoc, onSnapshot, collection, query, where, getDoc, writeBatch } = Fire;

let currentGameId = null;
let currentPassage = "";
let durationSec = 60;
let players = {};
let gameInterval = null;
let scoringInterval = null;
let startMs = 0;
let status = 'setup';

const views = {
    setup: document.getElementById("view-setup"),
    lobby: document.getElementById("view-lobby"),
    running: document.getElementById("view-running"),
    finished: document.getElementById("view-finished")
};

const passageInput = document.getElementById("passageInput");
const durationInput = document.getElementById("durationInput");
const presetSelect = document.getElementById("presetSelect");
const createBtn = document.getElementById("createBtn");
const lobbyPin = document.getElementById("lobbyPin");
const shareLink = document.getElementById("shareLink");
const lobbyPlayerList = document.getElementById("lobbyPlayerList");
const playerCountEl = document.getElementById("playerCount");
const startBtn = document.getElementById("startBtn");
const lobbyPassagePreview = document.getElementById("lobbyPassagePreview");
const charCountEl = document.getElementById("charCount");
const durationDisplay = document.getElementById("durationDisplay");
const gameTimer = document.getElementById("gameTimer");
const leaderboardBody = document.getElementById("leaderboardBody");
const finalResultsBody = document.getElementById("finalResultsBody");
const passageRunning = document.getElementById("passageRunning");

// Initialize
async function init() {
    await ensureAnonAuth();
    if (window.lucide) window.lucide.createIcons();
}

// Preset handling
presetSelect.addEventListener("change", () => {
    if (presetSelect.value) {
        passageInput.value = presetSelect.value;
    }
});

// 1. Create Session
createBtn.addEventListener("click", async () => {
    currentPassage = passageInput.value.trim();
    durationSec = parseInt(durationInput.value) || 60;

    if (!currentPassage || currentPassage.length < 10) {
        alert("Passage must be at least 10 characters!");
        return;
    }

    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    currentGameId = crypto.randomUUID();

    const sessionData = {
        hostUid: auth.currentUser.uid,
        status: 'lobby',
        text: currentPassage,
        durationSec: durationSec,
        createdAt: TS(),
        startMs: 0
    };

    await setDoc(doc(db, "typingSessions", currentGameId), sessionData);
    await setDoc(doc(db, "typingPins", pin), { sid: currentGameId });

    lobbyPin.textContent = pin;
    shareLink.textContent = `${window.location.origin}/livequiz/type.html?sid=${currentGameId}`;
    lobbyPassagePreview.textContent = currentPassage;
    charCountEl.textContent = currentPassage.length;
    durationDisplay.textContent = durationSec;

    showView('lobby');
    listenToPlayers();
});

function showView(viewName) {
    Object.keys(views).forEach(k => views[k].style.display = 'none');
    views[viewName].style.display = viewName === 'running' ? 'flex' : 'block';
    if (viewName === 'finished') views.finished.style.display = 'flex';
}

function listenToPlayers() {
    const q = collection(db, "typingSessions", currentGameId, "players");
    onSnapshot(q, (snap) => {
        players = {};
        lobbyPlayerList.innerHTML = "";
        snap.forEach(d => {
            const p = d.data();
            players[d.id] = { uid: d.id, ...p };

            // For Lobby
            const span = document.createElement("span");
            span.className = "player-pill";
            span.textContent = p.name;
            lobbyPlayerList.appendChild(span);
        });
        playerCountEl.textContent = `${snap.size} Players Joined`;

        if (status === 'running') {
            updateLeaderboard();
        }
    });
}

// 2. Start Game
startBtn.addEventListener("click", async () => {
    if (Object.keys(players).length === 0) {
        alert("Wait for players to join!");
        return;
    }

    status = 'running';
    startMs = Date.now();
    passageRunning.textContent = currentPassage;

    await updateDoc(doc(db, "typingSessions", currentGameId), {
        status: 'running',
        startMs: startMs
    });

    showView('running');
    startTimers();
});

function startTimers() {
    // Game Timer (Countdown)
    gameInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startMs) / 1000);
        const remaining = Math.max(0, durationSec - elapsed);
        gameTimer.textContent = remaining;

        if (remaining <= 0) {
            finishGame();
        }
    }, 1000);

    // Scoring Loop (Frequency: 1s)
    scoringInterval = setInterval(() => {
        calculateAllScores();
    }, 1000);
}

function calculateAllScores() {
    const elapsedSec = (Date.now() - startMs) / 1000;
    if (elapsedSec <= 0) return;

    const batch = writeBatch(db);
    let hasUpdates = false;

    Object.values(players).forEach(p => {
        if (p.done) return;

        // WPM = (typedLen / 5) / (min)
        const typedLen = p.typedLen || 0;
        const errors = p.errors || 0;
        const wpm = Math.max(0, Math.round((typedLen / 5) / (elapsedSec / 60)));
        const accuracy = typedLen > 0 ? Math.round(((typedLen - errors) / typedLen) * 100) : 100;

        // Kahoot-like scoring logic
        // Base score = (WPM * 10) + (Accuracy * 5)
        // Penalty = Errors * 20
        const score = Math.max(0, (wpm * 20) + (accuracy * 10) - (errors * 30));

        // Update local state for immediate re-render
        players[p.uid] = { ...players[p.uid], wpm, accuracy, score };

        // Batch update to Firestore
        const pRef = doc(db, "typingSessions", currentGameId, "players", p.uid);
        batch.update(pRef, { wpm, accuracy, score });
        hasUpdates = true;
    });

    if (hasUpdates) {
        batch.commit();
        updateLeaderboard();
    }
}

function updateLeaderboard() {
    const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    leaderboardBody.innerHTML = "";

    sorted.forEach(p => {
        const row = document.createElement("tr");
        const flags = [];
        if (p.flags?.suspiciousSpeed) flags.push("🚀 Speed!");
        if (p.blurCount > 2) flags.push(`😴 Focus (${p.blurCount})`);

        row.innerHTML = `
            <td>${p.name}</td>
            <td>${p.wpm || 0}</td>
            <td>${p.accuracy || 100}%</td>
            <td><strong>${(p.score || 0).toLocaleString()}</strong></td>
            <td class="flag-warning">${flags.join(", ")}</td>
        `;
        leaderboardBody.appendChild(row);
    });
}

// 3. Finish Game
async function finishGame() {
    clearInterval(gameInterval);
    clearInterval(scoringInterval);
    status = 'finished';

    await updateDoc(doc(db, "typingSessions", currentGameId), {
        status: 'finished'
    });

    showView('finished');
    renderFinalResults();
}

function renderFinalResults() {
    const sorted = Object.values(players).sort((a, b) => (b.score || 0) - (a.score || 0));
    finalResultsBody.innerHTML = "";
    sorted.forEach((p, i) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.wpm || 0}</td>
            <td>${p.accuracy || 100}%</td>
            <td><strong>${(p.score || 0).toLocaleString()}</strong></td>
        `;
        finalResultsBody.appendChild(row);
    });
}

init();
