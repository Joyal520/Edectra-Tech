/**
 * EDTECHRA — Board Game Host Logic
 * Firebase-powered multiplayer adapter for the existing board game engine.
 *
 * This module orchestrates Firebase state and calls into the existing
 * app_v3.js functions (buildBoard, createTokens, movePlayer, checkTileEffect, etc.)
 *
 * IMPORTANT: app_v3.js is loaded BEFORE this module via <script> in host.html.
 * All globals from app_v3.js (players, tiles, CFG, etc.) are available.
 */

import {
    db, auth, ensureAnonAuth, onAuthReady,
    GameState, GameMode, TEAM_COLORS, TEAM_NAMES,
    generateJoinCode, Fire, TS
} from './firebase-board.js';

/* ======= HOST STATE ======= */
let hostGameId = null;
let hostUid = null;
let joinCode = '';
let gameMode = GameMode.SOLO;
let roundCounter = 0;
let currentRoundId = null;
let currentState = GameState.LOBBY;
let answeredCount = 0;
let totalPlayers = 0;
let hostTimerInterval = null;
let timerSeconds = 20;
let hostQuestions = [];
let currentQuestionIndex = 0;
let connectedPlayers = {}; // uid -> playerData
let teamsData = {};        // teamId -> teamData

// Listeners
let unsubGame = null;
let unsubPlayers = null;
let unsubAnswers = null;

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

/* ======= HOST UI HELPERS ======= */
window.onModeChange = function () {
    const mode = document.getElementById('host-mode').value;
    const teamSection = document.getElementById('team-names-section');
    if (mode === 'teams') {
        teamSection.style.display = 'block';
        // Add two default team fields if empty
        const list = document.getElementById('team-names-list');
        if (list.children.length === 0) {
            addTeamNameField('Team Alpha');
            addTeamNameField('Team Beta');
        }
    } else {
        teamSection.style.display = 'none';
    }
};

window.addTeamNameField = function (defName = '') {
    const list = document.getElementById('team-names-list');
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.gap = '8px';
    div.innerHTML = `
        <input type="text" class="team-name-input" value="${defName}" placeholder="Enter Team Name" style="flex: 1; padding: 10px 14px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; color: #f1f5f9;">
        <button onclick="this.parentElement.remove()" style="background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; color: #ef4444; width: 40px; cursor: pointer;">✕</button>
    `;
    list.appendChild(div);
};

/* ======= INIT ======= */
onAuthReady(async (user) => {
    hostUid = user.uid;
    console.log('[Host] Authenticated as', hostUid);
});

