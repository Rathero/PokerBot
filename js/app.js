// ============================================================
// Poker Training Suite — Main Application
// ============================================================

const PE = window.PokerEngine;
const state = {
  activeTab: 'calculator',
  heroCards: [],
  boardCards: [],
  selectedPosition: 'BTN',
  numOpponents: 1,
  potSize: 100,
  callAmount: 50,
  heroStack: 1000,
  suitFilter: 'all',
  results: null,
  isCalculating: false,
  lastDetection: null
};

// ---- Initialization ----
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  renderCardSelector();
  renderPositionSelector();
  bindInputs();
  updateDisplay();
});

// ---- Tab Navigation ----
function initTabs() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      state.activeTab = target;
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${target}`).classList.add('active');
    });
  });
}

// ---- Card Selector ----
function renderCardSelector() {
  const container = document.getElementById('card-grid');
  if (!container) return;
  container.innerHTML = '';

  const deck = PE.createDeck();
  const usedCards = new Set([...state.heroCards, ...state.boardCards]);

  const filteredDeck = state.suitFilter === 'all'
    ? deck
    : deck.filter(c => PE.cardSuit(c) === state.suitFilter);

  // Group by suit
  const suitGroups = {};
  for (const card of filteredDeck) {
    const suit = PE.cardSuit(card);
    if (!suitGroups[suit]) suitGroups[suit] = [];
    suitGroups[suit].push(card);
  }

  const suitOrder = ['h', 'd', 'c', 's'];
  for (const suit of suitOrder) {
    if (!suitGroups[suit]) continue;
    const row = document.createElement('div');
    row.className = 'card-selector';
    for (const card of suitGroups[suit]) {
      const el = document.createElement('div');
      const suitClass = suit === 'h' ? 'heart' : suit === 'd' ? 'diamond' : suit === 'c' ? 'club' : 'spade';
      el.className = `playing-card ${suitClass}`;
      if (usedCards.has(card)) el.classList.add('disabled');
      if (state.heroCards.includes(card) || state.boardCards.includes(card)) el.classList.add('selected');

      el.innerHTML = `<span class="rank">${PE.cardRank(card)}</span><span class="suit">${PE.SUIT_SYMBOLS[suit]}</span>`;
      el.addEventListener('click', () => selectCard(card));
      row.appendChild(el);
    }
    container.appendChild(row);
  }

  // Suit filters
  const filterContainer = document.getElementById('suit-filters');
  if (filterContainer) {
    filterContainer.innerHTML = '';
    const allBtn = createSuitFilterBtn('all', '🂠 All');
    filterContainer.appendChild(allBtn);
    for (const suit of suitOrder) {
      const btn = createSuitFilterBtn(suit, PE.SUIT_SYMBOLS[suit]);
      filterContainer.appendChild(btn);
    }
  }
}

function createSuitFilterBtn(suit, label) {
  const btn = document.createElement('button');
  btn.className = `suit-filter ${state.suitFilter === suit ? 'active' : ''}`;
  btn.textContent = label;
  btn.addEventListener('click', () => {
    state.suitFilter = suit;
    renderCardSelector();
  });
  return btn;
}

function selectCard(card) {
  // If already selected, deselect
  if (state.heroCards.includes(card)) {
    state.heroCards = state.heroCards.filter(c => c !== card);
  } else if (state.boardCards.includes(card)) {
    state.boardCards = state.boardCards.filter(c => c !== card);
  } else if (state.heroCards.length < 2) {
    state.heroCards.push(card);
  } else if (state.boardCards.length < 5) {
    state.boardCards.push(card);
  }

  renderCardSelector();
  updateDisplay();
  autoCalculate();
}

function removeHeroCard(idx) {
  state.heroCards.splice(idx, 1);
  renderCardSelector();
  updateDisplay();
}

function removeBoardCard(idx) {
  state.boardCards.splice(idx, 1);
  renderCardSelector();
  updateDisplay();
}

function clearAllCards() {
  state.heroCards = [];
  state.boardCards = [];
  state.results = null;
  renderCardSelector();
  updateDisplay();
  renderResults();
}

// ---- Display Updates ----
function updateDisplay() {
  renderSelectedHeroCards();
  renderSelectedBoardCards();
  updatePhaseIndicator();
}

function renderSelectedHeroCards() {
  const container = document.getElementById('hero-cards-display');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < 2; i++) {
    if (i < state.heroCards.length) {
      const card = state.heroCards[i];
      const suit = PE.cardSuit(card);
      const suitClass = suit === 'h' ? 'heart' : suit === 'd' ? 'diamond' : suit === 'c' ? 'club' : 'spade';
      const el = document.createElement('div');
      el.className = `selected-card-large ${suitClass}`;
      el.innerHTML = `
        <span class="rank">${PE.cardRank(card)}</span>
        <span class="suit">${PE.SUIT_SYMBOLS[suit]}</span>
        <button class="remove-card" onclick="removeHeroCard(${i})">×</button>
      `;
      container.appendChild(el);
    } else {
      const ph = document.createElement('div');
      ph.className = 'card-placeholder';
      ph.textContent = '?';
      container.appendChild(ph);
    }
  }
}

function renderSelectedBoardCards() {
  const container = document.getElementById('board-cards-display');
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    if (i < state.boardCards.length) {
      const card = state.boardCards[i];
      const suit = PE.cardSuit(card);
      const suitClass = suit === 'h' ? 'heart' : suit === 'd' ? 'diamond' : suit === 'c' ? 'club' : 'spade';
      const el = document.createElement('div');
      el.className = `selected-card-large ${suitClass}`;
      el.innerHTML = `
        <span class="rank">${PE.cardRank(card)}</span>
        <span class="suit">${PE.SUIT_SYMBOLS[suit]}</span>
        <button class="remove-card" onclick="removeBoardCard(${i})">×</button>
      `;
      container.appendChild(el);
    } else {
      const ph = document.createElement('div');
      ph.className = 'card-placeholder';
      ph.textContent = i < 3 ? '?' : '';
      ph.style.opacity = i < 3 ? '1' : '0.3';
      container.appendChild(ph);
    }
  }
}

function updatePhaseIndicator() {
  const el = document.getElementById('phase-indicator');
  if (!el) return;

  let phase = 'Pre-flop';
  let phaseIcon = '🃏';
  if (state.boardCards.length >= 5) { phase = 'River'; phaseIcon = '🌊'; }
  else if (state.boardCards.length >= 4) { phase = 'Turn'; phaseIcon = '🔄'; }
  else if (state.boardCards.length >= 3) { phase = 'Flop'; phaseIcon = '📋'; }

  el.innerHTML = `${phaseIcon} ${phase}`;
}

// ---- Position Selector ----
function renderPositionSelector() {
  const container = document.getElementById('position-selector');
  if (!container) return;

  container.innerHTML = '';
  for (const [key, pos] of Object.entries(PE.POSITIONS)) {
    const btn = document.createElement('button');
    btn.className = `position-btn ${state.selectedPosition === key ? 'active' : ''}`;
    btn.textContent = key;
    btn.title = `${pos.name}: ${pos.description}`;
    btn.addEventListener('click', () => {
      state.selectedPosition = key;
      renderPositionSelector();
    });
    container.appendChild(btn);
  }
}

// ---- Input Bindings ----
function bindInputs() {
  const opponents = document.getElementById('num-opponents');
  const pot = document.getElementById('pot-size');
  const call = document.getElementById('call-amount');
  const stack = document.getElementById('hero-stack');

  if (opponents) opponents.addEventListener('input', (e) => { state.numOpponents = parseInt(e.target.value) || 1; });
  if (pot) pot.addEventListener('input', (e) => { state.potSize = parseFloat(e.target.value) || 0; });
  if (call) call.addEventListener('input', (e) => { state.callAmount = parseFloat(e.target.value) || 0; });
  if (stack) stack.addEventListener('input', (e) => { state.heroStack = parseFloat(e.target.value) || 0; });
}

// ---- Auto Calculate ----
function autoCalculate() {
  if (state.heroCards.length === 2) {
    calculateEquity();
  }
}

// ---- Calculation ----
function calculateEquity() {
  if (state.heroCards.length !== 2) return;

  state.isCalculating = true;
  renderResults();

  // Use setTimeout to let spinner render
  setTimeout(() => {
    const numSims = state.boardCards.length >= 3 ? 15000 : 10000;
    const equityResult = PE.calculateEquity(
      state.heroCards,
      state.boardCards,
      state.numOpponents,
      numSims
    );

    const potOdds = PE.calculatePotOdds(state.potSize, state.callAmount);

    const phase = state.boardCards.length >= 5 ? 'river'
      : state.boardCards.length >= 4 ? 'turn'
      : state.boardCards.length >= 3 ? 'flop' : 'preflop';

    const recommendations = PE.getRecommendation(
      equityResult.equity,
      potOdds,
      state.potSize,
      state.heroStack,
      phase,
      state.numOpponents,
      state.heroCards,
      state.selectedPosition
    );

    const handStrength = PE.describeHandStrength(state.heroCards, state.boardCards);

    let outsInfo = null;
    if (state.boardCards.length >= 3 && state.boardCards.length < 5) {
      outsInfo = PE.calculateOuts(state.heroCards, state.boardCards);
    }

    state.results = {
      equity: equityResult,
      potOdds,
      recommendations,
      handStrength,
      outs: outsInfo,
      phase
    };

    state.isCalculating = false;
    renderResults();
  }, 50);
}

// ---- Results Rendering ----
function renderResults() {
  const container = document.getElementById('results-container');
  if (!container) return;

  if (state.isCalculating) {
    container.innerHTML = `
      <div class="card">
        <div class="spinner"></div>
        <p style="text-align:center;color:var(--text-secondary);margin-top:12px;">Running Monte Carlo simulation...</p>
      </div>`;
    return;
  }

  if (!state.results) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🎴</div>
        <p>Select your 2 hole cards to begin analysis</p>
      </div>`;
    return;
  }

  const r = state.results;
  const equityColor = r.equity.equity > 60 ? 'var(--green)' : r.equity.equity > 40 ? 'var(--yellow)' : 'var(--red)';

  // Detection summary from camera/screenshot analysis
  let detectionHTML = '';
  const det = CameraAnalyzer.lastResult;
  const detImg = CameraAnalyzer.lastImage;
  if (det && detImg) {
    const heroDetHTML = (det.hero_cards || []).map(c => `<span class="detected-card">${c || '?'}</span>`).join(' ');
    const boardDetHTML = (det.board_cards || []).map(c => `<span class="detected-card">${c || '?'}</span>`).join(' ');
    const playersDetHTML = (det.players || []).map(p => `
      <div class="player-row">
        <span class="player-name">${p.name || '?'}</span>
        <span class="player-pos">${p.position || '?'}</span>
        <span class="player-stack">$${p.stack ?? '?'}</span>
        <span class="player-status ${p.status === 'active' ? 'active' : 'folded'}">${p.status || '?'}</span>
      </div>`).join('');
    detectionHTML = `
      <div class="card analysis-result-card" style="margin-bottom:16px;">
        <div class="card-header">
          <div class="card-title"><span class="icon">📸</span> AI Detection</div>
          <span style="font-size:11px;color:var(--text-muted);">via Gemini Vision</span>
        </div>
        <div class="snapshot-preview" style="border-radius:8px;margin-bottom:12px;"><img src="${detImg}" alt="Detected" style="width:100%;border-radius:8px;" /></div>
        <div class="detection-grid">
          <div class="detection-item"><div class="detection-label">Hand</div><div class="detection-value">${heroDetHTML || 'N/A'}</div></div>
          <div class="detection-item"><div class="detection-label">Board</div><div class="detection-value">${boardDetHTML || 'None'}</div></div>
          <div class="detection-item"><div class="detection-label">Pot</div><div class="detection-value highlight">$${det.pot_size ?? '?'}</div></div>
          <div class="detection-item"><div class="detection-label">Call</div><div class="detection-value highlight">$${det.call_amount ?? '?'}</div></div>
          <div class="detection-item"><div class="detection-label">Stack</div><div class="detection-value">$${det.hero_stack ?? '?'}</div></div>
          <div class="detection-item"><div class="detection-label">Phase</div><div class="detection-value">${det.phase || '?'}</div></div>
          <div class="detection-item"><div class="detection-label">Blinds</div><div class="detection-value">${det.blinds || '?'}</div></div>
          <div class="detection-item"><div class="detection-label">Players</div><div class="detection-value">${det.active_players ?? '?'} / ${det.num_players ?? '?'}</div></div>
        </div>
        ${playersDetHTML ? `<div style="margin-top:12px;"><div class="detection-label" style="margin-bottom:6px;">Player Info</div><div class="players-list">${playersDetHTML}</div></div>` : ''}
        ${det.notes ? `<div class="ai-notes"><span class="icon">💡</span> ${det.notes}</div>` : ''}
      </div>`;
  }

  let outsHTML = '';
  if (r.outs && r.outs.outs > 0) {
    outsHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title"><span class="icon">🎯</span> Outs & Draws</div>
          <span style="font-family:'JetBrains Mono';font-weight:700;color:var(--accent);">${r.outs.outs} outs (${r.outs.probability.toFixed(1)}%)</span>
        </div>
        <div class="outs-grid">
          ${r.outs.draws.map(d => `
            <div class="out-item">
              <div class="out-count">${d.count}</div>
              <div class="out-name">${d.name}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  const potOddsClass = r.equity.equity > r.potOdds ? 'positive' : r.equity.equity < r.potOdds ? 'negative' : 'neutral';
  const equityClass = r.equity.equity > r.potOdds ? 'positive' : 'negative';

  container.innerHTML = `
    ${detectionHTML}
    <div class="hand-strength">
      <div class="hand-name">${r.handStrength.name}</div>
      <div class="hand-desc">${r.handStrength.description}</div>
    </div>

    <div class="equity-display">
      <div class="equity-value">${r.equity.equity.toFixed(1)}%</div>
      <div class="equity-label">Equity vs ${state.numOpponents} opponent${state.numOpponents > 1 ? 's' : ''} · ${r.equity.simulations.toLocaleString()} simulations</div>
    </div>

    <div class="stat-bar">
      <span class="stat-label">Win</span>
      <div class="stat-fill-container"><div class="stat-fill win" style="width:${r.equity.winRate}%"></div></div>
      <span class="stat-value" style="color:var(--green)">${r.equity.winRate.toFixed(1)}%</span>
    </div>
    <div class="stat-bar">
      <span class="stat-label">Tie</span>
      <div class="stat-fill-container"><div class="stat-fill tie" style="width:${r.equity.tieRate}%"></div></div>
      <span class="stat-value" style="color:var(--yellow)">${r.equity.tieRate.toFixed(1)}%</span>
    </div>
    <div class="stat-bar" style="margin-bottom:20px;">
      <span class="stat-label">Loss</span>
      <div class="stat-fill-container"><div class="stat-fill loss" style="width:${r.equity.lossRate}%"></div></div>
      <span class="stat-value" style="color:var(--red)">${r.equity.lossRate.toFixed(1)}%</span>
    </div>

    ${state.callAmount > 0 ? `
    <div class="odds-comparison">
      <div class="odds-box ${equityClass}">
        <div class="odds-value">${r.equity.equity.toFixed(1)}%</div>
        <div class="odds-label">Your Equity</div>
      </div>
      <div class="odds-vs">vs</div>
      <div class="odds-box ${potOddsClass}">
        <div class="odds-value">${r.potOdds.toFixed(1)}%</div>
        <div class="odds-label">Pot Odds</div>
      </div>
    </div>
    ` : ''}

    ${outsHTML}

    <div class="card" style="padding:20px;">
      <div class="card-header">
        <div class="card-title"><span class="icon">💡</span> Recommendations</div>
        <span id="phase-badge" style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;font-weight:600;">${r.phase}</span>
      </div>
      ${r.recommendations.map(rec => {
        const badgeClass = rec.action.toLowerCase().replace('-', '-');
        return `
          <div class="recommendation">
            <div class="action-badge ${badgeClass}">${rec.action}</div>
            <div class="confidence" style="color:${rec.confidence > 60 ? 'var(--green)' : rec.confidence > 35 ? 'var(--yellow)' : 'var(--red)'}">${rec.confidence}%</div>
            <div class="reason">${rec.reason}</div>
          </div>`;
      }).join('')}
    </div>
  `;
}

// ---- Hand History Parser ----
function analyzeHandHistory() {
  const textarea = document.getElementById('hand-history-text');
  const resultsDiv = document.getElementById('hh-results');
  if (!textarea || !resultsDiv) return;

  const text = textarea.value.trim();
  if (!text) {
    resultsDiv.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>Paste a PartyPoker hand history to analyze</p></div>';
    return;
  }

  const analysis = parseHandHistory(text);
  renderHandHistoryAnalysis(analysis, resultsDiv);
}

function parseHandHistory(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const analysis = {
    gameType: '',
    players: [],
    heroHand: null,
    board: [],
    actions: [],
    potSize: 0,
    result: '',
    phases: []
  };

  let currentPhase = 'preflop';

  for (const line of lines) {
    // Game info
    if (line.includes('Hand #') || line.includes('Tournament') || line.includes("Hold'em")) {
      analysis.gameType = line;
    }

    // Player seats
    const seatMatch = line.match(/Seat (\d+): (.+?) \(\$([\d,.]+)/);
    if (seatMatch) {
      analysis.players.push({ seat: seatMatch[1], name: seatMatch[2], stack: seatMatch[3] });
    }

    // Hero cards
    const dealtMatch = line.match(/Dealt to (.+?) \[(.+?)\]/);
    if (dealtMatch) {
      analysis.heroHand = dealtMatch[2].split(' ');
    }

    // Board cards
    if (line.includes('*** FLOP ***')) {
      currentPhase = 'flop';
      const boardMatch = line.match(/\[(.+?)\]/);
      if (boardMatch) analysis.board.push(...boardMatch[1].split(' '));
    }
    if (line.includes('*** TURN ***')) {
      currentPhase = 'turn';
      const turnMatch = line.match(/\] \[(.+?)\]/);
      if (turnMatch) analysis.board.push(turnMatch[1]);
    }
    if (line.includes('*** RIVER ***')) {
      currentPhase = 'river';
      const riverMatch = line.match(/\] \[(.+?)\]/);
      if (riverMatch) analysis.board.push(riverMatch[1]);
    }

    // Actions
    const actionMatch = line.match(/^(.+?): (folds|checks|calls|bets|raises|all-in)(.*)$/i);
    if (actionMatch) {
      analysis.actions.push({
        phase: currentPhase,
        player: actionMatch[1],
        action: actionMatch[2],
        detail: actionMatch[3].trim()
      });
    }

    // Results
    if (line.includes('collected') || line.includes('wins')) {
      analysis.result = line;
    }
  }

  return analysis;
}

function renderHandHistoryAnalysis(analysis, container) {
  const playersHTML = analysis.players.map(p =>
    `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
      <span>Seat ${p.seat}: ${p.name}</span><span style="color:var(--green);font-family:'JetBrains Mono'">$${p.stack}</span>
    </div>`
  ).join('');

  const actionsHTML = analysis.actions.map(a => {
    const color = a.action === 'folds' ? 'var(--red)' : a.action === 'raises' || a.action === 'bets' ? 'var(--green)' : 'var(--yellow)';
    return `<div style="padding:6px 0;"><span style="color:var(--text-secondary)">[${a.phase}]</span> <strong>${a.player}</strong> <span style="color:${color}">${a.action}</span> ${a.detail}</div>`;
  }).join('');

  container.innerHTML = `
    <div class="card">
      <div class="card-title"><span class="icon">📊</span> Hand Analysis</div>
      <p style="color:var(--text-secondary);font-size:12px;margin:8px 0 16px;">${analysis.gameType || 'Hand history parsed'}</p>

      ${analysis.heroHand ? `
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;font-weight:500;display:block;margin-bottom:8px;">Your Hand</label>
          <div style="display:flex;gap:8px;">
            ${analysis.heroHand.map(c => `<div class="selected-card-large" style="width:50px;height:70px;font-size:16px;">${c}</div>`).join('')}
          </div>
        </div>
      ` : ''}

      ${analysis.board.length > 0 ? `
        <div style="margin-bottom:16px;">
          <label style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;font-weight:500;display:block;margin-bottom:8px;">Board</label>
          <div style="display:flex;gap:8px;">
            ${analysis.board.map(c => `<div class="selected-card-large" style="width:50px;height:70px;font-size:16px;">${c}</div>`).join('')}
          </div>
        </div>
      ` : ''}

      <div style="margin-bottom:16px;">
        <label style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;font-weight:500;display:block;margin-bottom:8px;">Players</label>
        ${playersHTML || '<p style="color:var(--text-muted)">No player data found</p>'}
      </div>

      <div>
        <label style="font-size:12px;color:var(--text-secondary);text-transform:uppercase;font-weight:500;display:block;margin-bottom:8px;">Action Timeline</label>
        ${actionsHTML || '<p style="color:var(--text-muted)">No actions found</p>'}
      </div>

      ${analysis.result ? `<div style="margin-top:16px;padding:12px;background:var(--bg-input);border-radius:8px;color:var(--gold);font-weight:600;">${analysis.result}</div>` : ''}
    </div>
  `;
}

// ---- Quick Scenario Loader ----
function loadScenario(type) {
  clearAllCards();

  const scenarios = {
    'premium': { hero: ['Ah', 'Kh'], board: [], desc: 'Premium hand: Ace-King suited' },
    'overpair': { hero: ['Qs', 'Qh'], board: ['9d', '7c', '3h'], desc: 'Overpair on dry board' },
    'flush-draw': { hero: ['Kh', 'Jh'], board: ['9h', '4h', '2c'], desc: 'Flush draw on the flop' },
    'set': { hero: ['8s', '8h'], board: ['8d', 'Ks', '3c'], desc: 'Middle set on K-high board' },
    'gutshot': { hero: ['Jd', 'Ts'], board: ['9h', '7c', '2d'], desc: 'Open-ended straight draw' },
    'marginal': { hero: ['Ad', '5d'], board: ['Kc', '9s', '4h', '2d'], desc: 'Ace-high on scary board' }
  };

  const s = scenarios[type];
  if (s) {
    state.heroCards = [...s.hero];
    state.boardCards = [...s.board];
    renderCardSelector();
    updateDisplay();
    autoCalculate();
  }
}

// ---- Camera Functions ----

async function toggleCamera() {
  const btn = document.getElementById('btn-start-camera');
  const placeholder = document.getElementById('camera-placeholder');
  const video = document.getElementById('camera-video');

  if (CameraAnalyzer.isStreaming) {
    CameraAnalyzer.stopCamera();
    btn.innerHTML = '📷 Start Camera';
    btn.className = 'btn btn-primary';
    if (placeholder) placeholder.classList.remove('hidden');
  } else {
    const success = await CameraAnalyzer.startCamera(video);
    if (success) {
      btn.innerHTML = '⏹ Stop Camera';
      btn.className = 'btn btn-danger';
      if (placeholder) placeholder.classList.add('hidden');
    } else {
      alert('Could not access camera. Please allow camera permissions.');
    }
  }
}

function toggleAutoAnalysis() {
  const btn = document.getElementById('btn-auto');
  if (CameraAnalyzer.isAutoMode) {
    CameraAnalyzer.stopAutoAnalysis();
    btn.innerHTML = '🔄 Auto: OFF';
    btn.className = 'btn btn-secondary';
  } else {
    CameraAnalyzer.startAutoAnalysis(8000);
    btn.innerHTML = '🔄 Auto: ON';
    btn.className = 'btn btn-primary';
  }
}

function handleScreenshotUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageData = e.target.result;
    const apiKey = CameraAnalyzer.getApiKey();
    if (!apiKey) {
      alert('Please set your Gemini API key first.');
      return;
    }

    // Show analyzing state
    const container = document.getElementById('camera-results');
    if (container) {
      container.innerHTML = `
        <div class="card">
          <div class="snapshot-preview"><img src="${imageData}" alt="Uploaded screenshot" /></div>
          <div class="spinner"></div>
          <p style="text-align:center;color:var(--text-secondary);margin-top:12px;">Analyzing screenshot with Gemini Vision...</p>
        </div>`;
    }

    // Analyze using the same pipeline
    try {
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const mimeMatch = imageData.match(/^data:(image\/[a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `You are analyzing a screenshot of an online poker table (PartyPoker or similar). Extract ALL visible information and return ONLY a valid JSON object with this structure: {"hero_cards":["Ah","Kd"],"board_cards":["Qs","Jh","Tc"],"pot_size":150,"hero_stack":980,"call_amount":50,"num_players":6,"active_players":3,"players":[{"name":"Player1","stack":1200,"bet":0,"position":"BTN","status":"active"}],"phase":"flop","dealer_position":"BTN","blinds":"5/10","notes":"Brief situation description"}. Card format: rank + suit letter. If not visible use null. Return ONLY JSON.` },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${response.status}`);
      }

      const data = await response.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // Robust JSON extraction
      let result;
      try { result = JSON.parse(content); } catch {
        const cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
        if (s !== -1 && e > s) result = JSON.parse(cleaned.substring(s, e + 1));
        else throw new Error('Could not parse AI response');
      }

      CameraAnalyzer.lastResult = result;
      CameraAnalyzer.lastImage = imageData;
      // Auto-apply results and switch to calculator
      CameraAnalyzer.applyToCalculator(result);
    } catch (err) {
      if (container) {
        container.innerHTML = `<div class="card" style="border-color:rgba(239,68,68,0.3);"><div style="text-align:center;padding:20px;"><div style="font-size:32px;margin-bottom:12px;">⚠️</div><p style="color:var(--red);font-weight:500;">${err.message}</p></div></div>`;
      }
    }
  };
  reader.readAsDataURL(file);
}

