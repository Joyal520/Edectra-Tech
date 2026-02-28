/**
 * EDTECHRA — KNOWLEDGE QUEST ARENA V2
 * PREMIUM GAME ENGINE
 */

/* ======= CONFIG ======= */
const CFG = {
    TILES: 50,
    BOARD_W: 1200,
    BOARD_H: 620,
    TILE_SIZE: 58,
    PATH_D: 'M 100 80 L 1100 80 Q 1180 80 1180 160 Q 1180 240 1100 240 L 100 240 Q 20 240 20 320 Q 20 400 100 400 L 1100 400 Q 1180 400 1180 480 Q 1180 560 1100 560 L 100 560',
    TIMER: 20,
    COLORS: ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'],
    TYPES: [
        { id: 'normal', icon: '', label: '' },
        { id: 'speed', icon: '⚡', label: 'Boost' },
        { id: 'freeze', icon: '❄️', label: 'Freeze' },
        { id: 'challenge', icon: '🧠', label: 'Trial' },
        { id: 'twist', icon: '🎲', label: 'Twist' },
        { id: 'mystery', icon: '🎁', label: 'Gift' },
        { id: 'power', icon: '🃏', label: 'Power' },
        { id: 'duel', icon: '⚔️', label: 'Duel' }
    ]
};

/* ======= ULTRA-FLEXIBLE QUIZ PARSER ======= */
/* Handles ChatGPT output, EQM/EMS, markdown bold, numbered lists, etc. */
function parseEQM(text) {
    const raw = text.split(/\r?\n/);
    let title = 'Custom Quiz';
    const questions = [];
    let cur = null;

    // Strip markdown bold/italic
    const strip = s => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/_(.+?)_/g, '$1').trim();

    // Detect question line: "Q:", "Q1.", "Question 1:", "1.", "1)", "**1.**" etc.
    const isQuestion = l => {
        const s = strip(l);
        return /^(Q|QUESTION)\s*\d*\s*[:.\-]/i.test(s) || /^\d+\s*[.):\-]\s*\S/.test(s);
    };

    // Detect answer line: "A)","a.","A:","- ", with optional leading *
    const isAnswer = l => {
        const s = strip(l);
        return /^\*?\s*[A-Da-d]\s*[):.\-]\s/i.test(s) || /^\*?\s*-\s+\S/.test(s);
    };

    // Detect if this answer is marked correct
    const isCorrectMarker = (original) => {
        const t = original.trim();
        return /^\*[^*]/.test(t) ||
            /\(correct\)/i.test(t) || /\[correct\]/i.test(t) ||
            /\s\*\s*$/.test(t) || /[^*]\*$/.test(t) ||
            /\u2713|\u2714|\u2611/u.test(t) ||
            /\(answer\)/i.test(t);
    };

    // Extract question text
    const extractQ = l => {
        let s = strip(l);
        s = s.replace(/^(Q|QUESTION)\s*\d*\s*[:.\-]\s*/i, '');
        s = s.replace(/^\d+\s*[):\-]\s*/, '');
        s = s.replace(/^\d+\.\s*/, '');
        return s;
    };

    // Extract answer text
    const extractA = l => {
        let s = strip(l);
        s = s.replace(/^\*?\s*[A-Da-d]\s*[):\.\-]\s*/i, '');
        s = s.replace(/^\*?\s*-\s*/, '');
        s = s.replace(/\(correct\)|\[correct\]|\u2713|\u2714|\u2611|\(answer\)/gi, '');
        s = s.replace(/\s*\*\s*$/, '');
        return s.trim();
    };

    for (const line of raw) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Title detection
        if (/^\*?\*?TITLE\s*:/i.test(strip(trimmed))) {
            title = strip(trimmed.replace(/^\*?\*?TITLE\s*:\s*/i, ''));
            continue;
        }

        if (isQuestion(trimmed)) {
            if (cur && cur.options.length > 0) questions.push(cur);
            cur = { question: extractQ(trimmed), options: [], correctIndex: -1 };
        } else if (isAnswer(trimmed) && cur) {
            const ansText = extractA(trimmed);
            if (ansText && isCorrectMarker(trimmed)) {
                cur.correctIndex = cur.options.length;
            }
            if (ansText) cur.options.push(ansText);
        }
    }
    if (cur && cur.options.length > 0) questions.push(cur);

    // Fallback: if no correct answer marked, default to first option
    questions.forEach(q => { if (q.correctIndex === -1) q.correctIndex = 0; });

    console.log(`[QuizParser] Parsed ${questions.length} questions from "${title}"`);
    return { title, questions };
}

