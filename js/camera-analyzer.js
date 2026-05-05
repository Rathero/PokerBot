// ============================================================
// Camera Analyzer — Capture & AI Vision Analysis
// ============================================================

const CameraAnalyzer = (() => {
  let stream = null;
  let videoEl = null;
  let canvasEl = null;
  let isAnalyzing = false;
  let autoMode = false;
  let autoInterval = null;
  let apiKey = localStorage.getItem('gemini_api_key') || '';

  // ---- Camera Controls ----

  async function startCamera(videoElement, facingMode = 'environment') {
    videoEl = videoElement;
    try {
      if (stream) stopCamera();
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      return true;
    } catch (err) {
      console.error('Camera error:', err);
      return false;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
    stopAutoAnalysis();
  }

  function captureFrame() {
    if (!videoEl || !videoEl.videoWidth) return null;
    if (!canvasEl) canvasEl = document.createElement('canvas');
    canvasEl.width = videoEl.videoWidth;
    canvasEl.height = videoEl.videoHeight;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    return canvasEl.toDataURL('image/jpeg', 0.85);
  }

  // ---- Auto Analysis ----

  function startAutoAnalysis(intervalMs = 8000) {
    autoMode = true;
    autoInterval = setInterval(() => {
      if (!isAnalyzing) analyzeCurrentFrame();
    }, intervalMs);
    // First analysis immediately
    analyzeCurrentFrame();
  }

  function stopAutoAnalysis() {
    autoMode = false;
    if (autoInterval) { clearInterval(autoInterval); autoInterval = null; }
  }

  // ---- AI Vision Analysis ----

  async function analyzeCurrentFrame() {
    const imageData = captureFrame();
    if (!imageData) return null;

    if (!apiKey) {
      renderCameraError('Enter your Gemini API key to enable AI analysis.');
      return null;
    }

    isAnalyzing = true;
    updateAnalysisStatus('analyzing');

    try {
      const result = await callVisionAPI(imageData);
      isAnalyzing = false;
      updateAnalysisStatus('done');
      renderAnalysisResult(result, imageData);
      return result;
    } catch (err) {
      isAnalyzing = false;
      updateAnalysisStatus('error');
      renderCameraError(`Analysis failed: ${err.message}`);
      return null;
    }
  }

  async function callVisionAPI(base64Image) {
    const prompt = `You are analyzing a screenshot of an online poker table (PartyPoker or similar). 
Extract ALL visible information and return ONLY a valid JSON object with this exact structure:

{
  "hero_cards": ["Ah", "Kd"],
  "board_cards": ["Qs", "Jh", "Tc"],
  "pot_size": 150,
  "hero_stack": 980,
  "call_amount": 50,
  "num_players": 6,
  "active_players": 3,
  "players": [
    {"name": "Player1", "stack": 1200, "bet": 0, "position": "BTN", "status": "active"},
    {"name": "Hero", "stack": 980, "bet": 25, "position": "CO", "status": "active"}
  ],
  "phase": "flop",
  "dealer_position": "BTN",
  "blinds": "5/10",
  "notes": "Brief description of the current situation"
}

Card format: rank + suit letter (A/K/Q/J/T/9/8/7/6/5/4/3/2 + h/d/c/s).
If a value is not visible, use null. For cards you can't identify, use "??".
Return ONLY the JSON, no markdown, no explanation.`;

    // Extract base64 data from data URI
    const base64Data = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mimeMatch = base64Image.match(/^data:(image\/[a-z]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Robust JSON extraction
    return extractJSON(content);
  }

  function extractJSON(text) {
    // Try direct parse first
    try { return JSON.parse(text); } catch {}

    // Strip markdown fences
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    try { return JSON.parse(cleaned); } catch {}

    // Extract first JSON object from text
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try { return JSON.parse(cleaned.substring(start, end + 1)); } catch {}
    }

    throw new Error('Could not parse AI response as JSON. Raw: ' + text.substring(0, 200));
  }

  // ---- Apply Results to Calculator ----

  function applyToCalculator(result) {
    if (!result) return;

    // Map cards from AI format to engine format
    const mapCard = (c) => {
      if (!c || c === '??') return null;
      // Normalize: ensure format is like "Ah", "Kd", etc.
      return c.length === 2 ? c : null;
    };

    // Clear current state
    if (typeof clearAllCards === 'function') clearAllCards();

    // Apply hero cards
    if (result.hero_cards) {
      const validHero = result.hero_cards.map(mapCard).filter(Boolean);
      const deck = PokerEngine.createDeck();
      for (const card of validHero) {
        if (deck.includes(card) && state.heroCards.length < 2) {
          state.heroCards.push(card);
        }
      }
    }

    // Apply board cards
    if (result.board_cards) {
      const validBoard = result.board_cards.map(mapCard).filter(Boolean);
      const deck = PokerEngine.createDeck();
      for (const card of validBoard) {
        if (deck.includes(card) && !state.heroCards.includes(card) && state.boardCards.length < 5) {
          state.boardCards.push(card);
        }
      }
    }

    // Apply numeric values
    if (result.pot_size != null) {
      state.potSize = result.pot_size;
      const potEl = document.getElementById('pot-size');
      if (potEl) potEl.value = result.pot_size;
    }
    if (result.call_amount != null) {
      state.callAmount = result.call_amount;
      const callEl = document.getElementById('call-amount');
      if (callEl) callEl.value = result.call_amount;
    }
    if (result.hero_stack != null) {
      state.heroStack = result.hero_stack;
      const stackEl = document.getElementById('hero-stack');
      if (stackEl) stackEl.value = result.hero_stack;
    }
    if (result.active_players != null) {
      state.numOpponents = Math.max(1, result.active_players - 1);
      const oppEl = document.getElementById('num-opponents');
      if (oppEl) oppEl.value = state.numOpponents;
    }

    // Update display and calculate
    renderCardSelector();
    updateDisplay();
    if (state.heroCards.length === 2) calculateEquity();

    // Switch to calculator tab
    const calcTab = document.querySelector('[data-tab="calculator"]');
    if (calcTab) calcTab.click();
  }

  // ---- Rendering ----

  function updateAnalysisStatus(status) {
    const el = document.getElementById('analysis-status');
    if (!el) return;
    const statusMap = {
      'idle': '<span style="color:var(--text-muted)">● Ready</span>',
      'analyzing': '<span style="color:var(--yellow)">◉ Analyzing<span class="pulse-dot"></span></span>',
      'done': '<span style="color:var(--green)">✓ Complete</span>',
      'error': '<span style="color:var(--red)">✗ Error</span>'
    };
    el.innerHTML = statusMap[status] || '';
  }

  function renderAnalysisResult(result, imageData) {
    const container = document.getElementById('camera-results');
    if (!container || !result) return;

    const playersHTML = (result.players || []).map(p => `
      <div class="player-row">
        <span class="player-name">${p.name || '?'}</span>
        <span class="player-pos">${p.position || '?'}</span>
        <span class="player-stack">$${p.stack ?? '?'}</span>
        <span class="player-status ${p.status === 'active' ? 'active' : 'folded'}">${p.status || '?'}</span>
      </div>
    `).join('');

    const heroHTML = (result.hero_cards || []).map(c =>
      `<span class="detected-card">${c || '?'}</span>`
    ).join(' ');

    const boardHTML = (result.board_cards || []).map(c =>
      `<span class="detected-card">${c || '?'}</span>`
    ).join(' ');

    container.innerHTML = `
      <div class="card analysis-result-card">
        <div class="card-header">
          <div class="card-title"><span class="icon">🔍</span> Detection Results</div>
          <button class="btn btn-primary btn-sm" onclick="CameraAnalyzer.applyToCalculator(CameraAnalyzer.lastResult)">
            ⚡ Apply & Calculate
          </button>
        </div>

        <div class="snapshot-preview">
          <img src="${imageData}" alt="Captured frame" />
        </div>

        <div class="detection-grid">
          <div class="detection-item">
            <div class="detection-label">Your Hand</div>
            <div class="detection-value">${heroHTML || '<span style="color:var(--text-muted)">Not detected</span>'}</div>
          </div>
          <div class="detection-item">
            <div class="detection-label">Board</div>
            <div class="detection-value">${boardHTML || '<span style="color:var(--text-muted)">No board yet</span>'}</div>
          </div>
          <div class="detection-item">
            <div class="detection-label">Pot</div>
            <div class="detection-value highlight">$${result.pot_size ?? '?'}</div>
          </div>
          <div class="detection-item">
            <div class="detection-label">To Call</div>
            <div class="detection-value highlight">$${result.call_amount ?? '?'}</div>
          </div>
          <div class="detection-item">
            <div class="detection-label">Your Stack</div>
            <div class="detection-value">$${result.hero_stack ?? '?'}</div>
          </div>
          <div class="detection-item">
            <div class="detection-label">Phase</div>
            <div class="detection-value">${result.phase || '?'}</div>
          </div>
          <div class="detection-item">
            <div class="detection-label">Blinds</div>
            <div class="detection-value">${result.blinds || '?'}</div>
          </div>
          <div class="detection-item">
            <div class="detection-label">Players</div>
            <div class="detection-value">${result.active_players ?? '?'} / ${result.num_players ?? '?'}</div>
          </div>
        </div>

        ${playersHTML ? `
          <div style="margin-top:16px;">
            <div class="detection-label" style="margin-bottom:8px;">Player Info</div>
            <div class="players-list">${playersHTML}</div>
          </div>
        ` : ''}

        ${result.notes ? `
          <div class="ai-notes">
            <span class="icon">💡</span> ${result.notes}
          </div>
        ` : ''}
      </div>
    `;

    // Store last result for apply button
    CameraAnalyzer.lastResult = result;
  }

  function renderCameraError(msg) {
    const container = document.getElementById('camera-results');
    if (!container) return;
    container.innerHTML = `
      <div class="card" style="border-color:rgba(239,68,68,0.3);">
        <div style="text-align:center;padding:20px;">
          <div style="font-size:32px;margin-bottom:12px;">⚠️</div>
          <p style="color:var(--red);font-weight:500;">${msg}</p>
        </div>
      </div>`;
  }

  // ---- API Key Management ----

  function setApiKey(key) {
    apiKey = key;
    localStorage.setItem('gemini_api_key', key);
  }

  function getApiKey() {
    return apiKey;
  }

  // ---- Public API ----
  return {
    startCamera, stopCamera, captureFrame,
    analyzeCurrentFrame, applyToCalculator,
    startAutoAnalysis, stopAutoAnalysis,
    setApiKey, getApiKey,
    lastResult: null,
    get isAnalyzing() { return isAnalyzing; },
    get isAutoMode() { return autoMode; },
    get isStreaming() { return !!stream; }
  };
})();

window.CameraAnalyzer = CameraAnalyzer;