function saveApiKey() {
  const input = document.getElementById('api-key-input');
  const status = document.getElementById('api-key-status');
  if (!input) return;

  const key = input.value.trim();
  if (!key) {
    if (status) status.innerHTML = '<span style="color:var(--red)">Please enter a key</span>';
    return;
  }

  CameraAnalyzer.setApiKey(key);
  input.value = '';
  if (status) status.innerHTML = '<span style="color:var(--green)">✓ API key saved securely in browser</span>';
}

function initApiKeyDisplay() {
  const status = document.getElementById('api-key-status');
  if (status && CameraAnalyzer.getApiKey()) {
    status.innerHTML = '<span style="color:var(--green)">✓ API key configured</span>';
  }
}

// ============================================================
// XML Hand History Analyzer
// ============================================================

const xmlState = {
  parsedData: null,    // { sessions, hands, stats, errors }
  filteredHands: [],
  selectedHandIndex: -1
};

// ---- File Upload & Drop Zone ----
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('xml-drop-zone');
  const fileInput = document.getElementById('xml-file-input');
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleXMLFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', e => handleXMLFiles(e.target.files));
});

async function handleXMLFiles(files) {
  if (!files || files.length === 0) return;
  const xmlStrings = [];
  for (const file of files) {
    if (!file.name.endsWith('.xml')) continue;
    xmlStrings.push(await file.text());
  }
  if (xmlStrings.length === 0) return;

  try {
    xmlState.parsedData = XMLHandParser.parseMultipleFiles(xmlStrings);
    xmlState.filteredHands = [...xmlState.parsedData.hands];
    xmlState.selectedHandIndex = -1;

    // Update UI
    const badge = document.getElementById('xml-file-count');
    const clearBtn = document.getElementById('btn-clear-sessions');
    badge.textContent = `${xmlState.parsedData.hands.length} hands · ${xmlState.parsedData.sessions.length} session(s)`;
    badge.style.display = 'inline-block';
    clearBtn.style.display = 'inline-flex';

    renderSessionDashboard();
    renderHandList();
  } catch (err) {
    console.error('XML parse error:', err);
    alert('Error parsing XML: ' + err.message);
  }
}

