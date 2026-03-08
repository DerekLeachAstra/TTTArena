import { describe, it, expect } from 'vitest';
import { checkWin, getWinLine, calcElo, getRankBadge, score, getValidMoves, WIN_LINES } from '../lib/gameLogic';

describe('checkWin', () => {
  it('returns null for an empty board', () => {
    expect(checkWin(Array(9).fill(null))).toBe(null);
  });

  it('returns null for an in-progress board', () => {
    const cells = [null, 'X', 'O', null, 'X', null, null, null, null];
    expect(checkWin(cells)).toBe(null);
  });

  it('detects X winning on all 8 win lines', () => {
    for (const [a, b, c] of WIN_LINES) {
      const cells = Array(9).fill(null);
      cells[a] = 'X'; cells[b] = 'X'; cells[c] = 'X';
      expect(checkWin(cells)).toBe('X');
    }
  });

  it('detects O winning on all 8 win lines', () => {
    for (const [a, b, c] of WIN_LINES) {
      const cells = Array(9).fill(null);
      cells[a] = 'O'; cells[b] = 'O'; cells[c] = 'O';
      expect(checkWin(cells)).toBe('O');
    }
  });

  it('returns "T" for a fully filled board with no winner', () => {
    // X O X / X O O / O X X — no three in a row
    const cells = ['X','O','X','X','O','O','O','X','X'];
    expect(checkWin(cells)).toBe('T');
  });

  it('does not treat "T" as a winning mark', () => {
    const cells = ['T','T','T',null,null,null,null,null,null];
    expect(checkWin(cells)).toBe(null);
  });
});

describe('getWinLine', () => {
  it('returns the winning line indices', () => {
    const cells = ['X','X','X',null,null,null,null,null,null];
    expect(getWinLine(cells)).toEqual([0,1,2]);
  });

  it('returns empty array when no winner', () => {
    expect(getWinLine(Array(9).fill(null))).toEqual([]);
  });

  it('returns diagonal win line', () => {
    const cells = ['X',null,null,null,'X',null,null,null,'X'];
    expect(getWinLine(cells)).toEqual([0,4,8]);
  });
});

describe('getValidMoves', () => {
  it('returns all 9 indices for an empty board', () => {
    expect(getValidMoves(Array(9).fill(null))).toEqual([0,1,2,3,4,5,6,7,8]);
  });

  it('returns only empty indices', () => {
    const cells = ['X',null,'O',null,'X',null,null,null,'O'];
    expect(getValidMoves(cells)).toEqual([1,3,5,6,7]);
  });

  it('returns empty array for a full board', () => {
    expect(getValidMoves(Array(9).fill('X'))).toEqual([]);
  });
});

describe('calcElo', () => {
  it('returns +10/-30 when higher-rated player wins', () => {
    const { winnerDelta, loserDelta } = calcElo(1500, 1200);
    expect(winnerDelta).toBe(10);
    expect(loserDelta).toBe(-30);
  });

  it('returns +30/-10 when lower-rated player wins (upset)', () => {
    const { winnerDelta, loserDelta } = calcElo(1200, 1500);
    expect(winnerDelta).toBe(30);
    expect(loserDelta).toBe(-10);
  });

  it('returns +10/-30 when equal-rated players (winner = higher)', () => {
    const { winnerDelta, loserDelta } = calcElo(1200, 1200);
    expect(winnerDelta).toBe(10);
    expect(loserDelta).toBe(-30);
  });

  it('returns +5/+5 on draw', () => {
    const { winnerDelta, loserDelta } = calcElo(1500, 1200, true);
    expect(winnerDelta).toBe(5);
    expect(loserDelta).toBe(5);
  });
});

describe('getRankBadge', () => {
  it('returns Bronze for low ELO', () => {
    expect(getRankBadge(1100).name).toBe('Bronze');
  });

  it('returns Silver for 1200+', () => {
    expect(getRankBadge(1200).name).toBe('Silver');
  });

  it('returns Gold for 1400+', () => {
    expect(getRankBadge(1400).name).toBe('Gold');
  });

  it('returns Platinum for 1600+', () => {
    expect(getRankBadge(1600).name).toBe('Platinum');
  });

  it('returns Diamond for 1800+', () => {
    expect(getRankBadge(1800).name).toBe('Diamond');
    expect(getRankBadge(2000).name).toBe('Diamond');
  });
});

describe('score', () => {
  it('returns 0 for zero games', () => {
    expect(score(0, 0, 0)).toBe(0);
  });

  it('returns high score for all wins', () => {
    const s = score(10, 0, 0);
    expect(s).toBeGreaterThan(50);
  });

  it('returns lower score for all losses', () => {
    const s = score(0, 10, 0);
    expect(s).toBeLessThan(25);
  });

  it('returns moderate score for all ties', () => {
    const s = score(0, 0, 10);
    expect(s).toBeGreaterThan(20);
    expect(s).toBeLessThan(50);
  });

  it('score increases with more games played up to 19', () => {
    const s5 = score(5, 0, 0);
    const s19 = score(19, 0, 0);
    expect(s19).toBeGreaterThan(s5);
  });
});