/* ======= CREATE GAME ======= */
window.createGame = async function () {
    try {
        const user = await ensureAnonAuth();
        hostUid = user.uid;

        gameMode = document.getElementById('host-mode').value;
        timerSeconds = parseInt(document.getElementById('host-timer').value) || 20;
        joinCode = generateJoinCode();

        // Parse quiz
        const importText = document.getElementById('host-quiz-import').value.trim();
        if (importText && typeof parseEQM === 'function') {
            const parsed = parseEQM(importText);
            if (parsed.questions.length > 0) hostQuestions = parsed.questions;
        }
        if (hostQuestions.length === 0) {
            // Use defaults from app_v3.js
            hostQuestions = typeof DEFAULT_Q !== 'undefined' ? [...DEFAULT_Q] : [];
        }

        // Create game doc
        const gameRef = Fire.doc(Fire.collection(db, 'boardgames'));
        hostGameId = gameRef.id;

        const chaosModeEnabled = document.getElementById('host-chaos-toggle').checked;

        await Fire.setDoc(gameRef, {
            mode: gameMode,
            state: GameState.LOBBY,
            hostUid: hostUid,
            joinCode: joinCode,
            createdAt: TS(),
            currentRoundId: null,
            currentQuestionIndex: 0,
            timerEndsAt: null,
            chaosMode: chaosModeEnabled,
            settings: {
                timerSeconds: timerSeconds,
                maxTeams: 4,
                maxPlayers: 40
            },
            version: 'v3'
        });

        // Create host as player
        const hostPlayerRef = Fire.doc(db, 'boardgames', hostGameId, 'players', hostUid);
        await Fire.setDoc(hostPlayerRef, {
            displayName: 'HOST',
            role: 'host',
            teamId: null,
            connected: true,
            lastSeenAt: TS(),
            score: 0,
            position: 0,
            frozenNextTurn: false
        });

        // Create teams if team mode
        if (gameMode === GameMode.TEAMS) {
            const teamInputs = document.querySelectorAll('.team-name-input');
            const teamNames = Array.from(teamInputs).map(i => i.value.trim()).filter(n => n !== '');

            // If no names provided, use defaults
            const finalTeamNames = teamNames.length > 0 ? teamNames : ['TEAM ALPHA', 'TEAM BETA'];

            for (let i = 0; i < finalTeamNames.length; i++) {
                const teamRef = Fire.doc(Fire.collection(db, 'boardgames', hostGameId, 'teams'));
                await Fire.setDoc(teamRef, {
                    name: finalTeamNames[i].toUpperCase(),
                    color: TEAM_COLORS[i % TEAM_COLORS.length],
                    position: 0,
                    score: 0,
                    frozenNextTurn: false,
                    membersCount: 0
                });
            }
        }

        // Show lobby info
        document.getElementById('join-code-display').textContent = joinCode;
        document.getElementById('lobby-info-card').style.display = 'block';
        document.getElementById('btn-create-game').style.display = 'none';
        document.getElementById('btn-start-game').style.display = 'inline-block';

        // Start listening for players
        startPlayerListener();

        console.log('[Host] Game created:', hostGameId, 'Code:', joinCode);

    } catch (err) {
        console.error('[Host] Create error:', err);
        alert('Failed to create game: ' + err.message);
    }
};

/* ======= COPY JOIN CODE ======= */
window.copyJoinCode = function () {
    navigator.clipboard.writeText(joinCode).then(() => {
        const el = document.getElementById('join-code-display');
        el.textContent = '✅ COPIED!';
        setTimeout(() => el.textContent = joinCode, 1500);
    });
};

/* ======= PLAYER LISTENER ======= */
function startPlayerListener() {
    const playersRef = Fire.collection(db, 'boardgames', hostGameId, 'players');
    unsubPlayers = Fire.onSnapshot(playersRef, (snap) => {
        connectedPlayers = {};
        let count = 0;

        snap.forEach(doc => {
            const data = doc.data();
            if (data.role !== 'host') {
                connectedPlayers[doc.id] = data;
                count++;
            }
        });

        totalPlayers = count;
        document.getElementById('player-count-live').textContent = count;

        // Update player chips in lobby
        const list = document.getElementById('lobby-players-list');
        list.innerHTML = '';
        Object.entries(connectedPlayers).forEach(([uid, data]) => {
            const chip = document.createElement('div');
            chip.className = 'lobby-player-chip';
            chip.innerHTML = `
                <span class="dot" style="background: ${data.connected ? '#22c55e' : '#ef4444'}"></span>
                ${data.displayName}
                ${data.teamId ? '<small style="opacity:0.5; margin-left: 4px;">(' + getTeamName(data.teamId) + ')</small>' : ''}
            `;
            list.appendChild(chip);
        });

        // Enable start button if enough players
        const startBtn = document.getElementById('btn-start-game');
        startBtn.disabled = count < 1;
    });
}

function getTeamName(teamId) {
    return teamsData[teamId]?.name || 'Team';
}