function clearXMLSessions() {
  xmlState.parsedData = null;
  xmlState.filteredHands = [];
  xmlState.selectedHandIndex = -1;
  document.getElementById('xml-file-count').style.display = 'none';
  document.getElementById('btn-clear-sessions').style.display = 'none';
  document.getElementById('session-dashboard').style.display = 'none';
  document.getElementById('hand-list-card').style.display = 'none';
  document.getElementById('hand-detail-card').style.display = 'none';
  const fileInput = document.getElementById('xml-file-input');
  if (fileInput) fileInput.value = '';
}

// ---- Session Dashboard ----
function renderSessionDashboard() {
  const data = xmlState.parsedData;
  if (!data) return;
  const s = data.stats;
  const currency = data.sessions[0]?.currency || 'EUR';
  const sym = currency === 'EUR' ? '€' : '$';

  document.getElementById('session-dashboard').style.display = 'block';

  // Main stat cards
  const profitClass = data.sessions.reduce((a, ss) => a + ss.netProfit, 0) >= 0 ? 'positive' : 'negative';
  const netProfit = data.sessions.reduce((a, ss) => a + ss.netProfit, 0);

  document.getElementById('stats-cards').innerHTML = `
    <div class="stat-card ${profitClass}">
      <div class="stat-card-label">Net Profit</div>
      <div class="stat-card-value">${netProfit >= 0 ? '+' : ''}${sym}${Math.abs(netProfit).toFixed(2)}</div>
      <div class="stat-card-sub">${s.handsWon}W / ${s.handsPlayed - s.handsWon}L</div>
    </div>
    <div class="stat-card neutral">
      <div class="stat-card-label">Hands Played</div>
      <div class="stat-card-value">${s.handsPlayed}</div>
      <div class="stat-card-sub">${s.winRate.toFixed(1)}% win rate</div>
    </div>
    <div class="stat-card ${s.biggestWin > 0 ? 'positive' : 'neutral'}">
      <div class="stat-card-label">Biggest Win</div>
      <div class="stat-card-value">+${sym}${s.biggestWin.toFixed(2)}</div>
    </div>
    <div class="stat-card ${s.biggestLoss < 0 ? 'negative' : 'neutral'}">
      <div class="stat-card-label">Biggest Loss</div>
      <div class="stat-card-value">${sym}${Math.abs(s.biggestLoss).toFixed(2)}</div>
    </div>
  `;

  // Advanced stats
  const advCard = document.getElementById('advanced-stats-card');
  advCard.style.display = 'block';
  document.getElementById('advanced-stats').innerHTML = `
    <div class="adv-stat-item"><div class="adv-stat-value">${s.vpip.toFixed(1)}%</div><div class="adv-stat-label">VPIP</div></div>
    <div class="adv-stat-item"><div class="adv-stat-value">${s.pfr.toFixed(1)}%</div><div class="adv-stat-label">PFR</div></div>
    <div class="adv-stat-item"><div class="adv-stat-value">${s.wtsdPct.toFixed(1)}%</div><div class="adv-stat-label">WTSD</div></div>
    <div class="adv-stat-item"><div class="adv-stat-value">${s.wsdPct.toFixed(1)}%</div><div class="adv-stat-label">W$SD</div></div>
  `;

  // Profit chart
  renderProfitChart(data.hands, sym);
}

