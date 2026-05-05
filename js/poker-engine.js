// ============================================================
// Poker Engine — Hand evaluation, equity calculation, recommendations
// ============================================================

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['h', 'd', 'c', 's'];
const SUIT_SYMBOLS = { h: '♥', d: '♦', c: '♣', s: '♠' };
const SUIT_NAMES = { h: 'Hearts', d: 'Diamonds', c: 'Clubs', s: 'Spades' };
const RANK_NAMES = {
  '2': 'Two', '3': 'Three', '4': 'Four', '5': 'Five', '6': 'Six',
  '7': 'Seven', '8': 'Eight', '9': 'Nine', 'T': 'Ten',
  'J': 'Jack', 'Q': 'Queen', 'K': 'King', 'A': 'Ace'
};

const HAND_RANKINGS = {
  ROYAL_FLUSH: 9,
  STRAIGHT_FLUSH: 8,
  FOUR_OF_A_KIND: 7,
  FULL_HOUSE: 6,
  FLUSH: 5,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  ONE_PAIR: 1,
  HIGH_CARD: 0
};

const HAND_NAMES = {
  9: 'Royal Flush',
  8: 'Straight Flush',
  7: 'Four of a Kind',
  6: 'Full House',
  5: 'Flush',
  4: 'Straight',
  3: 'Three of a Kind',
  2: 'Two Pair',
  1: 'One Pair',
  0: 'High Card'
};

// ---- Card Utilities ----

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

function rankValue(rank) {
  return RANKS.indexOf(rank);
}

function cardRankValue(card) {
  return rankValue(card[0]);
}

function cardSuit(card) {
  return card[1];
}