/* ======= START GAME ======= */
window.hostStartGame = async function () {
    if (totalPlayers < 1) return;

    // Setup players array for the existing engine (app_v3.js)
    // The existing engine uses: players, tiles, buildBoard, createTokens, etc.
    const playerEntries = Object.entries(connectedPlayers);
    const enginePlayers = [];

    if (gameMode === GameMode.TEAMS) {
        // Load teams
        const teamsSnap = await Fire.getDocs(Fire.collection(db, 'boardgames', hostGameId, 'teams'));
        let teamIndex = 0;
        teamsSnap.forEach(doc => {
            const data = doc.data();
            teamsData[doc.id] = data;
            if (data.membersCount > 0) {
                enginePlayers.push({
                    id: teamIndex,
                    firestoreTeamId: doc.id,
                    name: data.name.toUpperCase(),
                    color: data.color,
                    position: 0,
                    score: 0,
                    xp: 0,
                    frozen: false,
                    el: null
                });
                teamIndex++;
            }
        });
    } else {
        // Solo mode: each player is a token on the board
        playerEntries.forEach(([uid, data], i) => {
            enginePlayers.push({
                id: i,
                firestoreUid: uid,
                name: data.displayName,
                color: CFG.COLORS[i % CFG.COLORS.length],
                position: 0,
                score: 0,
                xp: 0,
                frozen: false,
                el: null
            });
        });
    }

    // Set the engine globals
    window.players = enginePlayers;
    players = enginePlayers;
    window.questions = hostQuestions.length > 0 ? hostQuestions : (typeof DEFAULT_Q !== 'undefined' ? [...DEFAULT_Q] : []);
    questions = window.questions;

    // Chaos mode
    const chaosToggle = document.getElementById('host-chaos-toggle');
    window.chaosMode = chaosToggle ? chaosToggle.checked : false;
    chaosMode = window.chaosMode;

    // Switch screens
    document.getElementById('host-lobby').style.display = 'none';
    document.getElementById('game-screen').classList.remove('hidden');

    const badge = document.getElementById('chaos-badge');
    if (badge) badge.classList.toggle('hidden', !chaosMode);

    // Build board using existing engine
    buildBoard();
    createTokens();
    updateLeaderboard();
    if (typeof updateTurnHUD === 'function') updateTurnHUD();

    if (window.sounds) window.sounds.play('start');
    if (typeof centerCameraOnFirstTile === 'function') centerCameraOnFirstTile();

    // Update Firestore state
    const gameRef = Fire.doc(db, 'boardgames', hostGameId);
    await Fire.updateDoc(gameRef, {
        state: GameState.QUESTION, // Will go back to LOBBY-like state; host controls rounds
        currentQuestionIndex: 0
    });

    currentState = GameState.QUESTION;
    updateControlsUI();

    // Start game listener for state sync
    startGameStateListener();

    console.log('[Host] Game started with', enginePlayers.length, 'entities');
};

/* ======= GAME STATE LISTENER ======= */
function startGameStateListener() {
    const gameRef = Fire.doc(db, 'boardgames', hostGameId);
    unsubGame = Fire.onSnapshot(gameRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        currentState = data.state;
        currentRoundId = data.currentRoundId;

        // Sync Chaos Mode global (from app_v3.js)
        if (typeof data.chaosMode !== 'undefined') {
            window.chaosMode = data.chaosMode;
            const badge = document.getElementById('chaos-badge');
            if (badge) {
                if (window.chaosMode) badge.classList.remove('hidden');
                else badge.classList.add('hidden');
            }
        }

        // Update round status badge
        updateControlsUI();
    });
}

/* ======= HOST CONTROLS ======= */

