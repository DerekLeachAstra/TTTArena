import { describe, it, expect } from 'vitest';
import { nextPowerOf2, seedOrder, generateBracket, advanceWinner, isSeriesDecided } from '../lib/bracketUtils';

/* ---------- nextPowerOf2 ---------- */
describe('nextPowerOf2', () => {
  it('returns 1 for 1', () => expect(nextPowerOf2(1)).toBe(1));
  it('returns 2 for 2', () => expect(nextPowerOf2(2)).toBe(2));
  it('returns 4 for 3', () => expect(nextPowerOf2(3)).toBe(4));
  it('returns 8 for 5', () => expect(nextPowerOf2(5)).toBe(8));
  it('returns 8 for 8', () => expect(nextPowerOf2(8)).toBe(8));
  it('returns 16 for 9', () => expect(nextPowerOf2(9)).toBe(16));
  it('returns 16 for 16', () => expect(nextPowerOf2(16)).toBe(16));
});

/* ---------- seedOrder ---------- */
describe('seedOrder', () => {
  it('returns [1] for size 1', () => {
    expect(seedOrder(1)).toEqual([1]);
  });

  it('returns [1, 2] for size 2', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
  });

  it('returns standard 4-seed order', () => {
    const order = seedOrder(4);
    expect(order).toEqual([1, 4, 2, 3]);
  });

  it('returns standard 8-seed order (1v8, 4v5, 2v7, 3v6)', () => {
    const order = seedOrder(8);
    expect(order).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('pairs top seed vs bottom seed', () => {
    const order = seedOrder(16);
    // First pair should be 1 vs 16
    expect(order[0]).toBe(1);
    expect(order[1]).toBe(16);
  });

  it('contains all seeds exactly once', () => {
    for (const size of [4, 8, 16]) {
      const order = seedOrder(size);
      const sorted = [...order].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: size }, (_, i) => i + 1));
    }
  });
});

/* ---------- generateBracket ---------- */
describe('generateBracket', () => {
  const makePlayers = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, seed: i + 1 }));

  it('throws for fewer than 2 participants', () => {
    expect(() => generateBracket([{ id: 'p1', seed: 1 }])).toThrow('at least 2');
  });

  it('generates a 2-player bracket', () => {
    const { rounds, matches } = generateBracket(makePlayers(2));
    expect(rounds).toHaveLength(1);
    expect(rounds[0].name).toBe('Final');
    expect(matches).toHaveLength(1);
    expect(matches[0].playerA.id).toBe('p1');
    expect(matches[0].playerB.id).toBe('p2');
    expect(matches[0].status).toBe('pending');
  });

  it('generates a 4-player bracket with correct rounds', () => {
    const { rounds, matches } = generateBracket(makePlayers(4));
    expect(rounds).toHaveLength(2);
    expect(rounds[0].name).toBe('Semifinal');
    expect(rounds[1].name).toBe('Final');
    // 2 round-1 matches + 1 final
    expect(matches).toHaveLength(3);
  });

  it('generates an 8-player bracket with correct round names', () => {
    const { rounds, matches } = generateBracket(makePlayers(8));
    expect(rounds).toHaveLength(3);
    expect(rounds[0].name).toBe('Quarterfinal');
    expect(rounds[1].name).toBe('Semifinal');
    expect(rounds[2].name).toBe('Final');
    // 4 + 2 + 1 = 7 matches
    expect(matches).toHaveLength(7);
  });

  it('generates a 16-player bracket with 4 rounds', () => {
    const { rounds, matches } = generateBracket(makePlayers(16));
    expect(rounds).toHaveLength(4);
    expect(rounds[0].name).toBe('Round 1');
    expect(rounds[1].name).toBe('Quarterfinal');
    expect(rounds[2].name).toBe('Semifinal');
    expect(rounds[3].name).toBe('Final');
    // 8 + 4 + 2 + 1 = 15 matches
    expect(matches).toHaveLength(15);
  });

  it('handles 3 players with 1 BYE', () => {
    const { matches } = generateBracket(makePlayers(3));
    // Bracket size = 4, so 3 matches total
    expect(matches).toHaveLength(3);
    const byes = matches.filter(m => m.isBye);
    expect(byes).toHaveLength(1);
    expect(byes[0].status).toBe('completed');
    expect(byes[0].winner).toBeTruthy();
  });

  it('handles 5 players with 3 BYEs', () => {
    const { matches } = generateBracket(makePlayers(5));
    // Bracket size = 8, so 7 matches total
    expect(matches).toHaveLength(7);
    const byes = matches.filter(m => m.isBye);
    expect(byes).toHaveLength(3);
  });

  it('handles 6 players with 2 BYEs', () => {
    const { matches } = generateBracket(makePlayers(6));
    const byes = matches.filter(m => m.isBye);
    expect(byes).toHaveLength(2);
  });

  it('auto-advances BYE winners into round 2', () => {
    const { matches } = generateBracket(makePlayers(3));
    // The BYE winner should already be placed in the final
    const finalMatch = matches.find(m => m.roundNumber === 2);
    const byeMatch = matches.find(m => m.isBye);
    // The BYE winner should appear as playerA or playerB in the final
    const byeWinner = byeMatch.winner;
    expect(
      finalMatch.playerA?.id === byeWinner.id || finalMatch.playerB?.id === byeWinner.id
    ).toBe(true);
  });

  it('links matches to next match with correct slots', () => {
    const { matches } = generateBracket(makePlayers(4));
    const round1 = matches.filter(m => m.roundNumber === 1);
    const final = matches.find(m => m.roundNumber === 2);
    expect(round1[0].nextMatchNumber).toBe(final.matchNumber);
    expect(round1[0].nextMatchSlot).toBe('a');
    expect(round1[1].nextMatchNumber).toBe(final.matchNumber);
    expect(round1[1].nextMatchSlot).toBe('b');
  });

  it('stores bestOf in the returned bracket', () => {
    const { bestOf } = generateBracket(makePlayers(4), 5);
    expect(bestOf).toBe(5);
  });

  it('assigns match numbers sequentially', () => {
    const { matches } = generateBracket(makePlayers(8));
    const numbers = matches.map(m => m.matchNumber);
    expect(numbers).toEqual(Array.from({ length: 7 }, (_, i) => i + 1));
  });
});

