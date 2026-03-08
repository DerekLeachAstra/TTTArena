/**
 * Bracket generation utilities for single-elimination tournaments.
 * Handles seeding, byes, and bracket advancement.
 */

/**
 * Get the next power of 2 >= n.
 */
export function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Generate standard tournament seed order for a bracket of given size.
 * E.g., for size=8: [1,8,4,5,2,7,3,6] — ensures 1 vs 8, 4 vs 5, etc.
 * @param {number} size - Must be a power of 2
 * @returns {number[]} Seed positions in bracket order
 */
export function seedOrder(size) {
  if (size === 1) return [1];
  if (size === 2) return [1, 2];

  const half = seedOrder(size / 2);
  const result = [];
  for (const seed of half) {
    result.push(seed, size + 1 - seed);
  }
  return result;
}

/**
 * Generate a single-elimination bracket from participants.
 * @param {Array<{id: string, seed: number}>} participants - Sorted by seed (1 = best)
 * @param {number} bestOf - Best of 1, 3, 5, or 7
 * @returns {{ rounds: object[], matches: object[] }}
 */
export function generateBracket(participants, bestOf = 1) {
  const n = participants.length;
  if (n < 2) throw new Error('Need at least 2 participants');

  const bracketSize = nextPowerOf2(n);
  const numRounds = Math.log2(bracketSize);
  const order = seedOrder(bracketSize);

  // Map seed positions to participants (or BYE)
  const slots = order.map((seedPos, idx) => {
    const participant = participants[seedPos - 1] || null; // null = BYE
    return participant;
  });

  // Build rounds and matches
  const rounds = [];
  const allMatches = [];
  let matchCounter = 0;

  // Round names
  const roundNames = (numRounds) => {
    const names = [];
    for (let r = 0; r < numRounds; r++) {
      if (r === numRounds - 1) names.push('Final');
      else if (r === numRounds - 2) names.push('Semifinal');
      else if (r === numRounds - 3) names.push('Quarterfinal');
      else names.push(`Round ${r + 1}`);
    }
    return names;
  };

  const names = roundNames(numRounds);

  // Create all rounds
  for (let r = 0; r < numRounds; r++) {
    rounds.push({
      roundNumber: r + 1,
      name: names[r],
      matchCount: bracketSize / Math.pow(2, r + 1),
    });
  }

  // Create round 1 matches
  const round1Matches = [];
  for (let i = 0; i < slots.length; i += 2) {
    const playerA = slots[i];
    const playerB = slots[i + 1];
    const isBye = !playerA || !playerB;

    matchCounter++;
    const match = {
      matchNumber: matchCounter,
      roundNumber: 1,
      playerA: playerA,
      playerB: playerB,
      isBye,
      winner: isBye ? (playerA || playerB) : null,
      status: isBye ? 'completed' : 'pending',
      playerAWins: 0,
      playerBWins: 0,
      nextMatchSlot: null, // set below
    };
    round1Matches.push(match);
    allMatches.push(match);
  }

  // Create subsequent rounds (empty, filled as winners advance)
  let prevRoundMatches = round1Matches;
  for (let r = 1; r < numRounds; r++) {
    const currentRoundMatches = [];
    for (let i = 0; i < prevRoundMatches.length; i += 2) {
      matchCounter++;
      const match = {
        matchNumber: matchCounter,
        roundNumber: r + 1,
        playerA: null,
        playerB: null,
        isBye: false,
        winner: null,
        status: 'pending',
        playerAWins: 0,
        playerBWins: 0,
        nextMatchSlot: null,
      };

      // Link previous matches to this one
      prevRoundMatches[i].nextMatchNumber = matchCounter;
      prevRoundMatches[i].nextMatchSlot = 'a';
      prevRoundMatches[i + 1].nextMatchNumber = matchCounter;
      prevRoundMatches[i + 1].nextMatchSlot = 'b';

      currentRoundMatches.push(match);
      allMatches.push(match);
    }
    prevRoundMatches = currentRoundMatches;
  }

  // Auto-advance BYE winners into round 2
  for (const match of allMatches) {
    if (match.isBye && match.winner && match.nextMatchNumber) {
      const nextMatch = allMatches.find(m => m.matchNumber === match.nextMatchNumber);
      if (nextMatch) {
        if (match.nextMatchSlot === 'a') nextMatch.playerA = match.winner;
        else nextMatch.playerB = match.winner;
      }
    }
  }

  return { rounds, matches: allMatches, bestOf };
}

/**
 * Advance a winner through the bracket after a match is decided.
 * @param {object[]} matches - All bracket matches
 * @param {number} matchNumber - The completed match number
 * @param {object} winner - The winner participant
 * @returns {object[]} Updated matches array
 */
export function advanceWinner(matches, matchNumber, winner) {
  const updated = matches.map(m => ({ ...m }));
  const match = updated.find(m => m.matchNumber === matchNumber);
  if (!match) return updated;

  match.winner = winner;
  match.status = 'completed';

  if (match.nextMatchNumber) {
    const nextMatch = updated.find(m => m.matchNumber === match.nextMatchNumber);
    if (nextMatch) {
      if (match.nextMatchSlot === 'a') nextMatch.playerA = winner;
      else nextMatch.playerB = winner;

      // If both players are set and it's not a bye, mark as active
      if (nextMatch.playerA && nextMatch.playerB && !nextMatch.isBye) {
        nextMatch.status = 'active';
      }
    }
  }

  return updated;
}

/**
 * Check if a best-of series is decided.
 * @param {number} winsA
 * @param {number} winsB
 * @param {number} bestOf
 * @returns {{ decided: boolean, winner: 'a'|'b'|null }}
 */
export function isSeriesDecided(winsA, winsB, bestOf) {
  const needed = Math.ceil(bestOf / 2);
  if (winsA >= needed) return { decided: true, winner: 'a' };
  if (winsB >= needed) return { decided: true, winner: 'b' };
  return { decided: false, winner: null };
}
