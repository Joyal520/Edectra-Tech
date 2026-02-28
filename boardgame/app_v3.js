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
    PATH_D: 'M 80 120 C 250 20 400 220 550 120 C 700 20 950 20 1050 150 C 1150 300 950 320 800 280 C 600 220 400 380 250 320 C 50 240 50 480 200 520 C 400 580 550 420 750 500 C 900 560 1050 450 1120 540',
    TIMER: 20,
    COLORS: ['#2B8CEE', '#8B5CF6', '#22C55E', '#EAB308', '#EF4444', '#D946EF'],
    MAX_ACTIONS_PER_TURN: 2,
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
let currentPlayerIndex = -1;
let tiles = [];
let questions = [];
let currentRoll = 0;
let timerInterval = null;
let isChallengeMode = false;
let currentTurnDepth = 0;
const MAX_TURN_DEPTH = 2;
let chaosMode = false;
let actionsThisTurn = 0;

/* ======= HARD QUESTIONS ======= */
const HARD_Q = [
    { question: "Which protocol is used to secure data transfer over the web?", options: ["HTTP", "HTTPS", "FTP", "SMTP"], correctIndex: 1 },
    { question: "What is the time complexity of searching in a balanced BST?", options: ["O(n)", "O(1)", "O(log n)", "O(n^2)"], correctIndex: 2 },
    { question: "Which CPU component performs mathematical calculations?", options: ["CU", "Registers", "ALU", "Cache"], correctIndex: 2 },
    { question: "Which sorting algorithm has the best average time complexity?", options: ["Bubble Sort", "Insertion Sort", "Quick Sort", "Selection Sort"], correctIndex: 2 },
    { question: "What is the binary representation of the decimal number 10?", options: ["1001", "1010", "1100", "1111"], correctIndex: 1 },
    { question: "Which OSI layer is responsible for routing?", options: ["Physical", "Data Link", "Network", "Transport"], correctIndex: 2 },
    { question: "What is the primary key in a database?", options: ["Unique identifier", "Duplicate value", "Foreign key", "Null value"], correctIndex: 0 },
    { question: "Which tag is used to create a hyperlink in HTML?", options: ["<link>", "<a>", "<href>", "<url>"], correctIndex: 1 },
    { question: "In Python, which keyword is used to define a function?", options: ["func", "define", "def", "function"], correctIndex: 2 },
    { question: "What does 'SOLID' stand for in software engineering?", options: ["Stability", "Object-Oriented Design", "Standardization", "Selection"], correctIndex: 1 },
    { question: "Which gate returns true only if both inputs are true?", options: ["OR", "XOR", "NAND", "AND"], correctIndex: 3 },
    { question: "What is the default port for HTTP?", options: ["21", "25", "80", "443"], correctIndex: 2 },
    { question: "Which language is used for styling web pages?", options: ["HTML", "XML", "CSS", "JSON"], correctIndex: 2 },
    { question: "What is the maximum value of an 8-bit unsigned integer?", options: ["127", "128", "255", "256"], correctIndex: 2 },
    { question: "Which company developed the JavaScript language?", options: ["Microsoft", "Oracle", "Nestcape", "Google"], correctIndex: 2 },
    { question: "What is the role of a DNS server?", options: ["Secure connections", "Translate domains to IP", "Store files", "Email delivery"], correctIndex: 1 },
    { question: "Which keyword is used to handle exceptions in JS?", options: ["catch", "error", "except", "def"], correctIndex: 0 },
    { question: "What is the purpose of Git 'rebase'?", options: ["Combine branches", "Delete history", "Rewrite history", "Download changes"], correctIndex: 2 },
    { question: "Which device connects multiple networks and routes packets?", options: ["Switch", "Hub", "Router", "Bridge"], correctIndex: 2 },
    { question: "What does SQL stand for?", options: ["Simple Query Language", "Structured Query Language", "Solid Query Lambda", "System Query Link"], correctIndex: 1 }
];

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

/* ======= START HELPERS & CONTROLS ======= */
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.log(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
        document.exitFullscreen();
    }
}

function setMode(m) {
    gameMode = m;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    updateParticipantNames(); // Refresh names when mode changes
}

function updateCountLabel(val) {
    document.getElementById('player-count-label').textContent = val;
    updateParticipantNames();
}