/* ======= GLOBALS ======= */
let gameMode = 'players';
let players = [];
let activeIdx = 0;
let tiles = [];
let questions = [];
let currentRoll = 0;
let timerInterval = null;

/* ======= DEFAULT QUESTIONS ======= */
const DEFAULT_Q = [
    { question: "What does HTML stand for?", options: ["Hyper Trainer Marking Language", "Hyper Text Markup Language", "Hyper Text Marketing Language", "Hyper Text Markup Leveler"], correctIndex: 1 },
    { question: "Which planet is known as the Red Planet?", options: ["Venus", "Jupiter", "Mars", "Saturn"], correctIndex: 2 },
    { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], correctIndex: 2 },
    { question: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "Da Vinci", "Rembrandt"], correctIndex: 2 },
    { question: "What gas do plants absorb from the atmosphere?", options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"], correctIndex: 2 },
    { question: "Which data structure uses FIFO?", options: ["Stack", "Queue", "Tree", "Graph"], correctIndex: 1 },
    { question: "What is the chemical symbol for water?", options: ["O2", "H2O", "CO2", "NaCl"], correctIndex: 1 },
    { question: "How many continents are there?", options: ["5", "6", "7", "8"], correctIndex: 2 },
];

/* ======= START HELPERS ======= */
function setMode(m) {
    gameMode = m;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
}

function copyGPTPrompt() {
    const prompt = `Generate a quiz in this EXACT format:\n\nTITLE: [Topic]\nQ: [Question]\nA: [Wrong answer]\n*A: [Correct answer]\nA: [Wrong answer]\nA: [Wrong answer]\n\nCreate 10 questions.`;
    navigator.clipboard.writeText(prompt);
    alert('Prompt copied!');
}

/* ======= GAME START ======= */
function startGame() {
    // Parse quiz
    const importText = document.getElementById('quiz-import').value.trim();
    if (importText) {
        const parsed = parseEQM(importText);
        if (parsed.questions.length > 0) questions = parsed.questions;
    }
    if (questions.length === 0) questions = [...DEFAULT_Q];

    // Create players
    const count = parseInt(document.getElementById('player-count').value);
    players = [];
    for (let i = 0; i < count; i++) {
        players.push({ id: i, name: `PLAYER ${i + 1}`, color: CFG.COLORS[i], position: 0, score: 0, frozen: false, el: null });
    }

    // Switch screens
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    buildBoard();
    createTokens();
    updateLeaderboard();
    nextTurn();
}

