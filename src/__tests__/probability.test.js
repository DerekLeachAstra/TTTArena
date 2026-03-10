import { describe, it, expect } from 'vitest';
import { classicProbability, ultimateProbability, megaProbability } from '../ai/probability';

describe('classicProbability', () => {
  it('returns ~50/50 for an empty board', () => {
    const p = classicProbability(Array(9).fill(null), 'X');
    expect(p.x).toBeGreaterThanOrEqual(40);
    expect(p.x).toBeLessThanOrEqual(60);
    expect(p.x + p.o).toBe(100);
  });

  it('returns 100/0 when X has already won', () => {
    const cells = ['X','X','X',null,null,null,null,null,null];
    expect(classicProbability(cells, 'O')).toEqual({ x: 100, o: 0 });
  });

  it('returns 0/100 when O has already won', () => {
    const cells = ['O','O','O',null,null,null,null,null,null];
    expect(classicProbability(cells, 'X')).toEqual({ x: 0, o: 100 });
  });

  it('returns 50/50 on a draw', () => {
    const cells = ['X','O','X','X','O','O','O','X','X'];
    expect(classicProbability(cells, 'X')).toEqual({ x: 50, o: 50 });
  });

  it('shows near-certain win for X when X can win next move', () => {
    // X in 0,1 needs 2 to win
    const cells = ['X','X',null,null,null,null,null,null,null];
    const p = classicProbability(cells, 'X');
    expect(p.x).toBe(99);
    expect(p.o).toBe(1);
  });
});

describe('ultimateProbability', () => {
  it('returns ~50/50 for an empty board', () => {
    const boards = Array(9).fill(null).map(() => Array(9).fill(null));
    const bWins = Array(9).fill(null);
    const p = ultimateProbability(boards, bWins, null);
    expect(p.x + p.o).toBe(100);
    expect(p.x).toBeGreaterThanOrEqual(40);
    expect(p.x).toBeLessThanOrEqual(60);
  });

  it('returns 100/0 when X wins meta-board', () => {
    const boards = Array(9).fill(null).map(() => Array(9).fill(null));
    const bWins = ['X','X','X',null,null,null,null,null,null];
    expect(ultimateProbability(boards, bWins, null)).toEqual({ x: 100, o: 0 });
  });

  it('returns 0/100 when O wins meta-board', () => {
    const boards = Array(9).fill(null).map(() => Array(9).fill(null));
    const bWins = ['O','O','O',null,null,null,null,null,null];
    expect(ultimateProbability(boards, bWins, null)).toEqual({ x: 0, o: 100 });
  });
});

describe('megaProbability', () => {
  it('returns ~50/50 for an empty board', () => {
    const smallW = Array(9).fill(null).map(() => Array(9).fill(null));
    const midW = Array(9).fill(null);
    const p = megaProbability(smallW, midW);
    expect(p.x + p.o).toBe(100);
    expect(p.x).toBeGreaterThanOrEqual(40);
    expect(p.x).toBeLessThanOrEqual(60);
  });

  it('returns 100/0 when X wins meta', () => {
    const smallW = Array(9).fill(null).map(() => Array(9).fill(null));
    const midW = ['X','X','X',null,null,null,null,null,null];
    expect(megaProbability(smallW, midW)).toEqual({ x: 100, o: 0 });
  });

  it('returns 0/100 when O wins meta', () => {
    const smallW = Array(9).fill(null).map(() => Array(9).fill(null));
    const midW = ['O','O','O',null,null,null,null,null,null];
    expect(megaProbability(smallW, midW)).toEqual({ x: 0, o: 100 });
  });
});