function updateParticipantNames() {
    const container = document.getElementById('participant-names');
    const count = parseInt(document.getElementById('player-count').value);
    const mode = gameMode; // 'players' or 'teams'

    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const group = document.createElement('div');
        group.className = 'name-input-group';

        const placeholder = mode === 'teams' ? `Team ${i + 1}` : `Player ${i + 1}`;
        const icon = mode === 'teams' ? '🏆' : '👤';

        group.innerHTML = `
            <span class="name-icon">${icon}</span>
            <input type="text" class="participant-name-input" data-index="${i}" 
                   placeholder="${placeholder}" value="${placeholder}">
        `;
        container.appendChild(group);
    }
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

    // Create players with custom names
    const count = parseInt(document.getElementById('player-count').value);
    const nameInputs = document.querySelectorAll('.participant-name-input');
    players = [];
    for (let i = 0; i < count; i++) {
        const inputName = nameInputs[i] ? nameInputs[i].value.trim() : `Member ${i + 1}`;
        players.push({
            id: i,
            name: inputName.toUpperCase(),
            color: CFG.COLORS[i % CFG.COLORS.length],
            position: 0,
            score: 0,
            xp: 0, // NEW XP Tracker
            frozen: false,
            el: null
        });
    }

    // Switch screens
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // Chaos Mode Toggle
    chaosMode = document.getElementById('chaos-mode-toggle').checked;
    const badge = document.getElementById('chaos-badge');
    if (badge) badge.classList.toggle('hidden', !chaosMode);

    buildBoard();
    createTokens();
    updateLeaderboard();
    updateTurnHUD(); // NEW: Centralized XP HUD Init

    if (window.sounds) window.sounds.play('start');

    if (typeof centerCameraOnFirstTile === 'function') {
        centerCameraOnFirstTile();
    }

    // Explicitly show the ready bar for Player 1 on game start
    const readyBar = document.getElementById('ready-bar');
    if (readyBar) {
        readyBar.classList.remove('hidden');
    }

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

    // Gradient Definitions
    svg.insertAdjacentHTML('afterbegin', `
        <defs>
            <linearGradient id="grad-start" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="grad-finish" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:1" />
            </linearGradient>
        </defs>
    `);

    // Map Scenery (Ponds go beneath path)
    const sceneryBg = document.createElementNS(NS, 'g');
    sceneryBg.insertAdjacentHTML('beforeend', `
        <ellipse cx="250" cy="160" rx="80" ry="40" fill="#bae6fd" opacity="0.8"/>
        <ellipse cx="950" cy="480" rx="100" ry="50" fill="#bae6fd" opacity="0.8"/>
    `);
    svg.appendChild(sceneryBg);

    // Path shadow (offset + blur for depth)
    const shadow = document.createElementNS(NS, 'path');
    shadow.setAttribute('d', CFG.PATH_D);
    shadow.setAttribute('fill', 'none');
    shadow.setAttribute('stroke', 'rgba(0,0,0,0.07)');
    shadow.setAttribute('stroke-width', '110');
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
    track.setAttribute('stroke-width', '104');
    track.setAttribute('stroke-linecap', 'round');
    track.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(track);

    // Inner track highlight
    const highlight = document.createElementNS(NS, 'path');
    highlight.setAttribute('d', CFG.PATH_D);
    highlight.setAttribute('fill', 'none');
    highlight.setAttribute('stroke', 'rgba(255,255,255,0.6)');
    highlight.setAttribute('stroke-width', '76');
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

    // Map Scenery (Trees go OVER the track)
    const sceneryFg = document.createElementNS(NS, 'g');

    // Add some simple vector trees
    const treeTypes = [
        '<circle r="15" fill="#34d399"/><circle cy="-10" r="12" fill="#10b981"/><rect x="-3" y="10" width="6" height="15" fill="#78350f" rx="3"/>',
        '<polygon points="0,-25 -15,10 15,10" fill="#047857"/><polygon points="0,-10 -20,20 20,20" fill="#064e3b"/><rect x="-4" y="20" width="8" height="10" fill="#713f12" rx="2"/>'
    ];

    const treePositions = [
        { x: 180, y: 150 }, { x: 230, y: 120 }, { x: 350, y: 200 }, { x: 500, y: 120 },
        { x: 800, y: 140 }, { x: 850, y: 220 }, { x: 920, y: 130 }, { x: 150, y: 400 },
        { x: 280, y: 420 }, { x: 350, y: 500 }, { x: 600, y: 380 }, { x: 750, y: 460 },
        { x: 820, y: 350 }, { x: 950, y: 510 }, { x: 1050, y: 420 }
    ];

    treePositions.forEach(pos => {
        const type = treeTypes[Math.floor(Math.random() * treeTypes.length)];
        const animDelay = (Math.random() * 2).toFixed(2);
        sceneryFg.insertAdjacentHTML('beforeend', `<g class="swaying-tree" style="animation-delay: -${animDelay}s; transform-origin: 0px 20px" transform="translate(${pos.x},${pos.y})">${type}</g>`);
    });
    svg.appendChild(sceneryFg);

    // START flag marker
    svg.insertAdjacentHTML('beforeend', `
        <g class="flag-start waving-flag" transform="translate(55,30)">
            <rect x="0" y="0" width="4" height="65" rx="2" fill="#064e3b" stroke="white" stroke-width="1"/>
            <path d="M 4,2 L 50,18 L 4,34 Z" fill="url(#grad-start)" stroke="white" stroke-width="1.5"/>
            <text x="12" y="24" font-size="12" fill="white" font-weight="900" font-family="Outfit,sans-serif">START</text>
        </g>
    `);
    // FINISH flag marker
    svg.insertAdjacentHTML('beforeend', `
        <g class="flag-finish waving-flag" transform="translate(60,490)">
            <rect x="0" y="0" width="4" height="65" rx="2" fill="#312e81" stroke="white" stroke-width="1"/>
            <path d="M 4,2 L 50,18 L 4,34 Z" fill="url(#grad-finish)" stroke="white" stroke-width="1.5"/>
            <text x="12" y="24" font-size="11" fill="white" font-weight="900" font-family="Outfit,sans-serif">FINISH</text>
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
    const half = 45; // 90px / 2

    for (let i = 0; i < CFG.TILES; i++) {
        const dist = (i / (CFG.TILES - 1)) * totalLen;
        const pt = tempPath.getPointAtLength(dist);
        const x = pt.x - half;
        const y = pt.y - half;
        const isStart = (i === 0);
        const isFinish = (i === CFG.TILES - 1);
        const type = types[i];
        const info = CFG.TYPES.find(t => t.id === type) || CFG.TYPES[0];

        const el = document.createElement('div');
        el.className = `tile tile-${type}`;
        if (isStart) el.classList.add('tile-start');
        if (isFinish) el.classList.add('tile-finish');

        el.style.left = x + 'px';
        el.style.top = y + 'px';

        const num = (isStart || isFinish) ? '' : (i + 1);
        const mainIcon = isStart ? '🚀' : (isFinish ? '🏆' : info.icon);
        const mainLabel = isStart ? 'START' : (isFinish ? 'FINISH' : info.label);

        el.innerHTML = `
            ${num ? `<span class="tile-num">${num}</span>` : ''}
            <span class="tile-icon">${mainIcon}</span>
            <span class="tile-label">${mainLabel}</span>
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
    const aw = area.clientWidth - 160; // Extra margin for edge tiles
    const ah = area.clientHeight - 80;
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

let movingPlayersQueue = [];

/* ======= ROUND FLOW ======= */
function nextTurn() {
    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
    const p = players[currentPlayerIndex];

    currentTurnDepth = 0; // Reset for new player turn
    actionsThisTurn = 0; // Reset chaos action guard

    updateTurnHUD(); // NEW: Centralized HUD Refresh

    // Show the Ready Prompt before the question
    updateReadyStatusList();
    const readyBar = document.getElementById('ready-bar');
    if (readyBar) readyBar.classList.remove('hidden');

    if (p.frozen) {
        showFloater(`${p.name} is thawing out!`, '#3b82f6');
        p.frozen = false;
        setTimeout(() => {
            readyBar.classList.add('hidden');
            nextTurn();
        }, 2000);
    }
}

function updateReadyStatusList(readyPlayerId = null) {
    const p = players[currentPlayerIndex];
    if (!p) return;

    const stripe = document.getElementById('ready-stripe');
    if (stripe) stripe.style.backgroundColor = p.color;

    const badge = document.getElementById('ready-status-list');
    if (badge) badge.textContent = `${p.name}'s Turn`;

    const title = document.getElementById('ready-title');
    if (title) title.textContent = `Ready, ${p.name}?`;
}

function answerReady(isReady) {
    const p = players[currentPlayerIndex];
    if (isReady) {
        updateReadyStatusList(p.id);
        setTimeout(() => {
            document.getElementById('ready-bar').classList.add('hidden');
            showQuiz();
        }, 800);
    } else {
        showFloater('Waiting...', '#64748B');
        updateReadyStatusList(null);
    }
}

/* ======= DICE ======= */
function rollDice() {
    // Hide old generic roll btn
    const btnOld = document.getElementById('btn-roll');
    if (btnOld) btnOld.style.display = 'none';

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
            const diceOverlay = document.getElementById('dice-overlay');
            diceOverlay.classList.add('dice-hidden');
            diceOverlay.classList.remove('dice-left');

            // Move strictly the current player
            movePlayer(players[currentPlayerIndex], currentRoll, () => {
                setTimeout(nextTurn, 2000); // Wait 2s before next player
            });
        }, 1200);
    }, 1200);
}

