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
        <div class="snapshot-preview" style="max-height:180px;overflow:hidden;border-radius:8px;margin-bottom:12px;"><img src="${detImg}" alt="Detected" style="width:100%;object-fit:cover;" /></div>
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

// Init API key display on load
document.addEventListener('DOMContentLoaded', initApiKeyDisplay);