/* ======= BUILD THE BOARD (SVG SNAKE PATH) ======= */
function buildBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    tiles = [];

    // Generate tile type distribution
    const types = [];
    for (let i = 0; i < CFG.TILES; i++) {
        if (i === 0 || i === CFG.TILES - 1) { types.push('normal'); continue; }
        const r = Math.random();
        if (r < 0.12) types.push('speed');
        else if (r < 0.20) types.push('challenge');
        else if (r < 0.28) types.push('twist');
        else if (r < 0.33) types.push('mystery');
        else if (r < 0.38) types.push('freeze');
        else if (r < 0.43) types.push('power');
        else if (r < 0.48) types.push('duel');
        else types.push('normal');
    }

    // ── SVG winding path ──
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${CFG.BOARD_W} ${CFG.BOARD_H}`);
    svg.setAttribute('width', CFG.BOARD_W);
    svg.setAttribute('height', CFG.BOARD_H);
    svg.classList.add('board-svg');

    // Path shadow (offset + blur for depth)
    const shadow = document.createElementNS(NS, 'path');
    shadow.setAttribute('d', CFG.PATH_D);
    shadow.setAttribute('fill', 'none');
    shadow.setAttribute('stroke', 'rgba(0,0,0,0.07)');
    shadow.setAttribute('stroke-width', '80');
    shadow.setAttribute('stroke-linecap', 'round');
    shadow.setAttribute('stroke-linejoin', 'round');
    shadow.setAttribute('transform', 'translate(3,6)');
    shadow.style.filter = 'blur(6px)';
    svg.appendChild(shadow);

    // Main track (wide, soft color)
    const track = document.createElementNS(NS, 'path');
    track.setAttribute('d', CFG.PATH_D);
    track.setAttribute('fill', 'none');
    track.setAttribute('stroke', '#e5e8ef');
    track.setAttribute('stroke-width', '74');
    track.setAttribute('stroke-linecap', 'round');
    track.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(track);

    // Inner track highlight
    const highlight = document.createElementNS(NS, 'path');
    highlight.setAttribute('d', CFG.PATH_D);
    highlight.setAttribute('fill', 'none');
    highlight.setAttribute('stroke', 'rgba(255,255,255,0.6)');
    highlight.setAttribute('stroke-width', '50');
    highlight.setAttribute('stroke-linecap', 'round');
    highlight.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(highlight);

    // Dashed center line
    const dash = document.createElementNS(NS, 'path');
    dash.setAttribute('d', CFG.PATH_D);
    dash.setAttribute('fill', 'none');
    dash.setAttribute('stroke', 'rgba(99,102,241,0.08)');
    dash.setAttribute('stroke-width', '2');
    dash.setAttribute('stroke-dasharray', '10 14');
    dash.setAttribute('stroke-linecap', 'round');
    svg.appendChild(dash);

    // START flag marker
    svg.insertAdjacentHTML('beforeend', `
        <g class="flag-start" transform="translate(70,38)">
            <rect x="0" y="0" width="4" height="50" rx="2" fill="#10b981"/>
            <polygon points="6,2 32,12 6,22" fill="#10b981" opacity="0.85"/>
            <text x="8" y="16" font-size="8" fill="white" font-weight="700" font-family="Outfit,sans-serif">GO</text>
        </g>
    `);
    // FINISH flag marker
    svg.insertAdjacentHTML('beforeend', `
        <g class="flag-finish" transform="translate(70,518)">
            <rect x="0" y="0" width="4" height="50" rx="2" fill="#6366f1"/>
            <polygon points="6,2 32,12 6,22" fill="#6366f1" opacity="0.85"/>
            <text x="7" y="16" font-size="7" fill="white" font-weight="700" font-family="Outfit,sans-serif">FIN</text>
        </g>
    `);

    board.appendChild(svg);

    // ── Calculate tile positions along path ──
    const tempSvg = document.createElementNS(NS, 'svg');
    tempSvg.style.cssText = 'position:absolute;visibility:hidden;width:0;height:0';
    const tempPath = document.createElementNS(NS, 'path');
    tempPath.setAttribute('d', CFG.PATH_D);
    tempSvg.appendChild(tempPath);
    document.body.appendChild(tempSvg);

    const totalLen = tempPath.getTotalLength();
    const half = CFG.TILE_SIZE / 2;

    for (let i = 0; i < CFG.TILES; i++) {
        const dist = (i / (CFG.TILES - 1)) * totalLen;
        const pt = tempPath.getPointAtLength(dist);
        const x = pt.x - half;
        const y = pt.y - half;
        const type = types[i];
        const info = CFG.TYPES.find(t => t.id === type) || CFG.TYPES[0];

        const el = document.createElement('div');
        el.className = `tile tile-${type}`;
        if (i === 0) el.classList.add('tile-start');
        if (i === CFG.TILES - 1) el.classList.add('tile-finish');

        el.style.left = x + 'px';
        el.style.top = y + 'px';

        const num = i === 0 ? 'START' : (i === CFG.TILES - 1 ? '🏁' : (i + 1));
        el.innerHTML = `
            <span class="tile-num">${num}</span>
            <span class="tile-icon">${info.icon}</span>
            ${info.label ? `<span class="tile-label">${info.label}</span>` : ''}
        `;

        board.appendChild(el);
        tiles.push({ type, el, x, y });
    }

    document.body.removeChild(tempSvg);

    // Set board dimensions
    board.style.width = CFG.BOARD_W + 'px';
    board.style.height = CFG.BOARD_H + 'px';

    fitBoard();
    window.addEventListener('resize', fitBoard);
}

function fitBoard() {
    const area = document.getElementById('board-area');
    const scaler = document.getElementById('board-scaler');
    const aw = area.clientWidth - 60;
    const ah = area.clientHeight - 40;
    const scale = Math.min(aw / CFG.BOARD_W, ah / CFG.BOARD_H, 1.5);
    scaler.style.transform = `scale(${scale})`;
}

/* ======= TOKENS ======= */
function createTokens() {
    const board = document.getElementById('board');
    players.forEach((p, i) => {
        const el = document.createElement('div');
        el.className = 'token';
        el.style.background = p.color;
        el.textContent = i + 1;
        board.appendChild(el);
        p.el = el;
        positionToken(p);
    });
}

function positionToken(p) {
    const t = tiles[p.position];
    if (!t) return;
    // Center token on tile, with slight stagger for multi-player
    const half = CFG.TILE_SIZE / 2;
    const offset = (p.id - (players.length - 1) / 2) * 8;
    p.el.style.left = (t.x + half - 18 + offset) + 'px';
    p.el.style.top = (t.y + half - 18) + 'px';
}

/* ======= TURN FLOW ======= */
function nextTurn() {
    const p = players[activeIdx];
    document.getElementById('hud-player-name').textContent = p.name;
    document.getElementById('hud-player-name').style.color = p.color;

    if (p.frozen) {
        p.frozen = false;
        if (p.shielded) {
            p.shielded = false;
            showFloater('🛡️ Shield blocked the freeze!', p.color);
            setTimeout(() => {
                document.getElementById('dice-overlay').classList.remove('dice-hidden');
                document.getElementById('btn-roll').disabled = false;
            }, 1200);
            return;
        }
        showFloater('❄️ Frozen! Skip turn.', p.color);
        setTimeout(() => { activeIdx = (activeIdx + 1) % players.length; nextTurn(); }, 1200);
        return;
    }

    // Show dice
    document.getElementById('dice-overlay').classList.remove('dice-hidden');
    document.getElementById('btn-roll').disabled = false;
}

/* ======= DICE ======= */
function rollDice() {
    document.getElementById('btn-roll').disabled = true;
    if (window.sounds) window.sounds.play('roll');

    const roll = Math.floor(Math.random() * 6) + 1;
    currentRoll = roll;

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

    setTimeout(() => {
        cube.classList.remove('rolling');
        cube.style.transform = faces[roll];

        setTimeout(() => {
            document.getElementById('dice-overlay').classList.add('dice-hidden');
            showQuiz();
        }, 700);
    }, 1200);
}

/* ======= QUIZ ======= */
function showQuiz() {
    const p = players[activeIdx];
    const q = questions[Math.floor(Math.random() * questions.length)];
    const panel = document.getElementById('quiz-panel');

    // Toggle Challenge UI
    panel.classList.toggle('is-challenge', !!p.challengeMode);

    document.getElementById('quiz-question').textContent = q.question;
    document.getElementById('quiz-moves').textContent = `+${currentRoll} MOVES`;

    const grid = document.getElementById('quiz-options');
    grid.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(i, q.correctIndex, btn);
        grid.appendChild(btn);
    });

    document.getElementById('quiz-panel').classList.remove('panel-hidden');
    startTimer();
}

function startTimer() {
    const p = players[activeIdx];
    const baseTimer = p.challengeMode ? 10 : CFG.TIMER; // 10s for challenge mode
    let left = baseTimer;

    const fill = document.getElementById('quiz-timer-fill');
    const hud = document.getElementById('hud-timer');
    fill.style.width = '100%';
    hud.textContent = left;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        left--;
        hud.textContent = left;
        fill.style.width = `${(left / baseTimer) * 100}%`;
        if (left <= 0) {
            clearInterval(timerInterval);
            handleAnswer(-1, 0, null);
        }
    }, 1000);
}

function handleAnswer(idx, correct, btn) {
    clearInterval(timerInterval);
    const ok = idx === correct;

    // Disable all & highlight
    document.querySelectorAll('.opt-btn').forEach((b, i) => {
        b.style.pointerEvents = 'none';
        if (i === correct) {
            b.classList.add('correct');
            b.classList.add('answer-pop');
        } else if (b === btn && !ok) {
            b.classList.add('wrong');
            b.classList.add('answer-shake');
        }
    });

    if (window.sounds) window.sounds.play(ok ? 'correct' : 'wrong');

    const p = players[activeIdx];
    if (ok) {
        if (p.challengeMode) {
            p.score += 20; // Extra bonus for challenge
            p.challengeMode = false;
        } else {
            p.score += 10;
        }
        spawnMiniConfetti(btn); // confetti burst on the correct button
    } else if (btn) {
        p.challengeMode = false;
        // Shake the entire quiz panel on wrong
        document.getElementById('quiz-panel').classList.add('panel-shake');
        setTimeout(() => document.getElementById('quiz-panel').classList.remove('panel-shake'), 500);
    }
    updateLeaderboard();

    setTimeout(() => {
        document.getElementById('quiz-panel').classList.add('panel-hidden');
        if (ok) {
            movePlayer(p, currentRoll);
        } else {
            endTurn();
        }
    }, 1800);
}

/* Mini confetti burst on correct answer */
function spawnMiniConfetti(anchorEl) {
    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];
    for (let i = 0; i < 30; i++) {
        const dot = document.createElement('div');
        const angle = (Math.PI * 2 * i) / 30;
        const dist = 60 + Math.random() * 100;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        dot.style.cssText = `
            position: fixed; left: ${cx}px; top: ${cy}px;
            width: ${4 + Math.random() * 6}px; height: ${4 + Math.random() * 6}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none; z-index: 9999;
            transition: all 0.7s cubic-bezier(0.22, 1, 0.36, 1);
            opacity: 1;
        `;
        document.body.appendChild(dot);
        requestAnimationFrame(() => {
            dot.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`;
            dot.style.opacity = '0';
        });
        setTimeout(() => dot.remove(), 800);
    }
}