function renderProfitChart(hands, sym) {
  const chartCard = document.getElementById('profit-chart-card');
  const canvas = document.getElementById('profit-chart');
  const totalEl = document.getElementById('profit-total');
  if (!canvas || hands.length === 0) return;

  chartCard.style.display = 'block';
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Calculate cumulative profit
  let cumulative = 0;
  const points = hands.map(h => {
    cumulative += (h.heroResult?.profit || 0);
    return cumulative;
  });

  const total = points[points.length - 1];
  totalEl.textContent = `${total >= 0 ? '+' : ''}${sym}${Math.abs(total).toFixed(2)}`;
  totalEl.style.color = total >= 0 ? 'var(--green)' : 'var(--red)';

  // Set canvas size
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 160 * dpr;
  canvas.style.height = '160px';
  ctx.scale(dpr, dpr);
  const w = rect.width, h = 160;

  ctx.clearRect(0, 0, w, h);

  const minY = Math.min(0, ...points);
  const maxY = Math.max(0, ...points);
  const range = (maxY - minY) || 1;
  const padding = { top: 16, bottom: 20, left: 8, right: 8 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const toX = i => padding.left + (i / (points.length - 1 || 1)) * chartW;
  const toY = v => padding.top + (1 - (v - minY) / range) * chartH;

  // Zero line
  const zeroY = toY(0);
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  ctx.lineTo(w - padding.right, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
  if (total >= 0) {
    grad.addColorStop(0, 'rgba(34,197,94,0.25)');
    grad.addColorStop(1, 'rgba(34,197,94,0)');
  } else {
    grad.addColorStop(0, 'rgba(239,68,68,0)');
    grad.addColorStop(1, 'rgba(239,68,68,0.25)');
  }

  ctx.beginPath();
  ctx.moveTo(toX(0), zeroY);
  points.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
  ctx.lineTo(toX(points.length - 1), zeroY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  points.forEach((v, i) => {
    if (i === 0) ctx.moveTo(toX(i), toY(v));
    else ctx.lineTo(toX(i), toY(v));
  });
  ctx.strokeStyle = total >= 0 ? '#22c55e' : '#ef4444';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // End dot
  const lastX = toX(points.length - 1);
  const lastY = toY(points[points.length - 1]);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = total >= 0 ? '#22c55e' : '#ef4444';
  ctx.fill();
}

// ---- Hand List ----
function renderHandList() {
  if (!xmlState.parsedData) return;
  const container = document.getElementById('hand-list');
  const card = document.getElementById('hand-list-card');
  const subtitle = document.getElementById('hand-list-subtitle');
  card.style.display = 'block';
  document.getElementById('hand-detail-card').style.display = 'none';

  const hands = xmlState.filteredHands;
  subtitle.textContent = `Showing ${hands.length} of ${xmlState.parsedData.hands.length} hands`;

  container.innerHTML = hands.map((hand, i) => {
    const profit = hand.heroResult?.profit || 0;
    const profitClass = profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral';
    const sym = hand.currency === 'EUR' ? '€' : '$';
    const profitStr = profit >= 0 ? `+${sym}${profit.toFixed(2)}` : `-${sym}${Math.abs(profit).toFixed(2)}`;

    const cardsHTML = hand.heroCards.length > 0
      ? hand.heroCards.map(c => `<div class="hand-item-card ${c.suitClass}"><span>${XMLHandParser.RANK_DISPLAY[c.rank] || c.rank}</span><span>${XMLHandParser.SUIT_NAMES[c.suit]}</span></div>`).join('')
      : '<div class="hand-item-card unknown">?</div><div class="hand-item-card unknown">?</div>';

    const boardStr = hand.board.length > 0 ? hand.board.map(c => c.display).join(' ') : 'No board';

    return `
      <div class="hand-item" onclick="showHandDetail(${i})">
        <div class="hand-item-num">#${i + 1}</div>
        <div class="hand-item-cards">${cardsHTML}</div>
        <div class="hand-item-info">
          <div class="hand-item-type">${hand.gameType || 'Cash Game'}</div>
          <div class="hand-item-meta">${hand.date} · ${boardStr}</div>
        </div>
        <div class="hand-item-street">${hand.lastStreet}</div>
        <div class="hand-item-result ${profitClass}">${profitStr}</div>
      </div>`;
  }).join('');
}

function filterHands() {
  if (!xmlState.parsedData) return;
  const filter = document.getElementById('hand-filter').value;
  const all = xmlState.parsedData.hands;

  switch (filter) {
    case 'won':
      xmlState.filteredHands = all.filter(h => (h.heroResult?.profit || 0) > 0);
      break;
    case 'lost':
      xmlState.filteredHands = all.filter(h => (h.heroResult?.profit || 0) < 0);
      break;
    case 'showdown':
      xmlState.filteredHands = all.filter(h => h.heroResult?.wentToShowdown);
      break;
    case 'big-pot':
      const avg = all.reduce((s, h) => s + h.pot, 0) / all.length;
      xmlState.filteredHands = all.filter(h => h.pot > avg * 2);
      break;
    default:
      xmlState.filteredHands = [...all];
  }
  renderHandList();
}

// ---- Hand Detail View ----
function showHandDetail(index) {
  const hand = xmlState.filteredHands[index];
  if (!hand) return;
  xmlState.selectedHandIndex = index;

  document.getElementById('hand-list-card').style.display = 'none';
  const detailCard = document.getElementById('hand-detail-card');
  detailCard.style.display = 'block';
  document.getElementById('hand-detail-subtitle').textContent = `Hand #${hand.id} · ${hand.date}`;

  const sym = hand.currency === 'EUR' ? '€' : '$';
  const profit = hand.heroResult?.profit || 0;
  const bannerClass = profit > 0 ? 'win' : profit < 0 ? 'loss' : 'neutral';
  const profitStr = profit >= 0 ? `+${sym}${profit.toFixed(2)}` : `-${sym}${Math.abs(profit).toFixed(2)}`;

  // Hero cards
  const heroCardsHTML = hand.heroCards.map(c =>
    `<div class="detail-card ${c.suitClass}"><span class="rank">${XMLHandParser.RANK_DISPLAY[c.rank] || c.rank}</span><span class="suit">${XMLHandParser.SUIT_NAMES[c.suit]}</span></div>`
  ).join('');

  // Board cards
  const boardHTML = hand.board.map(c =>
    `<div class="detail-card ${c.suitClass}"><span class="rank">${XMLHandParser.RANK_DISPLAY[c.rank] || c.rank}</span><span class="suit">${XMLHandParser.SUIT_NAMES[c.suit]}</span></div>`
  ).join('');

  // Players table
  const playersHTML = hand.players.map(p => {
    const isHero = p.name === hand.heroName;
    const pProfit = p.win - p.bet;
    const pClass = pProfit > 0 ? 'style="color:var(--green)"' : pProfit < 0 ? 'style="color:var(--red)"' : '';
    return `<tr class="${isHero ? 'hero-row' : ''}">
      <td>${p.name}${isHero ? ' <small style="color:var(--accent)">(You)</small>' : ''}</td>
      <td>${p.isDealer ? '<span class="dealer-badge">D</span>' : ''}</td>
      <td style="font-family:'JetBrains Mono';font-weight:600">${sym}${p.chips.toFixed(2)}</td>
      <td style="font-family:'JetBrains Mono'" ${pClass}>${pProfit >= 0 ? '+' : ''}${sym}${pProfit.toFixed(2)}</td>
    </tr>`;
  }).join('');

  // Action timeline
  let timelineHTML = '';
  hand.rounds.forEach(round => {
    let roundCardsHTML = '';
    if (round.no === '2' && hand.boardCards.flop.length > 0) {
      roundCardsHTML = hand.boardCards.flop.map(c => `<span class="mini-card ${c.suitClass}">${c.display}</span>`).join('');
    } else if (round.no === '3' && hand.boardCards.turn) {
      roundCardsHTML = `<span class="mini-card ${hand.boardCards.turn.suitClass}">${hand.boardCards.turn.display}</span>`;
    } else if (round.no === '4' && hand.boardCards.river) {
      roundCardsHTML = `<span class="mini-card ${hand.boardCards.river.suitClass}">${hand.boardCards.river.display}</span>`;
    }

    timelineHTML += `<div class="action-round-header">${round.name}${roundCardsHTML ? `<div class="round-cards">${roundCardsHTML}</div>` : ''}</div>`;

    round.actions.forEach(a => {
      const actionClass = a.type.includes('blind') ? 'blind' : a.type;
      const isBlind = a.type === 'small blind' || a.type === 'big blind';
      timelineHTML += `
        <div class="action-entry ${a.isHero ? 'hero-action' : ''}">
          <span class="action-player">${a.player}</span>
          <span class="action-type ${isBlind ? 'blind' : actionClass}">${a.type}</span>
          ${a.amount > 0 ? `<span class="action-amount">${sym}${a.amount.toFixed(2)}</span>` : '<span class="action-amount"></span>'}
        </div>`;
    });
  });

  // Winners
  const winnersHTML = hand.winners.map(w =>
    `<span style="color:var(--green);font-weight:600">${w.name}</span> won <span style="font-family:'JetBrains Mono';font-weight:700;color:var(--gold)">${sym}${w.win.toFixed(2)}</span>`
  ).join(' · ');

  document.getElementById('hand-detail-content').innerHTML = `
    <div class="result-banner ${bannerClass}">
      <span class="result-label">${profit > 0 ? '🏆 You won' : profit < 0 ? '❌ You lost' : '➖ Break even'}</span>
      <span class="result-amount">${profitStr}</span>
    </div>

    <div class="hand-detail-section">
      <div class="hand-detail-section-title">Your Hand</div>
      <div class="hand-detail-cards">${heroCardsHTML || '<span style="color:var(--text-muted)">No cards visible</span>'}</div>
    </div>

    ${hand.board.length > 0 ? `
      <div class="hand-detail-section">
        <div class="hand-detail-section-title">Board</div>
        <div class="hand-detail-cards">${boardHTML}</div>
      </div>` : ''}

    <div class="hand-detail-section">
      <div class="hand-detail-section-title">Players</div>
      <table class="players-table">
        <thead><tr><th>Player</th><th></th><th>Stack</th><th>Result</th></tr></thead>
        <tbody>${playersHTML}</tbody>
      </table>
    </div>

    <div class="hand-detail-section">
      <div class="hand-detail-section-title">Action Timeline</div>
      <div class="action-timeline">${timelineHTML}</div>
    </div>

    ${winnersHTML ? `
      <div style="padding:12px 16px;background:var(--bg-input);border-radius:var(--radius-sm);border:1px solid var(--border);margin-top:8px;">
        <span style="font-size:12px;color:var(--text-muted);text-transform:uppercase;font-weight:600;">Result: </span>${winnersHTML}
      </div>` : ''}
  `;

  // Scroll to top of detail
  detailCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeHandDetail() {
  document.getElementById('hand-detail-card').style.display = 'none';
  document.getElementById('hand-list-card').style.display = 'block';
}

// Make functions globally accessible
window.removeHeroCard = removeHeroCard;
window.removeBoardCard = removeBoardCard;
window.clearAllCards = clearAllCards;
window.calculateEquity = calculateEquity;
window.analyzeHandHistory = analyzeHandHistory;
window.loadScenario = loadScenario;
window.toggleCamera = toggleCamera;
window.toggleAutoAnalysis = toggleAutoAnalysis;
window.handleScreenshotUpload = handleScreenshotUpload;
window.saveApiKey = saveApiKey;
window.handleXMLFiles = handleXMLFiles;
window.clearXMLSessions = clearXMLSessions;
window.filterHands = filterHands;
window.showHandDetail = showHandDetail;
window.closeHandDetail = closeHandDetail;

// Init API key display on load
document.addEventListener('DOMContentLoaded', initApiKeyDisplay);
