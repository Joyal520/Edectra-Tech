/**
 * EDTECHRA — Board Game Player Client
 * Mobile-first player controller for multiplayer board game
 */

import { db, auth, ensureAnonAuth, GameState, GameMode, Fire, TS } from './firebase-board.js';

/* ======= STATE ======= */
let gameId = null;
let myUid = null;
let myName = '';
let myTeamId = null;
let currentGameState = null;
let currentRoundId = null;
let hasSubmitted = false;
let timerInterval = null;
let timerEndsAt = null;
let unsubGame = null;
let unsubRound = null;

/* ======= SCREENS ======= */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');

    // Show status bar during game
    const sb = document.getElementById('status-bar');
    if (['screen-question', 'screen-result', 'screen-lobby'].includes(id) && gameId) {
        sb.classList.remove('hidden');
    } else {
        sb.classList.add('hidden');
    }
}

function showError(msg) {
    document.getElementById('join-error').textContent = msg;
}

/* ======= JOIN FLOW ======= */
window.checkPin = async function () {
    const codeInput = document.getElementById('input-code');
    const code = codeInput.value.trim().toUpperCase();

    if (code.length !== 6) { showError('Enter a 6-character game code'); return; }

    const btn = document.getElementById('btn-check-pin');
    btn.disabled = true;
    btn.textContent = '🔍 Checking...';
    showError('');

    try {
        const gamesRef = Fire.collection(db, 'boardgames');
        const q = Fire.query(gamesRef, Fire.where('joinCode', '==', code), Fire.limit(1));
        const snap = await Fire.getDocs(q);

        if (snap.empty) {
            showError('Game not found. Check the code.');
            btn.disabled = false;
            btn.textContent = '🔍 FIND GAME';
            return;
        }

        const gameDoc = snap.docs[0];
        gameId = gameDoc.id;
        const gameData = gameDoc.data();

        if (gameData.state !== GameState.LOBBY) {
            showError('Game already started. Cannot join.');
            btn.disabled = false;
            btn.textContent = '🔍 FIND GAME';
            return;
        }

        // Success - show next step
        document.getElementById('join-step-pin').classList.add('hidden');
        document.getElementById('join-step-details').classList.remove('hidden');
        document.getElementById('sb-code').textContent = code;

        if (gameData.mode === GameMode.TEAMS) {
            document.getElementById('join-teams-area').classList.remove('hidden');
            loadTeams();
        } else {
            document.getElementById('join-teams-area').classList.add('hidden');
        }

    } catch (err) {
        console.error('Check PIN error:', err);
        showError('Error checking PIN. Try again.');
        btn.disabled = false;
        btn.textContent = '🔍 FIND GAME';
    }
};

window.resetJoin = function () {
    gameId = null;
    document.getElementById('join-step-details').classList.add('hidden');
    document.getElementById('join-step-pin').classList.remove('hidden');
    document.getElementById('btn-check-pin').disabled = false;
    document.getElementById('btn-check-pin').textContent = '🔍 FIND GAME';
};

async function loadTeams() {
    const list = document.getElementById('input-teams-list');
    list.innerHTML = '<div style="color:#94a3b8; font-size: 0.8rem;">Loading teams...</div>';

    const teamsRef = Fire.collection(db, 'boardgames', gameId, 'teams');
    const snap = await Fire.getDocs(teamsRef);

    list.innerHTML = '';
    snap.forEach(doc => {
        const team = doc.data();
        const div = document.createElement('div');
        div.className = 'join-team-item';
        div.innerHTML = `
            <span class="team-dot" style="background: ${team.color}"></span>
            <span class="team-name-text">${team.name}</span>
        `;
        div.onclick = () => {
            document.querySelectorAll('.join-team-item').forEach(i => i.classList.remove('selected'));
            div.classList.add('selected');
            myTeamId = doc.id;
        };
        list.appendChild(div);
    });
}