/* ======= MOVEMENT WITH CAMERA ZOOM ======= */
function movePlayer(p, steps) {
    let remaining = steps;
    const scaler = document.getElementById('board-scaler');

    // Zoom camera in at start of movement
    zoomToTile(p.position);

    const step = () => {
        if (remaining > 0 && p.position < CFG.TILES - 1) {
            p.position++;
            remaining--;
            if (window.sounds) window.sounds.play('move');
            positionToken(p);

            // Token bounce
            p.el.classList.add('token-hop');
            setTimeout(() => p.el.classList.remove('token-hop'), 400);

            // Sparkle trail on tile
            spawnTrailSpark(tiles[p.position]);

            // Highlight active tile
            tiles.forEach(t => t.el.classList.remove('tile-active'));
            tiles[p.position].el.classList.add('tile-active');

            // Track camera to token
            zoomToTile(p.position);

            setTimeout(step, 550);
        } else {
            // Zoom back out
            setTimeout(() => resetZoom(), 400);

            // Check win
            if (p.position >= CFG.TILES - 1) {
                showVictory(p);
                return;
            }
            checkTileEffect(p);
        }
    };
    step();
}

/* Camera zoom helpers */
function zoomToTile(tileIdx) {
    const tile = tiles[tileIdx];
    if (!tile) return;
    const scaler = document.getElementById('board-scaler');
    const half = CFG.TILE_SIZE / 2;

    // Calculate center offset
    const cx = tile.x + half;
    const cy = tile.y + half;
    const zoomScale = 1.8;

    // Translate so tile is centered, then scale
    const tx = (CFG.BOARD_W / 2 - cx);
    const ty = (CFG.BOARD_H / 2 - cy);

    scaler.style.transition = 'transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)';
    scaler.style.transform = `scale(${zoomScale}) translate(${tx}px, ${ty}px)`;
}