// Start a new round
window.hostStartRound = async function () {
    if (currentQuestionIndex >= hostQuestions.length) {
        currentQuestionIndex = 0; // Loop questions
    }

    const q = hostQuestions[currentQuestionIndex];
    if (!q) {
        alert('No questions available!');
        return;
    }

    roundCounter++;
    const roundId = `round_${roundCounter}_${Date.now()}`;
    currentRoundId = roundId;

    const now = Fire.Timestamp.now();
    const endMs = now.toMillis() + (timerSeconds * 1000);
    const timerEndsAt = Fire.Timestamp.fromMillis(endMs);

    console.log('[Host] Starting round:', roundId, 'Question:', q.question);

    // Create round doc
    const roundRef = Fire.doc(db, 'boardgames', hostGameId, 'rounds', roundId);
    console.log('[Host] Round doc path:', roundRef.path);

    await Fire.setDoc(roundRef, {
        questionId: currentQuestionIndex,
        status: 'open',
        timerEndsAt: timerEndsAt,
        correctOptionIndex: q.correctIndex,
        question: q.question,
        options: q.options,
        isChallenge: false,
        results: null,
        resolvedAt: null,
        resolvedBy: null,
        overrideLog: []
    });

    console.log('[Host] Round doc written');

    // Update game doc with AAA public info
    const gameRef = Fire.doc(db, 'boardgames', hostGameId);
    await Fire.updateDoc(gameRef, {
        state: GameState.QUESTION,
        currentRoundId: roundId,
        currentQuestionIndex: currentQuestionIndex,
        timerEndsAt: timerEndsAt,
        questionPublic: {
            text: q.question,
            id: currentQuestionIndex
        }
    });

    console.log('[Host] Game doc updated with roundId:', roundId);

    currentQuestionIndex++;
    currentState = GameState.QUESTION;
    answeredCount = 0;

    // Show question on host screen
    showHostQuestion(q);

    // Start answer listener
    startAnswerListener(roundId);

    // Start host timer
    startHostTimer(endMs);

    // Update controls
    updateControlsUI();

    console.log('[Host] Round setup complete');
};

// Extend timer
window.hostExtendTimer = async function () {
    if (!currentRoundId || currentState !== GameState.QUESTION) return;

    const gameRef = Fire.doc(db, 'boardgames', hostGameId);
    const gameSnap = await Fire.getDoc(gameRef);
    const gameData = gameSnap.data();

    if (!gameData.timerEndsAt) return;

    const currentEnd = gameData.timerEndsAt.toMillis();
    const newEnd = currentEnd + 10000;
    const newTimerEndsAt = Fire.Timestamp.fromMillis(newEnd);

    await Fire.updateDoc(gameRef, { timerEndsAt: newTimerEndsAt });

    // Update round doc
    const roundRef = Fire.doc(db, 'boardgames', hostGameId, 'rounds', currentRoundId);
    await Fire.updateDoc(roundRef, {
        timerEndsAt: newTimerEndsAt,
        overrideLog: Fire.increment(0) // trigger update; real append below
    });

    // Restart timer locally
    startHostTimer(newEnd);

    // Log override
    logOverride('extend_timer');

    console.log('[Host] Timer extended +10s');
};

// Lock round
window.hostLockRound = async function () {
    if (!currentRoundId) return;

    clearInterval(hostTimerInterval);

    const roundRef = Fire.doc(db, 'boardgames', hostGameId, 'rounds', currentRoundId);
    await Fire.updateDoc(roundRef, { status: 'locked' });

    const gameRef = Fire.doc(db, 'boardgames', hostGameId);
    await Fire.updateDoc(gameRef, { state: GameState.LOCKED });

    currentState = GameState.LOCKED;
    updateControlsUI();
    logOverride('lock_early');

    console.log('[Host] Round locked');
};

// Resolve round (authoritative, via transaction)
window.hostResolveRound = async function () {
    if (!currentRoundId) return;

    try {
        const roundRef = Fire.doc(db, 'boardgames', hostGameId, 'rounds', currentRoundId);
        const gameRef = Fire.doc(db, 'boardgames', hostGameId);

        await Fire.runTransaction(db, async (transaction) => {
            const roundSnap = await transaction.get(roundRef);
            if (!roundSnap.exists()) throw new Error('Round not found');

            const roundData = roundSnap.data();

            // Idempotency: already resolved?
            if (roundData.results) {
                console.log('[Host] Round already resolved, skipping.');
                return;
            }

            // Lock first if not locked
            if (roundData.status === 'open') {
                transaction.update(roundRef, { status: 'locked' });
            }

            // Read all answers
            const answersSnap = await Fire.getDocs(
                Fire.collection(db, 'boardgames', hostGameId, 'rounds', currentRoundId, 'answers')
            );

            const answers = [];
            answersSnap.forEach(doc => answers.push({ uid: doc.id, ...doc.data() }));

            const correctIdx = roundData.correctOptionIndex;
            let results = {};

            if (gameMode === GameMode.TEAMS) {
                results = resolveTeamRound(answers, correctIdx);
            } else {
                results = resolveSoloRound(answers, correctIdx);
            }

            // Write results
            transaction.update(roundRef, {
                status: 'resolved',
                results: results,
                resolvedAt: TS(),
                resolvedBy: 'host'
            });

            transaction.update(gameRef, {
                state: GameState.RESOLVED
            });
        });

        currentState = GameState.RESOLVED;
        updateControlsUI();

        // Close quiz overlay on host
        const overlay = document.getElementById('quiz-overlay');
        const panel = document.getElementById('quiz-panel');
        if (overlay) overlay.classList.add('hidden');
        if (panel) panel.classList.add('panel-hidden');
        clearInterval(hostTimerInterval);

        // Animate winners on the board
        await animateWinners();

        console.log('[Host] Round resolved');

    } catch (err) {
        console.error('[Host] Resolve error:', err);
    }
};