/* ======= QUIZ ======= */
function showQuiz(isChallenge = false) {
    isChallengeMode = isChallenge;
    const pool = isChallengeMode ? HARD_Q : questions;
    const q = pool[Math.floor(Math.random() * pool.length)];
    const panel = document.getElementById('quiz-panel');
    const overlay = document.getElementById('quiz-overlay');

    document.getElementById('quiz-question').textContent = q.question;
    document.getElementById('quiz-diff').textContent = isChallengeMode ? "🔥 HARD CHALLENGE" : "STANDARD QUESTION";

    if (isChallengeMode) {
        panel.classList.add('is-challenge');
    } else {
        panel.classList.remove('is-challenge');
    }

    const grid = document.getElementById('quiz-options');
    grid.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `<span class="opt-prefix">${String.fromCharCode(65 + i)}</span> <span class="opt-text">${opt}</span>`;

        // Buttons are clickable to lock in the answer
        btn.onclick = () => {
            forceReveal(i === q.correctIndex, btn);
        };

        if (i === q.correctIndex) {
            btn.dataset.correct = "true";
        }
        grid.appendChild(btn);
    });

    overlay.classList.remove('hidden');
    panel.classList.remove('panel-hidden');

    startTimer();
}

function startTimer() {
    let left = CFG.TIMER;
    const fill = document.getElementById('quiz-xp-timer-fill');
    if (fill) fill.style.width = '100%';

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        left--;
        if (fill) fill.style.width = `${(left / CFG.TIMER) * 100}%`;
        const timerText = document.getElementById('quiz-timer-text');
        if (timerText) timerText.textContent = `${left}s`;
        if (left <= 0) {
            clearInterval(timerInterval);
            forceReveal(false, null);
        }
    }, 1000);
}