window.joinGame = async function () {
    const nameInput = document.getElementById('input-name');
    const name = nameInput.value.trim();

    if (!name || name.length < 1) { showDetailsError('Enter your name'); return; }

    // If team mode, MUST pick a team
    const teamsArea = document.getElementById('join-teams-area');
    if (!teamsArea.classList.contains('hidden') && !myTeamId) {
        showDetailsError('Please pick a team');
        return;
    }

    const btn = document.getElementById('btn-join');
    btn.disabled = true;
    btn.textContent = '🚀 Joining...';
    showDetailsError('');

    try {
        const user = await ensureAnonAuth();
        myUid = user.uid;
        myName = name.toUpperCase();

        // Write player doc
        const playerRef = Fire.doc(db, 'boardgames', gameId, 'players', myUid);
        await Fire.setDoc(playerRef, {
            displayName: myName,
            role: 'player',
            teamId: myTeamId || null,
            connected: true,
            lastSeenAt: TS(),
            score: 0,
            position: 0,
            frozenNextTurn: false
        });

        // If team, increment count
        if (myTeamId) {
            const teamRef = Fire.doc(db, 'boardgames', gameId, 'teams', myTeamId);
            await Fire.updateDoc(teamRef, { membersCount: Fire.increment(1) });
        }

        document.getElementById('sb-name').textContent = myName;
        showScreen('screen-lobby');
        startGameListener();

    } catch (err) {
        console.error('Join error:', err);
        showDetailsError('Failed to join. Try again.');
        btn.disabled = false;
        btn.textContent = '🚀 JOIN GAME';
    }
};

function showDetailsError(msg) {
    document.getElementById('join-error-details').textContent = msg;
}

/* ======= TEAM SELECT ======= */
let selectedTeamId = null;

function showTeamSelect(gameData) {
    const grid = document.getElementById('teams-grid');
    grid.innerHTML = '';
    selectedTeamId = null;

    // Listen for teams
    const teamsRef = Fire.collection(db, 'boardgames', gameId, 'teams');
    Fire.getDocs(teamsRef).then(snap => {
        snap.forEach(doc => {
            const team = doc.data();
            const card = document.createElement('div');
            card.className = 'team-card';
            card.innerHTML = `
                <div class="team-emoji">🏆</div>
                <div class="team-name">${team.name}</div>
                <div class="team-count">${team.membersCount || 0} members</div>
            `;
            card.style.borderColor = team.color;
            card.onclick = () => {
                document.querySelectorAll('.team-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedTeamId = doc.id;
                document.getElementById('btn-team-confirm').disabled = false;
            };
            grid.appendChild(card);
        });
    });

    showScreen('screen-teams');
}

window.confirmTeam = async function () {
    if (!selectedTeamId) return;
    myTeamId = selectedTeamId;

    // Update player doc with team
    const playerRef = Fire.doc(db, 'boardgames', gameId, 'players', myUid);
    await Fire.updateDoc(playerRef, { teamId: myTeamId });

    // Increment team member count
    const teamRef = Fire.doc(db, 'boardgames', gameId, 'teams', myTeamId);
    await Fire.updateDoc(teamRef, { membersCount: Fire.increment(1) });

    showScreen('screen-lobby');
    startGameListener();
};

/* ======= GAME STATE LISTENER ======= */
function startGameListener() {
    if (unsubGame) unsubGame();

    const gameRef = Fire.doc(db, 'boardgames', gameId);
    unsubGame = Fire.onSnapshot(gameRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        const prevState = currentGameState;
        currentGameState = data.state;

        console.log(`[Player] Game state: ${prevState} → ${currentGameState}`);

        switch (currentGameState) {
            case GameState.LOBBY:
                showScreen('screen-lobby');
                break;

            case GameState.QUESTION:
                if (data.currentRoundId !== currentRoundId) {
                    currentRoundId = data.currentRoundId;
                    hasSubmitted = false;
                    loadQuestion(data);
                }
                showScreen('screen-question');
                break;

            case GameState.LOCKED:
                clearInterval(timerInterval);
                disableAllButtons();
                // Stay on question screen but show locked
                document.getElementById('q-timer').textContent = '🔒 LOCKED';
                break;

            case GameState.RESOLVED:
            case GameState.MOVING:
                showRoundResult(data);
                break;

            case GameState.ENDED:
                showGameOver();
                break;
        }
    });

    // Presence: update on visibility change
    document.addEventListener('visibilitychange', () => {
        if (!gameId || !myUid) return;
        const playerRef = Fire.doc(db, 'boardgames', gameId, 'players', myUid);
        Fire.updateDoc(playerRef, {
            connected: !document.hidden,
            lastSeenAt: TS()
        }).catch(() => { });
    });
}