/* ======= RESOLUTION LOGIC ======= */

function resolveSoloRound(answers, correctIdx) {
    const results = { players: {} };

    // Check each answer
    answers.forEach(ans => {
        const isCorrect = ans.optionIndex === correctIdx;
        results.players[ans.uid] = {
            optionIndex: ans.optionIndex,
            isCorrect: isCorrect
        };
    });

    // Also mark players who didn't answer
    Object.keys(connectedPlayers).forEach(uid => {
        if (!results.players[uid]) {
            results.players[uid] = {
                optionIndex: -1,
                isCorrect: false,
                noAnswer: true
            };
        }
    });

    return results;
}

function resolveTeamRound(answers, correctIdx) {
    const results = { teams: {}, players: {} };

    // Group answers by team
    const teamVotes = {}; // teamId -> { counts: {optIndex: count}, members: [] }

    answers.forEach(ans => {
        const teamId = ans.teamId;
        if (!teamId) return;

        if (!teamVotes[teamId]) {
            teamVotes[teamId] = { counts: {}, members: [] };
        }
        const opt = ans.optionIndex;
        teamVotes[teamId].counts[opt] = (teamVotes[teamId].counts[opt] || 0) + 1;
        teamVotes[teamId].members.push(ans);

        results.players[ans.uid] = {
            optionIndex: opt,
            isCorrect: opt === correctIdx
        };
    });

    // Compute majority for each team
    Object.entries(teamVotes).forEach(([teamId, data]) => {
        const counts = data.counts;
        const maxCount = Math.max(...Object.values(counts));
        const topOptions = Object.keys(counts).filter(k => counts[k] === maxCount);

        const isTie = topOptions.length > 1;
        const majorityOption = isTie ? -1 : parseInt(topOptions[0]);
        const isCorrect = !isTie && majorityOption === correctIdx;

        // Also check if correct count == wrong count
        const correctCount = counts[correctIdx] || 0;
        const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
        const wrongCount = totalVotes - correctCount;
        const isEvenSplit = correctCount === wrongCount && correctCount > 0;

        results.teams[teamId] = {
            counts: counts,
            majorityOption: majorityOption,
            isCorrect: isCorrect,
            isTie: isTie || isEvenSplit,
            correctCount: correctCount,
            wrongCount: wrongCount
        };
    });

    // Teams with no votes => no move
    Object.keys(teamsData).forEach(teamId => {
        if (!results.teams[teamId]) {
            results.teams[teamId] = {
                counts: {},
                majorityOption: -1,
                isCorrect: false,
                isTie: false,
                noVotes: true
            };
        }
    });

    return results;
}