function resetZoom() {
    const scaler = document.getElementById('board-scaler');
    scaler.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
    fitBoard();
}

function checkTileEffect(p) {
    const tile = tiles[p.position];
    switch (tile.type) {
        case 'speed':
            showTileEvent('speed', p, () => movePlayer(p, 2));
            break;
        case 'freeze':
            showTileEvent('freeze', p, () => { p.frozen = true; endTurn(); });
            break;
        case 'challenge':
            showTileEvent('challenge', p, () => {
                // Harder question: current player moves +4 if correct
                p.challengeMode = true;
                currentRoll = 4; // Bonus moves
                showQuiz();
            });
            break;
        case 'twist': {
            showTileEvent('twist', p, () => {
                const twistEffects = [
                    {
                        name: 'Swap!', fn: () => {
                            const others = players.filter(x => x.id !== p.id);
                            if (others.length) {
                                const other = others[Math.floor(Math.random() * others.length)];
                                const tmp = p.position; p.position = other.position; other.position = tmp;
                                positionToken(p); positionToken(other);
                            }
                        }
                    },
                    {
                        name: 'Reverse!', fn: () => {
                            const back = Math.min(p.position, 3);
                            p.position -= back;
                            positionToken(p);
                        }
                    },
                    {
                        name: 'Everyone back!', fn: () => {
                            players.forEach(pl => {
                                const back = Math.min(pl.position, 2);
                                pl.position -= back;
                                positionToken(pl);
                            });
                        }
                    },
                    {
                        name: 'Double move!', fn: () => {
                            if (p.position + 3 < CFG.TILES) {
                                p.position += 3;
                                positionToken(p);
                            }
                        }
                    }
                ];
                const chosen = twistEffects[Math.floor(Math.random() * twistEffects.length)];
                showFloater('🎲 ' + chosen.name, '#f59e0b');

                // Allow delay for movement to be visible
                setTimeout(() => {
                    chosen.fn();
                    setTimeout(() => endTurn(), 1200);
                }, 800);
            });
            break;
        }
        case 'mystery': {
            const bonus = [5, 10, 15, 20, -5, -10][Math.floor(Math.random() * 6)];
            showTileEvent('mystery', p, () => {
                showFloater(`${bonus > 0 ? '+' : ''}${bonus} points!`, '#ec4899');
                p.score += bonus;
                updateLeaderboard();
                endTurn();
            });
            break;
        }
        case 'power': {
            showTileEvent('power', p, () => {
                const powers = [
                    { name: '🛡️ Shield', icon: '🛡️', sub: 'Skip next freeze!', fn: () => { p.shielded = true; } },
                    { name: '⭐ Bonus Pts', icon: '⭐', sub: '+40 bonus points!', fn: () => { p.score += 40; updateLeaderboard(); } },
                    { name: '🎯 Extra Roll', icon: '🎯', sub: 'Move +3 tiles!', fn: () => { movePlayer(p, 3); return true; } }
                ];
                const card = powers[Math.floor(Math.random() * powers.length)];

                showPowerCardUI(card, () => {
                    const skipEndTurn = card.fn();
                    if (!skipEndTurn) endTurn();
                });
            });
            break;
        }
        case 'duel': {
            showTileEvent('duel', p, () => {
                const others = players.filter(x => x.id !== p.id);
                if (others.length === 0) { endTurn(); return; }
                const opponent = others[Math.floor(Math.random() * others.length)];
                showFloater(`⚔️ ${p.name} vs ${opponent.name}!`, '#ef4444');
                // Simplified duel: current player wins points
                const won = Math.random() > 0.4; // 60% chance current player wins
                setTimeout(() => {
                    if (won) {
                        p.score += 15;
                        showFloater(`${p.name} wins the duel! +15 pts`, p.color);
                    } else {
                        opponent.score += 15;
                        showFloater(`${opponent.name} wins the duel! +15 pts`, opponent.color);
                    }
                    updateLeaderboard();
                    endTurn();
                }, 1200);
            });
            break;
        }
        default:
            endTurn();
    }
}