/* ======= QUESTION DISPLAY ======= */
function loadQuestion(gameData) {
    // Listen for the round doc to get the question
    if (unsubRound) unsubRound();

    const roundRef = Fire.doc(db, 'boardgames', gameId, 'rounds', currentRoundId);
    unsubRound = Fire.onSnapshot(roundRef, (snap) => {
        if (!snap.exists()) return;
        const round = snap.data();

        if (round.status === 'locked' || round.status === 'resolved') {
            clearInterval(timerInterval);
            disableAllButtons();
            if (round.status === 'resolved') {
                showRoundResult(gameData);
            }
            return;
        }

        // Display question (AAA: fetch public text if private is hidden)
        const qText = round.question || (gameData.questionPublic ? gameData.questionPublic.text : 'Question loading...');
        document.getElementById('q-text').textContent = qText;
        document.getElementById('q-badge').textContent = round.isChallenge ? '🔥 HARD CHALLENGE' : 'QUESTION';

        // Display options
        const grid = document.getElementById('q-answers');
        grid.innerHTML = '';
        const options = round.options || [];
        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'answer-btn';
            btn.innerHTML = `<span class="opt-prefix">${String.fromCharCode(65 + i)}</span> ${opt}`;
            btn.onclick = () => submitAnswer(i, btn);
            if (hasSubmitted) btn.disabled = true;
            grid.appendChild(btn);
        });

        // Timer
        if (round.timerEndsAt) {
            startClientTimer(round.timerEndsAt);
        }
    });

    // Hide submitted badge
    document.getElementById('submitted-badge').classList.add('hidden');
    showScreen('screen-question');
}

/* ======= ANSWER SUBMISSION ======= */
async function submitAnswer(optionIndex, btnEl) {
    if (hasSubmitted) return;
    hasSubmitted = true;

    // Highlight selected button and disable all
    document.querySelectorAll('.answer-btn').forEach(b => {
        b.disabled = true;
        if (b === btnEl) b.classList.add('selected');
    });

    // Show submitted badge
    document.getElementById('submitted-badge').classList.remove('hidden');

    try {
        const answerRef = Fire.doc(db, 'boardgames', gameId, 'rounds', currentRoundId, 'answers', myUid);
        await Fire.setDoc(answerRef, {
            uid: myUid,
            teamId: myTeamId || null,
            optionIndex: optionIndex,
            submittedAt: TS()
        });
        console.log('[Player] Answer submitted:', optionIndex);
    } catch (err) {
        console.error('Submit error:', err);
        // Could fail if already submitted (security rules)
    }
}

function disableAllButtons() {
    document.querySelectorAll('.answer-btn').forEach(b => b.disabled = true);
}