function cardRank(card) {
  return card[0];
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatCard(card) {
  return card[0] + SUIT_SYMBOLS[card[1]];
}

// ---- Hand Evaluation ----

function evaluateHand(sevenCards) {
  // Generate all 21 combinations of 5 from 7
  let bestHand = null;
  const combos = combinations(sevenCards, 5);

  for (const combo of combos) {
    const hand = evaluate5Cards(combo);
    if (!bestHand || compareHands(hand, bestHand) > 0) {
      bestHand = hand;
    }
  }
  return bestHand;
}

function combinations(arr, k) {
  const results = [];
  function combine(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return results;
}

function evaluate5Cards(cards) {
  const ranks = cards.map(c => cardRankValue(c)).sort((a, b) => b - a);
  const suits = cards.map(c => cardSuit(c));

  const isFlush = suits.every(s => s === suits[0]);

  // Check for straight
  let isStraight = false;
  let straightHigh = -1;

  // Normal straight check
  if (ranks[0] - ranks[4] === 4 && new Set(ranks).size === 5) {
    isStraight = true;
    straightHigh = ranks[0];
  }
  // Wheel (A-2-3-4-5)
  if (ranks[0] === 12 && ranks[1] === 3 && ranks[2] === 2 && ranks[3] === 1 && ranks[4] === 0) {
    isStraight = true;
    straightHigh = 3; // 5 high
  }

  // Count rank frequencies
  const freq = {};
  for (const r of ranks) {
    freq[r] = (freq[r] || 0) + 1;
  }
  const freqValues = Object.values(freq).sort((a, b) => b - a);
  const freqEntries = Object.entries(freq)
    .map(([r, c]) => ({ rank: parseInt(r), count: c }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);

  // Determine hand ranking
  if (isFlush && isStraight) {
    if (straightHigh === 12) {
      return { ranking: HAND_RANKINGS.ROYAL_FLUSH, kickers: [12] };
    }
    return { ranking: HAND_RANKINGS.STRAIGHT_FLUSH, kickers: [straightHigh] };
  }

  if (freqValues[0] === 4) {
    const quadRank = freqEntries.find(e => e.count === 4).rank;
    const kicker = freqEntries.find(e => e.count !== 4).rank;
    return { ranking: HAND_RANKINGS.FOUR_OF_A_KIND, kickers: [quadRank, kicker] };
  }

  if (freqValues[0] === 3 && freqValues[1] === 2) {
    const tripRank = freqEntries.find(e => e.count === 3).rank;
    const pairRank = freqEntries.find(e => e.count === 2).rank;
    return { ranking: HAND_RANKINGS.FULL_HOUSE, kickers: [tripRank, pairRank] };
  }

  if (isFlush) {
    return { ranking: HAND_RANKINGS.FLUSH, kickers: ranks };
  }

  if (isStraight) {
    return { ranking: HAND_RANKINGS.STRAIGHT, kickers: [straightHigh] };
  }

  if (freqValues[0] === 3) {
    const tripRank = freqEntries.find(e => e.count === 3).rank;
    const kickers = freqEntries.filter(e => e.count === 1).map(e => e.rank).sort((a, b) => b - a);
    return { ranking: HAND_RANKINGS.THREE_OF_A_KIND, kickers: [tripRank, ...kickers] };
  }

  if (freqValues[0] === 2 && freqValues[1] === 2) {
    const pairs = freqEntries.filter(e => e.count === 2).map(e => e.rank).sort((a, b) => b - a);
    const kicker = freqEntries.find(e => e.count === 1).rank;
    return { ranking: HAND_RANKINGS.TWO_PAIR, kickers: [...pairs, kicker] };
  }

  if (freqValues[0] === 2) {
    const pairRank = freqEntries.find(e => e.count === 2).rank;
    const kickers = freqEntries.filter(e => e.count === 1).map(e => e.rank).sort((a, b) => b - a);
    return { ranking: HAND_RANKINGS.ONE_PAIR, kickers: [pairRank, ...kickers] };
  }

  return { ranking: HAND_RANKINGS.HIGH_CARD, kickers: ranks };
}

function compareHands(a, b) {
  if (a.ranking !== b.ranking) return a.ranking - b.ranking;
  for (let i = 0; i < Math.min(a.kickers.length, b.kickers.length); i++) {
    if (a.kickers[i] !== b.kickers[i]) return a.kickers[i] - b.kickers[i];
  }
  return 0;
}

// ---- Monte Carlo Equity Simulation ----

function calculateEquity(heroCards, board, numOpponents = 1, numSimulations = 10000) {
  const knownCards = new Set([...heroCards, ...board]);
  const remainingDeck = createDeck().filter(c => !knownCards.has(c));

  let wins = 0;
  let ties = 0;
  let total = 0;

  const cardsNeededForBoard = 5 - board.length;
  const cardsNeededPerOpponent = 2;
  const totalCardsNeeded = cardsNeededForBoard + (cardsNeededPerOpponent * numOpponents);

  for (let sim = 0; sim < numSimulations; sim++) {
    const shuffled = shuffleDeck(remainingDeck);

    if (shuffled.length < totalCardsNeeded) continue;

    let idx = 0;

    // Complete the board
    const fullBoard = [...board];
    for (let i = 0; i < cardsNeededForBoard; i++) {
      fullBoard.push(shuffled[idx++]);
    }

    // Hero hand
    const heroFull = [...heroCards, ...fullBoard];
    const heroEval = evaluateHand(heroFull);

    // Opponent hands
    let heroBest = true;
    let isTie = false;

    for (let opp = 0; opp < numOpponents; opp++) {
      const oppCards = [shuffled[idx++], shuffled[idx++]];
      const oppFull = [...oppCards, ...fullBoard];
      const oppEval = evaluateHand(oppFull);
      const cmp = compareHands(heroEval, oppEval);

      if (cmp < 0) {
        heroBest = false;
        break;
      } else if (cmp === 0) {
        isTie = true;
      }
    }

    if (heroBest && !isTie) wins++;
    else if (heroBest && isTie) ties++;
    total++;
  }

  return {
    equity: ((wins + ties * 0.5) / total) * 100,
    winRate: (wins / total) * 100,
    tieRate: (ties / total) * 100,
    lossRate: ((total - wins - ties) / total) * 100,
    simulations: total
  };
}

// ---- Pot Odds & Recommendations ----

function calculatePotOdds(potSize, callAmount) {
  if (callAmount <= 0) return 0;
  return (callAmount / (potSize + callAmount)) * 100;
}

function getRecommendation(equity, potOdds, potSize, stackSize, phase, numOpponents, heroCards, position) {
  const actions = [];

  // ---- Key metrics ----
  // In multi-way pots, breakeven equity = 1 / (numOpponents + 1)
  const breakevenEquity = (1 / (numOpponents + 1)) * 100;
  // Stack-to-pot ratio: high SPR = deep stacks = big implied odds
  const spr = potSize > 0 ? stackSize / potSize : 20;
  // Implied odds multiplier: deeper stacks mean hands with draw potential gain value
  const impliedOddsBonus = Math.min(15, Math.max(0, (spr - 3) * 1.5));
  // Effective equity = raw equity + implied odds bonus (capped)
  const effectiveEquity = Math.min(95, equity + (phase === 'preflop' ? impliedOddsBonus : impliedOddsBonus * 0.5));
  // Edge over breakeven (multi-way adjusted)
  const edgeOverBreakeven = effectiveEquity - breakevenEquity;
  // Position bonus
  const posBonus = { 'BTN': 8, 'CO': 5, 'MP': 0, 'UTG': -3, 'SB': -2, 'BB': 2 };
  const positionAdj = posBonus[position] || 0;

  // ---- Preflop hand tier detection ----
  let preflopTier = 0; // 0=trash, 1=speculative, 2=playable, 3=good, 4=strong, 5=premium
  if (heroCards && heroCards.length === 2 && phase === 'preflop') {
    const r1 = cardRankValue(heroCards[0]);
    const r2 = cardRankValue(heroCards[1]);
    const suited = cardSuit(heroCards[0]) === cardSuit(heroCards[1]);
    const pair = r1 === r2;
    const high = Math.max(r1, r2);
    const low = Math.min(r1, r2);
    const gap = high - low;

    if (pair && high >= 10) preflopTier = 5;           // QQ, KK, AA
    else if (high === 12 && low >= 10 && suited) preflopTier = 5;  // AKs, AQs
    else if (high === 12 && low >= 10) preflopTier = 4;            // AKo, AQo
    else if (pair && high >= 7) preflopTier = 4;                    // 77-JJ
    else if (high === 12 && low >= 8 && suited) preflopTier = 4;   // ATs, AJs
    else if (high >= 10 && low >= 9 && suited) preflopTier = 4;    // KQs, QJs, JTs
    else if (pair) preflopTier = 3;                                 // 22-66
    else if (high >= 10 && low >= 8) preflopTier = 3;              // KJ, QT, etc.
    else if (suited && gap <= 2 && high >= 5) preflopTier = 3;     // suited connectors
    else if (high === 12) preflopTier = 2;                          // Ax
    else if (suited && gap <= 3 && high >= 6) preflopTier = 2;     // suited one-gappers
    else if (high >= 10 && low >= 6) preflopTier = 1;              // decent broadway
    else preflopTier = 0;
  }

  // ---- PREFLOP RECOMMENDATIONS ----
  if (phase === 'preflop') {
    const tierNames = ['Trash', 'Speculative', 'Playable', 'Good', 'Strong', 'Premium'];

    if (preflopTier >= 5) {
      // Premium hands (AA, KK, QQ, AKs, AQs): almost always raise/re-raise
      actions.push({
        action: 'RAISE',
        confidence: Math.min(95, 85 + positionAdj),
        reason: `${tierNames[preflopTier]} hand. Strong raise for value. Equity ${equity.toFixed(1)}% vs ${numOpponents} opponents (need ${breakevenEquity.toFixed(1)}% to break even).`
      });
      actions.push({
        action: 'ALL-IN',
        confidence: spr < 5 ? 80 : 40,
        reason: spr < 5 ? `Short SPR (${spr.toFixed(1)}). Commit with premium hand.` : `Consider 4-bet/shove if facing 3-bet.`
      });
      actions.push({
        action: 'CALL',
        confidence: 50,
        reason: `Calling is profitable but raising extracts more value.`
      });
    } else if (preflopTier >= 4) {
      // Strong hands: raise from most positions
      actions.push({
        action: 'RAISE',
        confidence: Math.min(90, 70 + positionAdj),
        reason: `${tierNames[preflopTier]} hand in ${position || 'position'}. Raise for value. Equity ${equity.toFixed(1)}% (need ${breakevenEquity.toFixed(1)}%).`
      });
      actions.push({
        action: 'CALL',
        confidence: Math.min(80, 60 + positionAdj),
        reason: `Strong enough to call profitably. Effective equity with implied odds: ${effectiveEquity.toFixed(1)}%.`
      });
    } else if (preflopTier >= 3) {
      // Good hands: position-dependent
      const raiseConf = Math.max(20, 45 + positionAdj);
      const callConf = Math.max(30, 55 + positionAdj);
      actions.push({
        action: 'CALL',
        confidence: callConf,
        reason: `${tierNames[preflopTier]} hand. Profitable call with ${effectiveEquity.toFixed(1)}% effective equity (implied odds from SPR ${spr.toFixed(1)}).`
      });
      if (positionAdj >= 0) {
        actions.push({
          action: 'RAISE',
          confidence: raiseConf,
          reason: `Consider raising in ${position || 'position'} for initiative and fold equity.`
        });
      }
      if (positionAdj < -2) {
        actions.push({
          action: 'FOLD',
          confidence: 30,
          reason: `Marginal from early position with many players behind.`
        });
      }
    } else if (preflopTier >= 2) {
      // Playable hands: mostly call in position, fold OOP
      if (positionAdj >= 3 && spr > 5) {
        actions.push({
          action: 'CALL',
          confidence: 50,
          reason: `${tierNames[preflopTier]} but playable in position with deep stacks (SPR ${spr.toFixed(1)}).`
        });
      }
      actions.push({
        action: 'FOLD',
        confidence: Math.max(30, 55 - positionAdj * 3),
        reason: `${tierNames[preflopTier]} hand. Marginal in most spots.`
      });
    } else if (preflopTier <= 1) {
      // Speculative or trash
      if (preflopTier === 1 && positionAdj >= 5 && spr > 8) {
        actions.push({
          action: 'CALL',
          confidence: 35,
          reason: `Speculative hand but good position and deep stacks.`
        });
      }
      actions.push({
        action: 'FOLD',
        confidence: Math.min(90, 70 + (5 - preflopTier) * 5),
        reason: `Weak hand. Equity ${equity.toFixed(1)}% is not enough to play profitably from ${position || 'this position'}.`
      });
    }

    // Sort by confidence
    actions.sort((a, b) => b.confidence - a.confidence);
    return actions;
  }

  // ---- POST-FLOP RECOMMENDATIONS ----
  // For post-flop, use equity vs breakeven equity (multi-way adjusted) + implied odds
  const edgeOverPot = effectiveEquity - potOdds;

  // Fold
  if (effectiveEquity < breakevenEquity * 0.7 && effectiveEquity < potOdds * 0.8) {
    actions.push({
      action: 'FOLD',
      confidence: Math.min(90, Math.round(90 - effectiveEquity)),
      reason: `Effective equity (${effectiveEquity.toFixed(1)}%) below breakeven (${breakevenEquity.toFixed(1)}%) and pot odds (${potOdds.toFixed(1)}%).`
    });
  } else if (effectiveEquity < potOdds && effectiveEquity < breakevenEquity) {
    actions.push({
      action: 'FOLD',
      confidence: Math.round(50 + (potOdds - effectiveEquity)),
      reason: `Equity (${effectiveEquity.toFixed(1)}%) below pot odds (${potOdds.toFixed(1)}%). Consider folding.`
    });
  }

  // Call
  if (effectiveEquity >= breakevenEquity && effectiveEquity >= potOdds * 0.85) {
    const callConf = Math.min(85, Math.round(50 + edgeOverPot * 1.5 + positionAdj));
    actions.push({
      action: 'CALL',
      confidence: Math.max(30, callConf),
      reason: `Effective equity ${effectiveEquity.toFixed(1)}% beats breakeven ${breakevenEquity.toFixed(1)}%. Profitable call.`
    });
  } else if (effectiveEquity >= potOdds) {
    actions.push({
      action: 'CALL',
      confidence: Math.round(45 + edgeOverPot),
      reason: `Equity (${effectiveEquity.toFixed(1)}%) exceeds pot odds (${potOdds.toFixed(1)}%).`
    });
  }

  // Raise
  if (equity > 50 && edgeOverBreakeven > 15) {
    actions.push({
      action: 'RAISE',
      confidence: Math.min(90, Math.round(equity * 0.8 + positionAdj)),
      reason: `Strong equity (${equity.toFixed(1)}%) well above breakeven. Value raise.`
    });
  } else if (equity > 30 && equity < 50 && phase === 'flop' && spr > 4) {
    actions.push({
      action: 'RAISE',
      confidence: Math.min(60, Math.round(30 + equity * 0.4 + positionAdj)),
      reason: `Medium equity with improvement potential. Semi-bluff with SPR ${spr.toFixed(1)}.`
    });
  }

  // All-in
  if (equity > 70) {
    actions.push({
      action: 'ALL-IN',
      confidence: Math.min(95, Math.round(equity * 0.9)),
      reason: `Very strong equity (${equity.toFixed(1)}%). Maximum value.`
    });
  } else if (stackSize > 0 && potSize / stackSize > 0.4 && equity > 45) {
    actions.push({
      action: 'ALL-IN',
      confidence: Math.round(equity * 0.65),
      reason: `Pot-committed (SPR ${spr.toFixed(1)}). Push equity advantage.`
    });
  }

  // Check/Bet (when no bet to call)
  if (potOdds === 0) {
    if (equity > 50) {
      actions.push({
        action: 'BET',
        confidence: Math.min(85, Math.round(equity * 0.75 + positionAdj)),
        reason: `No bet to face. Strong enough to bet for value.`
      });
    } else {
      actions.push({
        action: 'CHECK',
        confidence: Math.round(65 - equity * 0.3),
        reason: `No bet to face. Check and evaluate.`
      });
    }
  }

  // Sort by confidence
  actions.sort((a, b) => b.confidence - a.confidence);
  return actions;
}

// ---- Hand Strength Description ----

function describeHandStrength(heroCards, board) {
  if (board.length < 3) {
    return describePreflopHand(heroCards);
  }

  const fullHand = [...heroCards, ...board];
  const eval_ = evaluateHand(fullHand);
  const handName = HAND_NAMES[eval_.ranking];

  return {
    name: handName,
    ranking: eval_.ranking,
    description: getHandDescription(eval_, heroCards, board)
  };
}

function describePreflopHand(heroCards) {
  const r1 = cardRankValue(heroCards[0]);
  const r2 = cardRankValue(heroCards[1]);
  const suited = cardSuit(heroCards[0]) === cardSuit(heroCards[1]);
  const pair = r1 === r2;

  let tier;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);

  if (pair && high >= 10) tier = 'Premium Pair';
  else if (pair && high >= 7) tier = 'Medium Pair';
  else if (pair) tier = 'Small Pair';
  else if (high === 12 && low >= 10) tier = 'Premium Broadway';
  else if (high === 12 && low >= 8 && suited) tier = 'Strong Suited Ace';
  else if (high >= 10 && low >= 9) tier = 'Broadway';
  else if (suited && high - low <= 2 && high >= 5) tier = 'Suited Connector';
  else if (suited && high - low <= 3 && high >= 6) tier = 'Suited One-Gapper';
  else if (high === 12) tier = 'Ace-x';
  else if (high >= 10 && low >= 7) tier = 'Decent';
  else tier = 'Speculative';

  const preflopEquity = getPreflopEquity(heroCards);

  return {
    name: tier,
    ranking: -1,
    description: `${formatCard(heroCards[0])} ${formatCard(heroCards[1])} — ${tier}${suited ? ' (suited)' : ''}. Approximate preflop equity vs 1 random hand: ${preflopEquity.toFixed(1)}%`
  };
}

function getPreflopEquity(heroCards) {
  const r1 = cardRankValue(heroCards[0]);
  const r2 = cardRankValue(heroCards[1]);
  const suited = cardSuit(heroCards[0]) === cardSuit(heroCards[1]);
  const pair = r1 === r2;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);

  // Approximate preflop equities
  if (pair) {
    const pairEquities = [50.3, 52.8, 54.8, 57.0, 59.1, 61.2, 63.3, 66.2, 69.2, 72.1, 75.1, 77.5, 80.1, 85.3];
    return pairEquities[high] || 55;
  }

  let base = 30 + (high + low) * 1.5;
  if (suited) base += 3;
  if (high - low <= 1) base += 2;
  if (high - low <= 2) base += 1;
  if (high === 12) base += 5;

  return Math.min(67, Math.max(28, base));
}

function getHandDescription(eval_, heroCards, board) {
  const handName = HAND_NAMES[eval_.ranking];
  const heroFormatted = heroCards.map(formatCard).join(' ');

  switch (eval_.ranking) {
    case 9: return `${heroFormatted} — ${handName}! The absolute nuts!`;
    case 8: return `${heroFormatted} — ${handName}! Extremely strong hand.`;
    case 7: return `${heroFormatted} — ${handName}. Monster hand, very hard to beat.`;
    case 6: return `${heroFormatted} — ${handName}. Very strong made hand.`;
    case 5: return `${heroFormatted} — ${handName}. Strong hand, watch for board pairing.`;
    case 4: return `${heroFormatted} — ${handName}. Solid hand.`;
    case 3: return `${heroFormatted} — ${handName}. Good hand, but vulnerable.`;
    case 2: return `${heroFormatted} — ${handName}. Decent hand, proceed with caution.`;
    case 1: return `${heroFormatted} — ${handName}. Marginal hand.`;
    default: return `${heroFormatted} — ${handName}. Weak hand.`;
  }
}

// ---- Outs Calculator ----

function calculateOuts(heroCards, board) {
  if (board.length >= 5 || board.length < 3) return { outs: 0, draws: [] };

  const fullHand = [...heroCards, ...board];
  const currentEval = evaluateHand(fullHand);
  const knownCards = new Set(fullHand);
  const remaining = createDeck().filter(c => !knownCards.has(c));

  let outs = 0;
  const improvingCards = [];
  const draws = [];

  for (const card of remaining) {
    const newHand = [...fullHand, card];
    // We need 7 cards for evaluation, pad if needed
    let evalCards;
    if (newHand.length === 6) {
      // Simulate with each remaining card
      evalCards = newHand;
      // Can't fully evaluate with 6, let's check all 5-card combos
      const bestWith = evaluateBestFrom6(newHand);
      if (bestWith && compareHands(bestWith, currentEval) > 0) {
        outs++;
        improvingCards.push({ card, to: HAND_NAMES[bestWith.ranking] });
      }
    } else if (newHand.length === 7) {
      const newEval = evaluateHand(newHand);
      if (compareHands(newEval, currentEval) > 0) {
        outs++;
        improvingCards.push({ card, to: HAND_NAMES[newEval.ranking] });
      }
    }
  }

  // Categorize draws
  const drawTypes = {};
  for (const imp of improvingCards) {
    if (!drawTypes[imp.to]) drawTypes[imp.to] = [];
    drawTypes[imp.to].push(imp.card);
  }

  for (const [handName, cards] of Object.entries(drawTypes)) {
    draws.push({
      name: handName,
      cards: cards,
      count: cards.length
    });
  }

  // Calculate probability
  const cardsTocome = 5 - board.length;
  let probability;
  if (cardsTocome === 2) {
    probability = 1 - ((remaining.length - outs) / remaining.length) * ((remaining.length - outs - 1) / (remaining.length - 1));
  } else {
    probability = outs / remaining.length;
  }

  return {
    outs,
    probability: probability * 100,
    draws: draws.sort((a, b) => b.count - a.count)
  };
}

function evaluateBestFrom6(sixCards) {
  const combos = combinations(sixCards, 5);
  let best = null;
  for (const combo of combos) {
    const hand = evaluate5Cards(combo);
    if (!best || compareHands(hand, best) > 0) {
      best = hand;
    }
  }
  return best;
}

// ---- Position Information ----

const POSITIONS = {
  'BTN': { name: 'Button', description: 'Best position. Acts last post-flop.', openRange: 45 },
  'CO': { name: 'Cutoff', description: 'Second best position. Wide opening range.', openRange: 35 },
  'MP': { name: 'Middle Position', description: 'Moderate opening range.', openRange: 20 },
  'UTG': { name: 'Under the Gun', description: 'First to act. Tight opening range.', openRange: 15 },
  'SB': { name: 'Small Blind', description: 'Out of position post-flop. Careful play needed.', openRange: 30 },
  'BB': { name: 'Big Blind', description: 'Last to act pre-flop, first post-flop. Defend wisely.', openRange: 40 }
};

// ---- Export ----

window.PokerEngine = {
  RANKS, SUITS, SUIT_SYMBOLS, SUIT_NAMES, RANK_NAMES,
  HAND_RANKINGS, HAND_NAMES, POSITIONS,
  createDeck, shuffleDeck, formatCard,
  cardRank, cardSuit, cardRankValue, rankValue,
  evaluateHand, evaluate5Cards, compareHands,
  calculateEquity, calculatePotOdds, getRecommendation,
  describeHandStrength, calculateOuts,
  combinations
};