function endTurn() {
    tiles.forEach(t => t.el.classList.remove('tile-active'));
    activeIdx = (activeIdx + 1) % players.length;
    setTimeout(nextTurn, 600);
}

/* ======= TILE EVENT ORCHESTRATOR ======= */
/* showTileEvent: anticipation delay → camera → sound → popup → callback */
const TILE_EVENT_CONFIG = {
    speed: { icon: '⚡', title: 'SPEED BOOST!', sub: 'Dash forward +2 tiles!', color: '#10b981', sound: 'speed', fx: 'fx-flash-yellow', camera: 'zoomForward' },
    freeze: { icon: '❄️', title: 'FROZEN!', sub: 'You skip your next turn!', color: '#3b82f6', sound: 'freeze', fx: 'fx-flash-blue', camera: 'zoomOut' },
    challenge: { icon: '🧠', title: 'CHALLENGE MODE!', sub: 'Bonus +20 points!', color: '#8b5cf6', sound: 'challenge', fx: 'fx-flash-purple', camera: 'snapFocus' },
    twist: { icon: '🎲', title: 'TWIST EVENT!', sub: 'Something unexpected!', color: '#f59e0b', sound: 'twist', fx: 'fx-flash-yellow', camera: 'shake' },
    mystery: { icon: '🎁', title: 'MYSTERY REVEALED!', sub: 'A hidden effect awaits!', color: '#ec4899', sound: 'mystery', fx: 'fx-flash-pink', camera: 'softZoom' },
    power: { icon: '🃏', title: 'POWER CARD!', sub: 'A random power is yours!', color: '#22c55e', sound: 'power', fx: 'fx-flash-green', camera: 'softZoom' },
    duel: { icon: '⚔️', title: 'DUEL TIME!', sub: 'Two players compete!', color: '#ef4444', sound: 'duel', fx: 'fx-flash-red', camera: 'shake' }
};

