// ============================================================
// PartyPoker XML Hand History Parser
// Parses exported XML files from PartyPoker history
// ============================================================

const XMLHandParser = (() => {

  // Card notation mapping: PartyPoker XML uses "H2", "SA", "DK" etc.
  // where first char = suit (H/D/C/S), rest = rank
  const SUIT_MAP = { 'H': 'h', 'D': 'd', 'C': 'c', 'S': 's' };
  const SUIT_NAMES = { 'h': '♥', 'd': '♦', 'c': '♣', 's': '♠' };
  const SUIT_CLASSES = { 'h': 'heart', 'd': 'diamond', 'c': 'club', 's': 'spade' };

  const RANK_MAP = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
    '8': '8', '9': '9', '10': 'T', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
  };

  const RANK_DISPLAY = {
    '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
    '8': '8', '9': '9', 'T': '10', 'J': 'J', 'Q': 'Q', 'K': 'K', 'A': 'A'
  };

  // Action type mapping from PartyPoker XML
  const ACTION_TYPES = {
    '0': 'fold',
    '1': 'small blind',
    '2': 'big blind',
    '3': 'call',
    '4': 'check',
    '5': 'bet',
    '7': 'raise',
    '23': 'raise'
  };

  const ROUND_NAMES = {
    '0': 'Blinds',
    '1': 'Preflop',
    '2': 'Flop',
    '3': 'Turn',
    '4': 'River'
  };

  /**
   * Convert PartyPoker XML card notation to standard format
   * e.g. "SA" -> { rank: "A", suit: "s", display: "A♠", code: "As" }
   */
  function parseCard(xmlCard) {
    if (!xmlCard || xmlCard === 'X') return null;
    const suitChar = xmlCard[0].toUpperCase();
    const rankStr = xmlCard.substring(1);
    const suit = SUIT_MAP[suitChar];
    const rank = RANK_MAP[rankStr] || rankStr;
    if (!suit || !rank) return null;
    return {
      rank,
      suit,
      display: (RANK_DISPLAY[rank] || rank) + SUIT_NAMES[suit],
      code: rank + suit, // standard poker notation: "As", "Kh", etc.
      suitClass: SUIT_CLASSES[suit],
      original: xmlCard
    };
  }

  /**
   * Parse a cards string like "H2 SA S7 S2" into array of card objects
   */
  function parseCards(cardsStr) {
    if (!cardsStr) return [];
    return cardsStr.split(/\s+/)
      .map(c => parseCard(c.trim()))
      .filter(c => c !== null);
  }

  /**
   * Parse a Euro amount string like "€0.05" into a number
   */
  function parseAmount(amountStr) {
    if (!amountStr) return 0;
    return parseFloat(amountStr.replace(/[€$£,]/g, '')) || 0;
  }

  /**
   * Parse a single <game> XML element into a structured hand object
   */
  function parseGame(gameEl, sessionInfo) {
    const gamecode = gameEl.getAttribute('gamecode');
    const generalEl = gameEl.querySelector('general');
    const startdate = generalEl?.querySelector('startdate')?.textContent || '';

    // Parse players
    const players = [];
    const playerEls = gameEl.querySelectorAll('player');
    playerEls.forEach(p => {
      players.push({
        seat: parseInt(p.getAttribute('seat')),
        name: p.getAttribute('name'),
        chips: parseAmount(p.getAttribute('chips')),
        isDealer: p.getAttribute('dealer') === '1',
        win: parseAmount(p.getAttribute('win')),
        bet: parseAmount(p.getAttribute('bet')),
        rake: parseAmount(p.getAttribute('rakeamount')),
        showdown: p.getAttribute('muck') === '0'
      });
    });

    // Find hero
    const heroName = sessionInfo.nickname;
    const heroPlayer = players.find(p => p.name === heroName);

    // Parse rounds
    const rounds = [];
    const roundEls = gameEl.querySelectorAll('round');
    let heroCards = [];
    let boardCards = { flop: [], turn: null, river: null };

    roundEls.forEach(roundEl => {
      const roundNo = roundEl.getAttribute('no');
      const roundName = ROUND_NAMES[roundNo] || `Round ${roundNo}`;

      // Parse cards dealt in this round
      const cardEls = roundEl.querySelectorAll('cards');
      cardEls.forEach(cardEl => {
        const type = cardEl.getAttribute('type');
        const player = cardEl.getAttribute('player');
        const cardsText = cardEl.textContent.trim();

        if (type === 'Pocket' && player === heroName) {
          heroCards = parseCards(cardsText);
        } else if (type === 'Flop') {
          boardCards.flop = parseCards(cardsText);
        } else if (type === 'Turn') {
          const parsed = parseCards(cardsText);
          if (parsed.length > 0) boardCards.turn = parsed[0];
        } else if (type === 'River') {
          const parsed = parseCards(cardsText);
          if (parsed.length > 0) boardCards.river = parsed[0];
        }
      });

      // Parse actions
      const actions = [];
      const actionEls = roundEl.querySelectorAll('action');
      actionEls.forEach(actEl => {
        const actionType = actEl.getAttribute('type');
        actions.push({
          no: parseInt(actEl.getAttribute('no')),
          player: actEl.getAttribute('player'),
          type: ACTION_TYPES[actionType] || `unknown(${actionType})`,
          typeCode: actionType,
          amount: parseAmount(actEl.getAttribute('sum')),
          isHero: actEl.getAttribute('player') === heroName
        });
      });

      rounds.push({
        no: roundNo,
        name: roundName,
        actions
      });
    });

    // Calculate pot size
    const totalBets = players.reduce((sum, p) => sum + p.bet, 0);
    const totalRake = players.reduce((sum, p) => sum + p.rake, 0);

    // Determine winner(s)
    const winners = players.filter(p => p.win > 0);

    // Build full board array
    const fullBoard = [
      ...boardCards.flop,
      ...(boardCards.turn ? [boardCards.turn] : []),
      ...(boardCards.river ? [boardCards.river] : [])
    ];

    // Determine which street hand ended on
    let lastStreet = 'preflop';
    if (boardCards.river) lastStreet = 'river';
    else if (boardCards.turn) lastStreet = 'turn';
    else if (boardCards.flop.length > 0) lastStreet = 'flop';

    // Hero result
    let heroResult = null;
    if (heroPlayer) {
      const profit = heroPlayer.win - heroPlayer.bet;
      heroResult = {
        bet: heroPlayer.bet,
        win: heroPlayer.win,
        profit,
        isWinner: heroPlayer.win > 0,
        wentToShowdown: heroPlayer.showdown
      };
    }

    return {
      id: gamecode,
      date: startdate,
      players,
      heroName,
      heroCards,
      heroPlayer,
      heroResult,
      board: fullBoard,
      boardCards,
      rounds,
      pot: totalBets,
      rake: totalRake,
      winners,
      lastStreet,
      gameType: sessionInfo.gametype,
      tableName: sessionInfo.tablename,
      currency: sessionInfo.currency
    };
  }

  /**
   * Parse a full PartyPoker XML export file
   */
  function parseXML(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML: ' + parseError.textContent);
    }

    const sessionEl = doc.querySelector('session');
    if (!sessionEl) {
      throw new Error('No <session> element found in XML');
    }

    // Parse session general info
    const generalEl = sessionEl.querySelector(':scope > general');
    const sessionInfo = {
      sessionCode: sessionEl.getAttribute('sessioncode'),
      clientVersion: generalEl?.querySelector('client_version')?.textContent || '',
      mode: generalEl?.querySelector('mode')?.textContent || '',
      gametype: generalEl?.querySelector('gametype')?.textContent || '',
      tablename: generalEl?.querySelector('tablename')?.textContent || '',
      currency: generalEl?.querySelector('currency')?.textContent || 'EUR',
      nickname: generalEl?.querySelector('nickname')?.textContent || '',
      gamecount: parseInt(generalEl?.querySelector('gamecount')?.textContent || '0'),
      startdate: generalEl?.querySelector('startdate')?.textContent || '',
      totalBets: parseAmount(generalEl?.querySelector('bets')?.textContent),
      totalWins: parseAmount(generalEl?.querySelector('wins')?.textContent),
      tableSize: parseInt(generalEl?.querySelector('tablesize')?.textContent || '6')
    };

    sessionInfo.netProfit = sessionInfo.totalWins - sessionInfo.totalBets;

    // Parse all games
    const gameEls = sessionEl.querySelectorAll(':scope > game');
    const hands = [];
    gameEls.forEach(gameEl => {
      try {
        hands.push(parseGame(gameEl, sessionInfo));
      } catch (e) {
        console.warn('Failed to parse game:', e);
      }
    });

    return {
      session: sessionInfo,
      hands,
      stats: calculateSessionStats(hands, sessionInfo)
    };
  }

  /**
   * Calculate aggregate statistics for a session
   */
  function calculateSessionStats(hands, sessionInfo) {
    const heroName = sessionInfo.nickname;
    let handsPlayed = 0;
    let handsWon = 0;
    let totalProfit = 0;
    let vpipCount = 0; // Voluntarily put in pot
    let pfrCount = 0;  // Pre-flop raise
    let showdownCount = 0;
    let showdownWins = 0;
    let biggestWin = 0;
    let biggestLoss = 0;
    let flopsSeen = 0;
    let wentToShowdown = 0;

    hands.forEach(hand => {
      handsPlayed++;
      const heroResult = hand.heroResult;
      if (!heroResult) return;

      totalProfit += heroResult.profit;
      if (heroResult.isWinner) handsWon++;
      if (heroResult.profit > biggestWin) biggestWin = heroResult.profit;
      if (heroResult.profit < biggestLoss) biggestLoss = heroResult.profit;
      if (heroResult.wentToShowdown) {
        wentToShowdown++;
        if (heroResult.isWinner) showdownWins++;
      }

      // VPIP: Did hero voluntarily put money in (not just blinds)?
      const preflopRound = hand.rounds.find(r => r.no === '1');
      if (preflopRound) {
        const heroActions = preflopRound.actions.filter(a => a.isHero);
        const voluntaryAction = heroActions.some(a =>
          a.type === 'call' || a.type === 'raise' || a.type === 'bet'
        );
        if (voluntaryAction) vpipCount++;

        // PFR: Did hero raise preflop?
        const raisedPreflop = heroActions.some(a => a.type === 'raise');
        if (raisedPreflop) pfrCount++;
      }

      // Flops seen
      if (hand.board.length >= 3) {
        // Check if hero was still in the hand at flop
        const heroFolded = hand.rounds.some(r => {
          if (parseInt(r.no) > 1) return false;
          return r.actions.some(a => a.isHero && a.type === 'fold');
        });
        if (!heroFolded) flopsSeen++;
      }
    });

    return {
      handsPlayed,
      handsWon,
      winRate: handsPlayed > 0 ? (handsWon / handsPlayed * 100) : 0,
      totalProfit,
      avgProfit: handsPlayed > 0 ? totalProfit / handsPlayed : 0,
      vpip: handsPlayed > 0 ? (vpipCount / handsPlayed * 100) : 0,
      pfr: handsPlayed > 0 ? (pfrCount / handsPlayed * 100) : 0,
      flopsSeen,
      flopsSeenPct: handsPlayed > 0 ? (flopsSeen / handsPlayed * 100) : 0,
      wentToShowdown,
      wtsdPct: handsPlayed > 0 ? (wentToShowdown / handsPlayed * 100) : 0,
      showdownWins,
      wsdPct: wentToShowdown > 0 ? (showdownWins / wentToShowdown * 100) : 0,
      biggestWin,
      biggestLoss,
      bbPer100: 0 // Would need blind info to calculate
    };
  }

  /**
   * Parse multiple XML files and merge sessions
   */
  function parseMultipleFiles(xmlStrings) {
    const sessions = [];
    const allHands = [];
    const errors = [];

    xmlStrings.forEach((xml, i) => {
      try {
        const result = parseXML(xml);
        sessions.push(result.session);
        allHands.push(...result.hands);
      } catch (e) {
        errors.push({ file: i, error: e.message });
      }
    });

    // Sort all hands by date
    allHands.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateA - dateB;
    });

    // Recalculate combined stats
    const combinedSession = {
      nickname: sessions[0]?.nickname || 'Unknown',
      gamecount: allHands.length,
      totalBets: sessions.reduce((s, sess) => s + sess.totalBets, 0),
      totalWins: sessions.reduce((s, sess) => s + sess.totalWins, 0),
      gametype: [...new Set(sessions.map(s => s.gametype))].join(', '),
      currency: sessions[0]?.currency || 'EUR'
    };
    combinedSession.netProfit = combinedSession.totalWins - combinedSession.totalBets;

    const combinedStats = calculateSessionStats(allHands, combinedSession);

    return {
      sessions,
      hands: allHands,
      stats: combinedStats,
      errors
    };
  }

  /**
   * Parse date string "DD-MM-YYYY HH:MM:SS" to Date object
   */
  function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const parts = dateStr.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!parts) return new Date(0);
    return new Date(
      parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]),
      parseInt(parts[4]), parseInt(parts[5]), parseInt(parts[6])
    );
  }

  /**
   * Format a currency amount
   */
  function formatCurrency(amount, currency = 'EUR') {
    const symbol = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
    const sign = amount >= 0 ? '+' : '';
    return `${sign}${symbol}${Math.abs(amount).toFixed(2)}`;
  }

  // Public API
  return {
    parseXML,
    parseMultipleFiles,
    parseCard,
    parseCards,
    parseAmount,
    parseDate,
    formatCurrency,
    SUIT_NAMES,
    SUIT_CLASSES,
    RANK_DISPLAY,
    ACTION_TYPES,
    ROUND_NAMES
  };
})();

window.XMLHandParser = XMLHandParser;