function forceReveal(clickedCorrect = false, clickedBtn = null) {
    clearInterval(timerInterval);

    document.querySelectorAll('.opt-btn').forEach(b => {
        b.onclick = null; // Lock answers
        if (b.dataset.correct === "true") {
            b.classList.add('correct');
            b.classList.add('answer-pop');
        } else {
            b.classList.add('wrong');
            b.style.opacity = '0.5';
        }
    });

    if (clickedBtn && clickedCorrect) {
        if (window.sounds) window.sounds.play('correct');
        spawnMiniConfetti(clickedBtn);
        spawnFullConfetti(); // Full-screen celebration

        const p = players[currentPlayerIndex];
        const gain = isChallengeMode ? 40 : 25; // XP per correct answer
        addXP(p, gain);

        showFloater(isChallengeMode ? "CHALLENGE PASSED!" : "Correct!", "#22C55E");

        setTimeout(() => {
            document.getElementById('quiz-overlay').classList.add('hidden');
            document.getElementById('quiz-panel').classList.add('panel-hidden');

            const diceOverlay = document.getElementById('dice-overlay');
            diceOverlay.classList.remove('dice-hidden');
            diceOverlay.classList.add('dice-left');

            rollDice();
        }, 2000);

    } else if (clickedBtn && !clickedCorrect) {
        if (window.sounds) window.sounds.play('wrong');
        document.getElementById('quiz-panel').classList.add('panel-shake');

        setTimeout(() => {
            showFloater(isChallengeMode ? "CHALLENGE FAILED!" : "Try again next time!", "#EF4444");
            document.getElementById('quiz-overlay').classList.add('hidden');
            document.getElementById('quiz-panel').classList.add('panel-hidden');

            if (isChallengeMode) {
                const p = players[currentPlayerIndex];
                const penalty = chaosMode ? 2 : 1;
                const ptsDeduction = chaosMode ? 10 : 0; // Chaos Penalty
                p.position = Math.max(0, p.position - penalty);
                p.score = Math.max(0, p.score - ptsDeduction);
                positionToken(p);
                updateLeaderboard();
            }
            setTimeout(nextTurn, 2000);
        }, 1500);

    } else {
        if (window.sounds) window.sounds.play('wrong');
        setTimeout(() => {
            document.getElementById('quiz-overlay').classList.add('hidden');
            document.getElementById('quiz-panel').classList.add('panel-hidden');
            showFloater("Time's Up!", "#EF4444");
            if (isChallengeMode) {
                const p = players[currentPlayerIndex];
                const penalty = chaosMode ? 2 : 1;
                const ptsDeduction = chaosMode ? 10 : 0;
                p.position = Math.max(0, p.position - penalty);
                p.score = Math.max(0, p.score - ptsDeduction);
                positionToken(p);
                updateLeaderboard();
            }
            setTimeout(nextTurn, 2000);
        }, 1500);
    }
}