function showTileEvent(type, player, callback) {
    const cfg = TILE_EVENT_CONFIG[type];
    if (!cfg) { callback(); return; }

    // 1. Anticipation pause (500ms)
    setTimeout(() => {
        // 2. Screen flash effect
        triggerScreenFx(cfg.fx);

        // 3. Camera reaction
        triggerCameraForTile(cfg.camera, player);

        // 4. Play tile-specific sound
        if (window.sounds) window.sounds.play(cfg.sound);

        // 5. Show popup (with glow), then callback after dismiss + 700ms pause
        showTilePopup(cfg.icon, cfg.title, cfg.sub, cfg.color, () => {
            // 6. Post-action pause for dramatic feel
            setTimeout(() => {
                if (callback) callback();
            }, 700);
        });
    }, 500);
}

/* ======= SCREEN FLASH EFFECTS ======= */
function triggerScreenFx(fxClass) {
    const el = document.getElementById('screen-fx');
    if (!el) return;
    // Reset any active effect
    el.className = '';
    void el.offsetWidth; // force reflow
    el.classList.add(fxClass);
    // Clean up after animation
    setTimeout(() => { el.className = ''; }, 1000);
}

/* ======= CAMERA REACTIONS PER TILE ======= */
function triggerCameraForTile(cameraType, player) {
    const scaler = document.getElementById('board-scaler');
    if (!scaler) return;

    switch (cameraType) {
        case 'zoomForward': {
            // Quick forward zoom on speed boost
            const tile = tiles[player.position];
            if (tile) zoomToTile(player.position);
            setTimeout(() => resetZoom(), 1200);
            break;
        }
        case 'zoomOut': {
            // Slow zoom out for freeze
            scaler.style.transition = 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
            scaler.style.transform = 'scale(0.85)';
            setTimeout(() => resetZoom(), 1500);
            break;
        }
        case 'snapFocus': {
            // Snap focus on player for challenge
            zoomToTile(player.position);
            setTimeout(() => resetZoom(), 1600);
            break;
        }
        case 'shake': {
            // Quick screen shake for twist/duel
            const gameScreen = document.getElementById('game-screen');
            if (gameScreen) {
                gameScreen.classList.add('screen-shake');
                setTimeout(() => gameScreen.classList.remove('screen-shake'), 500);
            }
            break;
        }
        case 'softZoom': {
            // Soft gentle zoom for mystery/power
            const tile = tiles[player.position];
            if (tile) {
                const half = CFG.TILE_SIZE / 2;
                const cx = tile.x + half;
                const cy = tile.y + half;
                const tx = (CFG.BOARD_W / 2 - cx);
                const ty = (CFG.BOARD_H / 2 - cy);
                scaler.style.transition = 'transform 0.7s cubic-bezier(0.4, 0, 0.2, 1)';
                scaler.style.transform = `scale(1.4) translate(${tx * 0.5}px, ${ty * 0.5}px)`;
            }
            setTimeout(() => resetZoom(), 1500);
            break;
        }
    }
}