/* ======= ANIMATE WINNERS ======= */
async function animateWinners() {
    // Read the round results
    const roundRef = Fire.doc(db, 'boardgames', hostGameId, 'rounds', currentRoundId);
    const roundSnap = await Fire.getDoc(roundRef);
    if (!roundSnap.exists()) return;

    const roundData = roundSnap.data();
    const results = roundData.results || {};

    const gameRef = Fire.doc(db, 'boardgames', hostGameId);
    await Fire.updateDoc(gameRef, { state: GameState.MOVING });
    currentState = GameState.MOVING;
    updateControlsUI();

    if (gameMode === GameMode.TEAMS) {
        // Find winning teams
        const winningTeams = Object.entries(results.teams || {})
            .filter(([_, r]) => r.isCorrect)
            .map(([teamId]) => teamId);

        // Find frozen teams (ties)
        const frozenTeams = Object.entries(results.teams || {})
            .filter(([_, r]) => r.isTie)
            .map(([teamId]) => teamId);

        // Apply frozen flags
        frozenTeams.forEach(teamId => {
            const enginePlayer = players.find(p => p.firestoreTeamId === teamId);
            if (enginePlayer) {
                enginePlayer.frozen = true;
                showFloater(`${enginePlayer.name} is FROZEN (Tie)!`, '#3b82f6');
            }
        });

        // Move winners one at a time
        for (const teamId of winningTeams) {
            const enginePlayer = players.find(p => p.firestoreTeamId === teamId);
            if (enginePlayer && !enginePlayer.frozen) {
                await animateOnePlayerRoll(enginePlayer);
            }
        }

        // Clear frozen for teams that were frozen (they skip THIS turn)
        // Note: frozen flag in engine auto-clears on nextTurn; we just set it above

    } else {
        // Solo: find winning players
        const winningUids = Object.entries(results.players || {})
            .filter(([_, r]) => r.isCorrect)
            .map(([uid]) => uid);

        for (const uid of winningUids) {
            const enginePlayer = players.find(p => p.firestoreUid === uid);
            if (enginePlayer) {
                await animateOnePlayerRoll(enginePlayer);
            }
        }
    }

    // Update leaderboard
    updateLeaderboard();

    // Sync positions back to Firestore
    await syncPositionsToFirestore();

    // Check if anyone won
    const winner = players.find(p => p.position >= CFG.TILES - 1);
    if (winner) {
        await Fire.updateDoc(gameRef, { state: GameState.ENDED });
        showVictory(winner);
        return;
    }

    // Ready for next round
    updateControlsUI();

    // Update HUD
    const nameEl = document.getElementById('hud-player-name');
    if (nameEl) nameEl.textContent = `Round ${roundCounter} Complete`;
}

function animateOnePlayerRoll(enginePlayer) {
    return new Promise((resolve) => {
        // Show dice animation
        const diceOverlay = document.getElementById('dice-overlay');
        diceOverlay.classList.remove('dice-hidden');
        diceOverlay.classList.add('dice-left');

        // Update HUD to show who's rolling
        const nameEl = document.getElementById('hud-player-name');
        if (nameEl) {
            nameEl.textContent = `${enginePlayer.name} rolling...`;
            nameEl.style.color = enginePlayer.color;
        }

        // Roll dice using existing function logic
        const roll = Math.floor(Math.random() * 6) + 1;
        window.currentRoll = roll;

        const faces = {
            1: 'rotateX(0deg) rotateY(0deg)',
            2: 'rotateX(-90deg) rotateY(0deg)',
            3: 'rotateY(90deg)',
            4: 'rotateY(-90deg)',
            5: 'rotateX(90deg)',
            6: 'rotateX(180deg)'
        };

        const cube = document.getElementById('dice-cube');
        cube.classList.add('rolling');
        if (window.sounds) window.sounds.play('roll');

        let hasResolved = false;
        const safetyTimeout = setTimeout(() => {
            if (!hasResolved) {
                console.warn('[Host] Movement safety timeout triggered for', enginePlayer.name);
                hasResolved = true;
                resolve();
            }
        }, 12000); // 12s safety limit

        setTimeout(() => {
            cube.classList.remove('rolling');
            cube.style.transform = faces[roll];

            setTimeout(() => {
                diceOverlay.classList.add('dice-hidden');
                diceOverlay.classList.remove('dice-left');

                // Move using existing movePlayer
                movePlayer(enginePlayer, roll, () => {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(safetyTimeout);
                        setTimeout(resolve, 1500);
                    }
                });
            }, 1200);
        }, 1200);
    });
}