/* Mini confetti burst on correct answer — ENHANCED */
function spawnMiniConfetti(anchorEl) {
    const rect = anchorEl ? anchorEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#fbbf24', '#22c55e', '#ef4444'];
    const count = 60;
    for (let i = 0; i < count; i++) {
        const dot = document.createElement('div');
        const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.3);
        const dist = 80 + Math.random() * 180;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 40; // bias upward
        const size = 4 + Math.random() * 8;
        dot.style.cssText = `
            position: fixed; left: ${cx}px; top: ${cy}px;
            width: ${size}px; height: ${size}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
            pointer-events: none; z-index: 9999;
            transition: all 0.9s cubic-bezier(0.22, 1, 0.36, 1);
            opacity: 1;
        `;
        document.body.appendChild(dot);
        requestAnimationFrame(() => {
            dot.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720}deg)`;
            dot.style.opacity = '0';
        });
        setTimeout(() => dot.remove(), 1000);
    }
}

/* === FULL SCREEN CONFETTI BLAST FOR CELEBRATIONS === */
function spawnFullConfetti() {
    const colors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#fbbf24', '#22c55e'];
    for (let i = 0; i < 100; i++) {
        const dot = document.createElement('div');
        const x = Math.random() * window.innerWidth;
        const size = 5 + Math.random() * 10;
        const delay = Math.random() * 500;
        dot.style.cssText = `
            position: fixed; left: ${x}px; top: -20px;
            width: ${size}px; height: ${size}px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: ${Math.random() > 0.4 ? '50%' : '2px'};
            pointer-events: none; z-index: 9999;
            transition: all ${1.5 + Math.random()}s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            opacity: 1;
        `;
        document.body.appendChild(dot);
        setTimeout(() => {
            dot.style.transform = `translateY(${window.innerHeight + 100}px) rotate(${Math.random() * 720}deg)`;
            dot.style.opacity = '0.3';
        }, delay);
        setTimeout(() => dot.remove(), 2500);
    }
}

/* ======= MOVEMENT WITH CAMERA ZOOM ======= */
function movePlayer(p, steps, onComplete) {
    let remaining = steps;
    const scaler = document.getElementById('board-scaler');

    addXP(p, 10);
    updateLeaderboard();

    // Zoom camera in at start of movement
    zoomToTile(p.position);

    const step = () => {
        if (remaining > 0 && p.position < CFG.TILES - 1) {
            p.position++;
            remaining--;
            if (window.sounds) window.sounds.play('move'); // Additive movement tick
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
            checkTileEffect(p, onComplete);
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

function checkTileEffect(p, onComplete) {
    currentTurnDepth++;
    if (currentTurnDepth > MAX_TURN_DEPTH) {
        console.log("[RecursionGuard] Max depth reached. Stopping chain.");
        if (onComplete) onComplete();
        return;
    }

    const tile = tiles[p.position];

    // Normal tile — show level advance popup
    if (tile.type === 'normal' && p.position > 0 && p.position < CFG.TILES - 1) {
        showLevelAdvancePopup(p, tile, onComplete);
        return;
    }

    switch (tile.type) {
        case 'speed':
            showTileEvent('speed', p, () => {
                if (chaosMode && canTakeChaosAction()) {
                    showChoiceOverlay('Gamble Boost?', [
                        { id: 'safe', label: 'Safe (+2)', icon: '🛡️' },
                        { id: 'gamble', label: 'Gamble (1-4)', icon: '🎲' }
                    ], (choice) => {
                        const steps = choice === 'safe' ? 2 : Math.floor(Math.random() * 4) + 1;
                        showFloater(`Boost: +${steps}!`, '#10b981');
                        movePlayer(p, steps, onComplete);
                    });
                } else {
                    movePlayer(p, 2, onComplete);
                }
            });
            break;
        case 'freeze':
            showTileEvent('freeze', p, () => {
                if (chaosMode) {
                    const rivals = players.filter(x => x.id !== p.id);
                    if (rivals.length > 0) {
                        showChoiceOverlay('Choose Target to Freeze!', rivals.map(r => ({
                            id: r.id,
                            label: r.name,
                            icon: '❄️',
                            color: r.color
                        })), (targetId) => {
                            const victim = players.find(x => x.id === targetId);
                            if (victim.shielded) {
                                victim.shielded = false;
                                showFloater(`Shield blocked freeze for ${victim.name}!`, '#2B8CEE');
                            } else {
                                victim.frozen = true;
                                showFloater(`${victim.name} is FROZEN!`, '#3b82f6');
                            }
                            if (onComplete) onComplete();
                        });
                    } else {
                        p.frozen = true;
                        if (onComplete) onComplete();
                    }
                } else {
                    p.frozen = true;
                    if (onComplete) onComplete();
                }
            });
            break;
        case 'challenge':
            showTileEvent('challenge', p, () => {
                showQuiz(true); // Trigger HARD QUESTION
            });
            break;
        case 'twist': {
            showTileEvent('twist', p, () => {
                const pool = [
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
                            p.position = Math.max(0, p.position - 3);
                            positionToken(p);
                        }
                    },
                    {
                        name: 'Everyone back!', fn: () => {
                            players.forEach(pl => {
                                pl.position = Math.max(0, pl.position - 2);
                                positionToken(pl);
                            });
                        }
                    },
                    {
                        name: 'Double move!', fn: () => {
                            p.position = Math.min(CFG.TILES - 1, p.position + 3);
                            positionToken(p);
                        }
                    }
                ];

                if (chaosMode) {
                    pool.push(
                        {
                            name: 'Meteor Strike!', fn: () => {
                                players.forEach(pl => {
                                    if (pl.id !== p.id) {
                                        pl.position = Math.max(0, pl.position - 1);
                                        positionToken(pl);
                                    }
                                });
                            }
                        },
                        {
                            name: 'Teleport!', fn: () => {
                                const jump = Math.floor(Math.random() * 6) + 1;
                                p.position = Math.min(CFG.TILES - 1, p.position + jump);
                                positionToken(p);
                            }
                        }
                    );
                }

                const chosen = pool[Math.floor(Math.random() * pool.length)];
                showFloater('🎲 ' + chosen.name, '#f59e0b');
                setTimeout(() => {
                    if (chaosMode && (chosen.name.includes('Teleport') || chosen.name.includes('move'))) {
                        if (!canTakeChaosAction()) {
                            if (onComplete) onComplete();
                            return;
                        }
                    }
                    chosen.fn();
                    if (onComplete) onComplete();
                }, 800);
            });
            break;
        }
        case 'mystery': {
            showTileEvent('mystery', p, () => {
                if (chaosMode && canTakeChaosAction()) {
                    const boxes = [
                        { id: 0, label: 'Box 1', icon: '🎁' },
                        { id: 1, label: 'Box 2', icon: '🎁' },
                        { id: 2, label: 'Box 3', icon: '🎁' },
                        { id: 3, label: 'Box 4', icon: '🎁' }
                    ];
                    showChoiceOverlay('Pick a Chaos Box!', boxes, () => {
                        handleChaosMystery(p, onComplete);
                    });
                } else {
                    const r = Math.random();
                    if (r < 0.5) {
                        const pts = (Math.floor(Math.random() * 3) + 1) * 10;
                        addXP(p, pts);
                        showFloater(`Lucky! +${pts} pts`, p.color);
                    } else {
                        const pts = (Math.floor(Math.random() * 2) + 1) * 10;
                        p.score = Math.max(0, p.score - pts);
                        showFloater(`Ouch! -${pts} pts`, '#6b7280');
                    }
                    updateLeaderboard();
                    if (onComplete) onComplete();
                }
            });
            break;
        }
        case 'power': {
            showTileEvent('power', p, () => {
                const powers = [
                    { name: '🛡️ Shield', icon: '🛡️', sub: 'Skip next freeze!', fn: () => { p.shielded = true; } },
                    { name: '⭐ Bonus Pts', icon: '⭐', sub: '+40 bonus points!', fn: () => { addXP(p, 40); } },
                    { name: '🎯 Extra Roll', icon: '🎯', sub: 'Move +3 tiles!', fn: () => { movePlayer(p, 3, onComplete); return true; } }
                ];
                const card = powers[Math.floor(Math.random() * powers.length)];

                showPowerCardUI(card, () => {
                    const skipEndTurn = card.fn();
                    if (!skipEndTurn && onComplete) onComplete();
                });
            });
            break;
        }
        case 'duel': {
            showTileEvent('duel', p, () => {
                const others = players.filter(x => x.id !== p.id);
                if (others.length === 0) { if (onComplete) onComplete(); return; }
                const opponent = others[Math.floor(Math.random() * others.length)];

                if (chaosMode && canTakeChaosAction()) {
                    handleChaosDuel(p, opponent, onComplete);
                } else {
                    showFloater(`⚔️ ${p.name} vs ${opponent.name}!`, '#ef4444');
                    const won = Math.random() > 0.4;
                    setTimeout(() => {
                        if (won) {
                            addXP(p, 15);
                            showFloater(`${p.name} wins! +15 pts`, p.color);
                        } else {
                            addXP(opponent, 15);
                            showFloater(`${opponent.name} wins! +15 pts`, opponent.color);
                        }
                        updateLeaderboard();
                        if (onComplete) onComplete();
                    }, 1200);
                }
            });
            break;
        }
        default:
            if (onComplete) onComplete();
    }
}

// Deprecated in V3 logic, keeping as placeholder 
function endTurn() {
    nextTurn();
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

    // 0. Trigger 3D Icon Pop on the board!
    const landedTile = tiles[player.position];
    if (landedTile && landedTile.el) {
        const iconEl = landedTile.el.querySelector('.tile-icon');
        if (iconEl) {
            iconEl.classList.add('icon-land-pop');
            setTimeout(() => iconEl.classList.remove('icon-land-pop'), 1600); // match animation duration
        }
    }

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
/* ======= LOBBY PLAYER LIST (Start Screen) ======= */
function updateLobbyPlayerList() {
    const list = document.getElementById('player-list');
    if (!list) return;
    list.innerHTML = '';
    players.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.style.background = `rgba(${hexToRgb(p.color)}, 0.1)`;
        div.style.border = `1px solid rgba(${hexToRgb(p.color)}, 0.2)`;
        div.innerHTML = `
            <div class="player-avatar" style="background: ${p.color}">${p.name[0]}</div>
            <span style="font-weight: 700; color: #1e293b">${p.name}</span>
            <button onclick="removePlayer(${i})" style="margin-left:auto; background:none; border:none; cursor:pointer; opacity: 0.5">✕</button>
        `;
        list.appendChild(div);
    });
}

/* ======= LEADERBOARD (In-Game) ======= */
function updateLeaderboard() {
    const lb = document.getElementById('leaderboard');
    if (!lb) return;
    lb.innerHTML = '';
    [...players].sort((a, b) => b.score - a.score).forEach((p, idx) => {
        const card = document.createElement('div');
        card.className = 'leaderboard-card';
        card.innerHTML = `
            <div class="lb-rank">${idx + 1}</div>
            <div class="lb-avatar" style="background-color: ${p.color}; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">
                ${p.name[0]}
            </div>
            <div class="lb-details">
                <span class="lb-name">${p.name}</span>
                <span class="lb-score">${p.score} <span style="font-size:0.75em; opacity:0.7;">pts</span></span>
            </div>
        `;
        lb.appendChild(card);
    });
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
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

function canTakeChaosAction() {
    if (!chaosMode) return true;
    if (actionsThisTurn < CFG.MAX_ACTIONS_PER_TURN) {
        actionsThisTurn++;
        return true;
    }
    showFloater("Chaos Limit Reached!", "#6b7280");
    return false;
}

/* ======= CHAOS HELPERS ======= */
function showChoiceOverlay(title, choices, onSelect) {
    const overlay = document.getElementById('choice-overlay');
    const header = document.getElementById('choice-title');
    const grid = document.getElementById('choice-grid');

    header.textContent = title;
    grid.innerHTML = '';

    choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        if (c.color) btn.style.borderColor = c.color;
        btn.innerHTML = `
            <span class="choice-icon">${c.icon}</span>
            <span class="choice-label">${c.label}</span>
        `;
        btn.onclick = () => {
            overlay.classList.add('hidden');
            onSelect(c.id);
        };
        grid.appendChild(btn);
    });

    overlay.classList.remove('hidden');
}

function handleChaosMystery(p, onComplete) {
    const outcomes = [
        { name: 'Jackpot!', icon: '💰', sub: '+25 pts!', fn: () => { p.score += 25; }, weight: 1 },
        { name: 'Rocket!', icon: '🚀', sub: 'Move +3 tiles!', fn: () => { movePlayer(p, 3, () => { }); return true; }, weight: 1 },
        {
            name: 'Thief!', icon: '🥷', sub: 'Steal 10 from leader!', fn: () => {
                const sorted = [...players].sort((a, b) => b.score - a.score);
                const leader = sorted[0];
                if (leader && leader.id !== p.id) {
                    const steal = Math.min(leader.score, 10);
                    leader.score -= steal;
                    p.score += steal;
                }
            }, weight: 1
        },
        { name: 'Shield!', icon: '🛡️', sub: 'Blocks next freeze!', fn: () => { p.shielded = true; }, weight: 1 },
        { name: 'Nudge', icon: '🤏', sub: '+10 pts', fn: () => { p.score += 10; }, weight: 2 },
        { name: 'Step', icon: '🚶', sub: 'Move +1', fn: () => { movePlayer(p, 1, () => { }); return true; }, weight: 2 },
        { name: 'Reroll?', icon: '🎲', sub: 'One extra roll!', fn: () => { rollDice(); return true; }, weight: 1 },
        { name: 'Zapped!', icon: '⚡', sub: '-15 pts!', fn: () => { p.score = Math.max(0, p.score - 15); }, weight: 1 },
        { name: 'Slid...', icon: '⛸️', sub: 'Move back 2!', fn: () => { p.position = Math.max(0, p.position - 2); positionToken(p); }, weight: 1 },
        { name: 'Snowed In', icon: '❄️', sub: 'Frozen next turn!', fn: () => { p.frozen = true; }, weight: 1 },
        {
            name: 'Bad Swap', icon: '🔄', sub: 'Swap with last!', fn: () => {
                const sorted = [...players].sort((a, b) => a.score - b.score);
                const loser = sorted[0];
                if (loser && loser.id !== p.id) {
                    const tmp = p.position; p.position = loser.position; loser.position = tmp;
                    positionToken(p); positionToken(loser);
                }
            }, weight: 1
        }
    ];

    // Weighted pick (simplified)
    const flat = [];
    outcomes.forEach(o => { for (let i = 0; i < o.weight; i++) flat.push(o); });
    const result = flat[Math.floor(Math.random() * flat.length)];

    showTilePopup(result.icon, result.name, result.sub, '#f59e0b', () => {
        const keepsCallback = result.fn();
        updateLeaderboard();
        if (!keepsCallback && onComplete) onComplete();
    });
}

function handleChaosDuel(p, opponent, onComplete) {
    showFloater(`⚔️ CHAOS DUEL: ${p.name} vs ${opponent.name}!`, '#ef4444');

    // Choose one random hard question
    const q = HARD_Q[Math.floor(Math.random() * HARD_Q.length)];

    // Sequential mode: p answers, then opponent answers
    const results = { p: null, opponent: null };

    const finishDuel = () => {
        if (results.p && !results.opponent) {
            // P won alone
            p.score += 15;
            opponent.score = Math.max(0, opponent.score - 5);
            showFloater(`${p.name} WINS! +15 pts`, p.color);
        } else if (!results.p && results.opponent) {
            // Opponent won alone
            opponent.score += 15;
            p.score = Math.max(0, p.score - 5);
            showFloater(`${opponent.name} WINS! +15 pts`, opponent.color);
        } else {
            // Draw or both wrong
            showFloater(`DUEL DRAW!`, '#6b7280');
        }
        updateLeaderboard();
        if (onComplete) onComplete();
    };

    const showOpponentTurn = () => {
        showFloater(`Defend yourself, ${opponent.name}!`, opponent.color);
        setTimeout(() => {
            showDuelQuestion(opponent, q, (correct) => {
                results.opponent = correct;
                finishDuel();
            });
        }, 1200);
    };

    showFloater(`Your turn to attack, ${p.name}!`, p.color);
    setTimeout(() => {
        showDuelQuestion(p, q, (correct) => {
            results.p = correct;
            showOpponentTurn();
        });
    }, 1200);
}

function showDuelQuestion(player, q, callback) {
    const overlay = document.getElementById('quiz-overlay');
    const panel = document.getElementById('quiz-panel');

    document.getElementById('quiz-question').textContent = `[${player.name}] ${q.question}`;
    document.getElementById('quiz-diff').textContent = "⚔️ DUEL QUESTION";
    panel.classList.add('is-challenge');

    const grid = document.getElementById('quiz-options');
    grid.innerHTML = '';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.innerHTML = `<span class="opt-prefix">${String.fromCharCode(65 + i)}</span> <span class="opt-text">${opt}</span>`;
        btn.onclick = () => {
            const isCorrect = i === q.correctIndex;
            clearInterval(timerInterval);
            overlay.classList.add('hidden');
            panel.classList.add('panel-hidden');
            callback(isCorrect);
        };
        grid.appendChild(btn);
    });

    overlay.classList.remove('hidden');
    panel.classList.remove('panel-hidden');

    // High stakes 10s timer for duel
    let left = 10;
    const hud = document.getElementById('hud-timer');
    hud.textContent = left;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        left--;
        hud.textContent = left;
        if (left <= 0) {
            clearInterval(timerInterval);
            overlay.classList.add('hidden');
            panel.classList.add('panel-hidden');
            callback(false);
        }
    }, 1000);
}
function showVictory(p) {
    if (window.sounds) window.sounds.play('win');

    // Sort logic to determine podium
    const sorted = [...players].sort((a, b) => b.score - a.score);
    const p1 = sorted[0] || p;
    const p2 = sorted.length > 1 ? sorted[1] : null;
    const p3 = sorted.length > 2 ? sorted[2] : null;

    const podium = document.getElementById('winner-name');
    if (podium) {
        let html = '';

        // 2nd Place
        if (p2) {
            html += `<div class="podium-step step-2" style="border-bottom-color: ${p2.color};">
                <div class="podium-avatar" style="background: ${p2.color}; color: #fff;">${p2.name[0]}</div>
                <div class="podium-rank">2nd</div>
                <div style="margin-top:8px; font-weight:600; color:var(--text-secondary);">${p2.name}</div>
            </div>`;
        }

        // 1st Place
        html += `<div class="podium-step step-1" style="border-bottom-color: ${p1.color};">
            <div class="podium-avatar" style="background: ${p1.color}; border: 4px solid var(--gold-color); color: #fff;">
                ${p1.name[0]}
                <div class="podium-crown">👑</div>
            </div>
            <div class="podium-rank">1st</div>
            <div style="margin-top:8px; font-weight:bold; color:var(--text-color); font-size:1.25rem;">${p1.name}</div>
        </div>`;

        // 3rd Place
        if (p3) {
            html += `<div class="podium-step step-3" style="border-bottom-color: ${p3.color};">
                <div class="podium-avatar" style="background: ${p3.color}; color: #fff;">${p3.name[0]}</div>
                <div class="podium-rank">3rd</div>
                <div style="margin-top:8px; font-weight:600; color:var(--text-secondary);">${p3.name}</div>
            </div>`;
        }

        podium.innerHTML = html;
    }

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

/* XP System Helpers */
function addXP(p, amount) {
    p.xp += amount;
    p.score += amount; // Update score for leaderboard
    if (p.xp >= 100) {
        p.xp = 0;
        p.score = 0; // Reset score to zero
        showFloater(`${p.name} HIT 100 PTS! BONUS ADVANCE!`, "#fbbf24");
        setTimeout(() => movePlayer(p, 1, () => { }), 500);
    }
    updateLeaderboard();
    updateTurnHUD();
}

/* Level Advance Popup on Normal Tiles */
function showLevelAdvancePopup(p, tile, onComplete) {
    const tileNum = p.position + 1;
    const totalTiles = CFG.TILES;
    const percent = Math.round((p.position / (totalTiles - 1)) * 100);
    let zone = 'Explorer';
    let zoneEmoji = '🌿';
    let zoneColor = '#22c55e';
    if (percent > 66) { zone = 'Champion'; zoneEmoji = '⚡'; zoneColor = '#f59e0b'; }
    else if (percent > 33) { zone = 'Adventurer'; zoneEmoji = '🗺️'; zoneColor = '#8b5cf6'; }

    // Create popup overlay
    const overlay = document.createElement('div');
    overlay.className = 'level-popup-overlay';
    overlay.innerHTML = `
        <div class="level-popup-card">
            <div class="level-popup-emoji">${zoneEmoji}</div>
            <div class="level-popup-title">TILE ${tileNum}</div>
            <div class="level-popup-zone" style="color: ${zoneColor}">${zone} Zone</div>
            <div class="level-popup-bar">
                <div class="level-popup-fill" style="width: ${percent}%; background: ${zoneColor}"></div>
            </div>
            <div class="level-popup-percent">${percent}% Complete</div>
        </div>
    `;
    document.getElementById('game-screen').appendChild(overlay);

    // Auto-dismiss
    setTimeout(() => {
        overlay.classList.add('level-popup-exit');
        setTimeout(() => {
            overlay.remove();
            if (onComplete) onComplete();
        }, 400);
    }, 1800);
}

/* Initialization */
document.addEventListener('DOMContentLoaded', () => {
    updateParticipantNames();
    console.log('[Init] Lobby names initialized.');

    // === INITIALIZE SOUND SYSTEM (Web Audio API) ===
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();

    function playTone(freq, duration, type = 'sine', volume = 0.3) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }

    function playChord(freqs, duration, type = 'sine', volume = 0.15) {
        freqs.forEach(f => playTone(f, duration, type, volume));
    }

    window.sounds = {
        play: function (name) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            switch (name) {
                case 'correct':
                    playChord([523.25, 659.25, 783.99], 0.5, 'sine', 0.2); // C major
                    setTimeout(() => playTone(1046.5, 0.3, 'sine', 0.15), 200);
                    break;
                case 'wrong':
                    playTone(200, 0.4, 'sawtooth', 0.15);
                    setTimeout(() => playTone(180, 0.3, 'sawtooth', 0.1), 150);
                    break;
                case 'move':
                    playTone(800 + Math.random() * 200, 0.08, 'sine', 0.1);
                    break;
                case 'roll':
                    for (let i = 0; i < 6; i++) {
                        setTimeout(() => playTone(300 + i * 80, 0.06, 'square', 0.06), i * 50);
                    }
                    break;
                case 'start':
                    playChord([392, 493.88, 587.33], 0.3, 'sine', 0.15);
                    setTimeout(() => playChord([523.25, 659.25, 783.99], 0.5, 'sine', 0.2), 300);
                    break;
                case 'win':
                    [0, 150, 300, 450, 600].forEach((d, i) => {
                        setTimeout(() => playTone(523.25 + i * 100, 0.4, 'sine', 0.2), d);
                    });
                    break;
                case 'power':
                    playTone(600, 0.15, 'sine', 0.15);
                    setTimeout(() => playTone(900, 0.15, 'sine', 0.15), 100);
                    setTimeout(() => playTone(1200, 0.2, 'sine', 0.12), 200);
                    break;
                default:
                    playTone(440, 0.1, 'sine', 0.08);
            }
        }
    };
    console.log('[Init] Sound system ready.');
});


function updateTurnHUD() {
    const p = players[currentPlayerIndex];
    if (!p) return; // Guard for initial sequence where currentPlayerIndex is -1

    const nameEl = document.getElementById('hud-player-name');
    if (nameEl) {
        nameEl.textContent = p.name;
        nameEl.style.color = p.color;
    }

    // Update the visual XP bar in the HUD
    const xpFill = document.getElementById('hud-xp-fill');
    if (xpFill) xpFill.style.width = `${p.xp}%`;

    const chaosBadge = document.getElementById('chaos-badge');
    if (chaosBadge) chaosBadge.classList.toggle('hidden', !chaosMode);
}