/* ---------- advanceWinner ---------- */
describe('advanceWinner', () => {
  it('sets winner and advances to next match slot A', () => {
    const { matches } = generateBracket([
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
      { id: 'p3', seed: 3 },
      { id: 'p4', seed: 4 },
    ]);
    const round1 = matches.filter(m => m.roundNumber === 1);
    const winner = { id: 'p1', seed: 1 };
    const updated = advanceWinner(matches, round1[0].matchNumber, winner);

    const completedMatch = updated.find(m => m.matchNumber === round1[0].matchNumber);
    expect(completedMatch.winner.id).toBe('p1');
    expect(completedMatch.status).toBe('completed');

    const finalMatch = updated.find(m => m.roundNumber === 2);
    expect(finalMatch.playerA.id).toBe('p1');
  });

  it('marks next match as active when both players are set', () => {
    const { matches } = generateBracket([
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
      { id: 'p3', seed: 3 },
      { id: 'p4', seed: 4 },
    ]);
    const round1 = matches.filter(m => m.roundNumber === 1);

    let updated = advanceWinner(matches, round1[0].matchNumber, { id: 'p1', seed: 1 });
    updated = advanceWinner(updated, round1[1].matchNumber, { id: 'p3', seed: 3 });

    const finalMatch = updated.find(m => m.roundNumber === 2);
    expect(finalMatch.playerA.id).toBe('p1');
    expect(finalMatch.playerB.id).toBe('p3');
    expect(finalMatch.status).toBe('active');
  });

  it('does not mutate original matches array', () => {
    const { matches } = generateBracket([
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
    ]);
    const original = JSON.parse(JSON.stringify(matches));
    advanceWinner(matches, 1, { id: 'p1', seed: 1 });
    expect(matches).toEqual(original);
  });

  it('returns unchanged array for unknown match number', () => {
    const { matches } = generateBracket([
      { id: 'p1', seed: 1 },
      { id: 'p2', seed: 2 },
    ]);
    const updated = advanceWinner(matches, 999, { id: 'p1', seed: 1 });
    expect(updated).toHaveLength(matches.length);
  });
});

/* ---------- isSeriesDecided ---------- */
describe('isSeriesDecided', () => {
  it('best-of-1: 1 win decides', () => {
    expect(isSeriesDecided(1, 0, 1)).toEqual({ decided: true, winner: 'a' });
    expect(isSeriesDecided(0, 1, 1)).toEqual({ decided: true, winner: 'b' });
    expect(isSeriesDecided(0, 0, 1)).toEqual({ decided: false, winner: null });
  });

  it('best-of-3: 2 wins needed', () => {
    expect(isSeriesDecided(2, 0, 3)).toEqual({ decided: true, winner: 'a' });
    expect(isSeriesDecided(2, 1, 3)).toEqual({ decided: true, winner: 'a' });
    expect(isSeriesDecided(1, 2, 3)).toEqual({ decided: true, winner: 'b' });
    expect(isSeriesDecided(1, 1, 3)).toEqual({ decided: false, winner: null });
    expect(isSeriesDecided(0, 0, 3)).toEqual({ decided: false, winner: null });
  });

  it('best-of-5: 3 wins needed', () => {
    expect(isSeriesDecided(3, 0, 5)).toEqual({ decided: true, winner: 'a' });
    expect(isSeriesDecided(3, 2, 5)).toEqual({ decided: true, winner: 'a' });
    expect(isSeriesDecided(2, 3, 5)).toEqual({ decided: true, winner: 'b' });
    expect(isSeriesDecided(2, 2, 5)).toEqual({ decided: false, winner: null });
  });

  it('best-of-7: 4 wins needed', () => {
    expect(isSeriesDecided(4, 3, 7)).toEqual({ decided: true, winner: 'a' });
    expect(isSeriesDecided(3, 4, 7)).toEqual({ decided: true, winner: 'b' });
    expect(isSeriesDecided(3, 3, 7)).toEqual({ decided: false, winner: null });
  });
});