/* ======= SYNC POSITIONS TO FIRESTORE ======= */
async function syncPositionsToFirestore() {
    const batch = Fire.writeBatch(db);

    if (gameMode === GameMode.TEAMS) {
        players.forEach(p => {
            if (p.firestoreTeamId) {
                const teamRef = Fire.doc(db, 'boardgames', hostGameId, 'teams', p.firestoreTeamId);
                batch.update(teamRef, {
                    position: p.position,
                    score: p.score,
                    frozenNextTurn: p.frozen || false
                });
            }
        });
    } else {
        players.forEach(p => {
            if (p.firestoreUid) {
                const playerRef = Fire.doc(db, 'boardgames', hostGameId, 'players', p.firestoreUid);
                batch.update(playerRef, {
                    position: p.position,
                    score: p.score,
                    frozenNextTurn: p.frozen || false
                });
            }
        });
    }

    await batch.commit();
}

/* ======= ANSWER LISTENER ======= */
function startAnswerListener(roundId) {
    if (unsubAnswers) unsubAnswers();

    answeredCount = 0;
    const answersRef = Fire.collection(db, 'boardgames', hostGameId, 'rounds', roundId, 'answers');
    unsubAnswers = Fire.onSnapshot(answersRef, (snap) => {
        answeredCount = snap.size;
        updateParticipationUI();

        // Auto-resolve when everyone answered
        if (answeredCount >= totalPlayers && totalPlayers > 0 && currentState === GameState.QUESTION) {
            console.log('[Host] All players answered. Auto-resolving in 1.5s...');
            setTimeout(() => {
                // Re-check state and count before resolving
                if (answeredCount >= totalPlayers && currentState === GameState.QUESTION) {
                    hostResolveRound();
                }
            }, 1500);
        }
    });
}

/* ======= HOST TIMER ======= */
function startHostTimer(endMs) {
    clearInterval(hostTimerInterval);

    const timerEl = document.getElementById('ctrl-timer');
    const quizTimerText = document.getElementById('quiz-timer-text');
    const quizTimerFill = document.getElementById('quiz-xp-timer-fill');

    hostTimerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endMs - now);
        const seconds = Math.ceil(remaining / 1000);

        if (timerEl) timerEl.textContent = `${seconds}s`;
        if (quizTimerText) quizTimerText.textContent = `${seconds}s`;
        if (quizTimerFill) quizTimerFill.style.width = `${(remaining / (timerSeconds * 1000)) * 100}%`;

        if (remaining <= 0) {
            clearInterval(hostTimerInterval);
            if (timerEl) timerEl.textContent = '⏰ TIME UP';

            // Auto-lock
            autoLockRound();
        }
    }, 200);
}

async function autoLockRound() {
    if (currentState !== GameState.QUESTION) return;

    try {
        const roundRef = Fire.doc(db, 'boardgames', hostGameId, 'rounds', currentRoundId);
        const roundSnap = await Fire.getDoc(roundRef);
        if (roundSnap.exists() && roundSnap.data().status === 'open') {
            await Fire.updateDoc(roundRef, { status: 'locked' });
        }

        const gameRef = Fire.doc(db, 'boardgames', hostGameId);
        await Fire.updateDoc(gameRef, { state: GameState.LOCKED });

        currentState = GameState.LOCKED;
        updateControlsUI();

        console.log('[Host] Auto-locked round');
    } catch (err) {
        console.error('[Host] Auto-lock error:', err);
    }
}