/* ======= FULL-SCREEN TILE EFFECT POPUP ======= */
function showTilePopup(icon, title, subtitle, color, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'tile-popup-overlay';
    overlay.innerHTML = `
        <div class="tile-popup-card popup-glow">
            <div class="tile-popup-icon" style="background: ${color}20; color: ${color}">${icon}</div>
            <h1 class="tile-popup-title" style="color: ${color}">${title}</h1>
            <p class="tile-popup-sub">${subtitle}</p>
            <div class="tile-popup-bar" style="background: ${color}"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    // Auto-dismiss after 1.2s (V2 requirement)
    setTimeout(() => {
        overlay.classList.add('popup-exit');
        setTimeout(() => {
            overlay.remove();
            if (callback) callback();
        }, 300);
    }, 1200);
}

/* ======= POWER CARD UI REVEAL ======= */
function showPowerCardUI(card, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'power-card-overlay';
    overlay.innerHTML = `
        <div class="card-container">
            <div class="card-inner" id="card-inner">
                <div class="card-front">
                    <div class="card-icon">🎰</div>
                    <div class="card-title">POWER UP</div>
                    <div class="card-desc">Reveal your reward...</div>
                </div>
                <div class="card-back">
                    <div class="card-icon">${card.icon}</div>
                    <div class="card-title">${card.name}</div>
                    <div class="card-desc">${card.sub}</div>
                </div>
            </div>
        </div>
        <button class="btn-start" style="width: 200px" id="btn-collect">COLLECT</button>
    `;
    document.body.appendChild(overlay);

    const inner = document.getElementById('card-inner');
    const btn = document.getElementById('btn-collect');

    // Flip card after brief delay
    setTimeout(() => {
        inner.classList.add('flipped');
        if (window.sounds) window.sounds.play('power');
    }, 600);

    btn.onclick = () => {
        overlay.classList.add('popup-exit');
        setTimeout(() => {
            overlay.remove();
            if (callback) callback();
        }, 400);
    };
}

/* Sparkle trail during movement */
function spawnTrailSpark(tile) {
    if (!tile || !tile.el) return;
    for (let i = 0; i < 5; i++) {
        const spark = document.createElement('div');
        spark.className = 'trail-spark';
        spark.style.left = (Math.random() * 50 + 10) + 'px';
        spark.style.top = (Math.random() * 50 + 10) + 'px';
        spark.style.animationDelay = (Math.random() * 0.2) + 's';
        tile.el.appendChild(spark);
        setTimeout(() => spark.remove(), 700);
    }
}

/* ======= LEADERBOARD ======= */
function updateLeaderboard() {
    const lb = document.getElementById('leaderboard');
    lb.innerHTML = '';
    [...players].sort((a, b) => b.score - a.score).forEach(p => {
        const pill = document.createElement('div');
        pill.className = 'lb-pill';
        pill.innerHTML = `
            <span class="lb-dot" style="background:${p.color}"></span>
            <span class="lb-name">${p.name}</span>
            <span class="lb-score">${p.score} pts</span>
        `;
        lb.appendChild(pill);
    });
}

/* ======= FLOATER NOTIFICATIONS ======= */
function showFloater(text, color) {
    const f = document.createElement('div');
    f.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; color: ${color || 'var(--text)'};
        padding: 16px 32px; border-radius: 16px;
        font-family: var(--font); font-weight: 700; font-size: 1.1rem;
        box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: floaterAnim 1.5s forwards;
    `;
    f.textContent = text;
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1500);
}

// Inject floater animation
const style = document.createElement('style');
style.textContent = `@keyframes floaterAnim { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); } 20% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; transform: translate(-50%, -60%) scale(1); } 100% { opacity: 0; transform: translate(-50%, -80%) scale(0.9); } }`;
document.head.appendChild(style);

/* ======= VICTORY ======= */
function showVictory(p) {
    if (window.sounds) window.sounds.play('win');
    document.getElementById('winner-name').textContent = p.name;
    document.getElementById('winner-name').style.color = p.color;
    document.getElementById('victory-screen').classList.remove('hidden');

    // Confetti
    const container = document.getElementById('confetti');
    container.innerHTML = '';
    for (let i = 0; i < 60; i++) {
        const c = document.createElement('div');
        const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
        c.style.cssText = `
            position: absolute;
            width: ${6 + Math.random() * 8}px; height: ${6 + Math.random() * 8}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            left: ${Math.random() * 100}%;
            top: -10px;
            animation: confettiFall ${1.5 + Math.random() * 2}s forwards;
            animation-delay: ${Math.random() * 0.5}s;
        `;
        container.appendChild(c);
    }
}

// Inject confetti animation
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
.confetti-container { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
@keyframes confettiFall { 0% { transform: translateY(0) rotate(0deg); opacity: 1; } 100% { transform: translateY(500px) rotate(720deg); opacity: 0; } }
`;
document.head.appendChild(confettiStyle);