/* ======= CLIENT TIMER ======= */
function startClientTimer(endsAt) {
    clearInterval(timerInterval);

    const endMs = endsAt.toMillis ? endsAt.toMillis() : (endsAt.seconds * 1000);
    const totalMs = 20000; // Default, will approximate
    const fill = document.getElementById('q-timer-fill');
    const text = document.getElementById('q-timer');

    timerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = Math.max(0, endMs - now);
        const seconds = Math.ceil(remaining / 1000);

        text.textContent = `${seconds}s`;
        const pct = (remaining / totalMs) * 100;
        fill.style.width = `${Math.min(100, pct)}%`;

        if (remaining <= 5000) {
            fill.classList.add('danger');
            text.classList.add('danger');
        } else {
            fill.classList.remove('danger');
            text.classList.remove('danger');
        }

        if (remaining <= 0) {
            clearInterval(timerInterval);
            text.textContent = '⏰ TIME UP';
            fill.style.width = '0%';
            disableAllButtons();
        }
    }, 200);
}

/* ======= ROUND RESULT ======= */
function showRoundResult(gameData) {
    showScreen('screen-result');

    // Read round results
    const roundRef = Fire.doc(db, 'boardgames', gameId, 'rounds', currentRoundId);
    Fire.getDoc(roundRef).then(snap => {
        if (!snap.exists()) return;
        const round = snap.data();
        const results = round.results || {};

        if (gameData.mode === GameMode.TEAMS && myTeamId) {
            // Team result
            const teamResult = results.teams ? results.teams[myTeamId] : null;
            if (teamResult) {
                if (teamResult.isTie) {
                    setResult('❄️', 'Tie! Frozen', 'Your team had a split vote. Skipping next turn.', 'frozen');
                } else if (teamResult.isCorrect) {
                    setResult('🎉', 'Your Team Won!', 'Moving forward on the board!', 'win');
                } else {
                    setResult('😔', 'Wrong Answer', 'Your team\'s majority voted incorrectly.', 'lose');
                }
            } else {
                setResult('⏳', 'Processing...', 'Waiting for results.', '');
            }
        } else {
            // Solo result
            const soloResult = results.players ? results.players[myUid] : null;
            if (soloResult) {
                if (soloResult.isCorrect) {
                    setResult('🎉', 'Correct!', 'You\'re moving forward!', 'win');
                } else {
                    setResult('😔', 'Wrong!', 'Better luck next round.', 'lose');
                }
            } else {
                // Didn't answer
                setResult('⏰', 'No Answer', 'You didn\'t submit in time.', 'lose');
            }
        }
    });
}

function setResult(icon, title, sub, badgeType) {
    document.getElementById('result-icon').textContent = icon;
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-sub').textContent = sub;
    const badge = document.getElementById('result-badge');
    badge.className = `result-badge ${badgeType}`;
    badge.textContent = badgeType === 'win' ? 'ADVANCING' : badgeType === 'frozen' ? 'FROZEN' : 'NO MOVE';
}

/* ======= GAME OVER ======= */
async function showGameOver() {
    // Get final player data
    try {
        const playerRef = Fire.doc(db, 'boardgames', gameId, 'players', myUid);
        const pSnap = await Fire.getDoc(playerRef);
        if (pSnap.exists()) {
            const p = pSnap.data();
            document.getElementById('go-score').textContent = `Score: ${p.score || 0}`;
        }

        // Get all players to determine rank
        const playersRef = Fire.collection(db, 'boardgames', gameId, 'players');
        const allSnap = await Fire.getDocs(Fire.query(playersRef, Fire.orderBy('score', 'desc')));
        let rank = 1;
        allSnap.forEach(doc => {
            if (doc.id === myUid) {
                document.getElementById('go-rank').textContent = `#${rank}`;
            }
            rank++;
        });
    } catch (err) {
        console.error('Game over error:', err);
    }

    showScreen('screen-gameover');
}

/* ======= INIT ======= */
// Auto-focus code input
document.getElementById('input-code').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});

// Check URL for game code
const urlParams = new URLSearchParams(window.location.search);
const codeFromUrl = urlParams.get('code');
if (codeFromUrl) {
    document.getElementById('input-code').value = codeFromUrl.toUpperCase();
}

console.log('[Player] Client ready.');