/* ======= SHOW QUESTION ON HOST SCREEN ======= */
function showHostQuestion(q) {
    document.getElementById('quiz-question').textContent = q.question;
    document.getElementById('quiz-diff').textContent = 'MULTIPLAYER ROUND ' + roundCounter;

    const panel = document.getElementById('quiz-panel');
    panel.classList.remove('is-challenge', 'panel-hidden', 'panel-shake');

    const grid = document.getElementById('quiz-options');
    grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; background: rgba(255,255,255,0.05); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1);">
            <div style="font-size: 2rem; margin-bottom: 10px;">📱</div>
            <div style="color: #94a3b8; font-size: 1.1rem;">Options are visible on players' devices</div>
        </div>
    `;

    document.getElementById('quiz-overlay').classList.remove('hidden');
}

/* ======= UI UPDATES ======= */
function updateControlsUI() {
    const statusEl = document.getElementById('ctrl-round-status');
    if (statusEl) {
        statusEl.className = `round-status ${currentState}`;
        statusEl.textContent = currentState.toUpperCase();
    }

    // Button states
    const inQuestion = currentState === GameState.QUESTION;
    const isLocked = currentState === GameState.LOCKED;
    const isResolved = currentState === GameState.RESOLVED;
    const isMoving = currentState === GameState.MOVING;

    const btnStart = document.getElementById('btn-start-round');
    const btnExtend = document.getElementById('btn-extend');
    const btnLock = document.getElementById('btn-lock');
    const btnResolve = document.getElementById('btn-resolve');

    if (btnStart) btnStart.disabled = inQuestion || isLocked || isMoving;
    if (btnExtend) btnExtend.disabled = !inQuestion;
    if (btnLock) btnLock.disabled = !inQuestion;
    if (btnResolve) btnResolve.disabled = !(inQuestion || isLocked);

    updateParticipationUI();
}

function updateParticipationUI() {
    const fill = document.getElementById('ctrl-participation-fill');
    const count = document.getElementById('ctrl-participation-count');

    if (fill && totalPlayers > 0) {
        fill.style.width = `${(answeredCount / totalPlayers) * 100}%`;
    }
    if (count) count.textContent = `${answeredCount}/${totalPlayers}`;
}

/* ======= OVERRIDE LOGGING ======= */
async function logOverride(action) {
    try {
        const roundRef = Fire.doc(db, 'boardgames', hostGameId, 'rounds', currentRoundId);
        const roundSnap = await Fire.getDoc(roundRef);
        if (roundSnap.exists()) {
            const log = roundSnap.data().overrideLog || [];
            log.push({
                action: action,
                hostUid: hostUid,
                timestamp: Date.now()
            });
            await Fire.updateDoc(roundRef, { overrideLog: log });
        }
    } catch (err) {
        console.error('[Host] Log override error:', err);
    }
}

/* ======= OVERRIDE: Prevent app_v3.js from auto-starting turns ======= */
// We need to prevent the existing startGame/nextTurn from running their default flows.
// Since app_v3.js sets up DOMContentLoaded for participant names, we override after load.
window.addEventListener('DOMContentLoaded', () => {
    // Override the startGame function from app_v3.js so it doesn't run
    // We use our own hostStartGame instead
    window._originalStartGame = window.startGame;
    window.startGame = function () {
        console.log('[Host] startGame intercepted — use host controls instead');
    };

    // Override nextTurn to prevent automatic turn flow
    window._originalNextTurn = window.nextTurn;
    window.nextTurn = function () {
        console.log('[Host] nextTurn intercepted — host controls rounds via Firebase');
    };

    // Override answerReady since we don't use the buzzer system
    window._originalAnswerReady = window.answerReady;
    window.answerReady = function () {
        console.log('[Host] answerReady intercepted');
    };

    // Override showQuiz since we show questions via Firebase
    window._originalShowQuiz = window.showQuiz;
    // Keep showQuiz for host display

    console.log('[Host] Engine overrides applied');
});

/* ======= PRESENCE ======= */
document.addEventListener('visibilitychange', () => {
    if (!hostGameId || !hostUid) return;
    const playerRef = Fire.doc(db, 'boardgames', hostGameId, 'players', hostUid);
    Fire.updateDoc(playerRef, {
        connected: !document.hidden,
        lastSeenAt: TS()
    }).catch(() => { });
});

console.log('[Host] Module loaded');
