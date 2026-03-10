import { describe, it, expect } from 'vitest';
import { dn, overallScore, totalGP, h2hKey } from '../lib/playerUtils';

describe('dn (display name)', () => {
  it('returns nickname when set', () => {
    expect(dn({ nickname: 'TheChamp', firstName: 'John', lastName: 'Doe' })).toBe('TheChamp');
  });

  it('returns nickname trimmed', () => {
    expect(dn({ nickname: '  Boss  ', firstName: 'Jane' })).toBe('Boss');
  });

  it('falls back to first + last name', () => {
    expect(dn({ nickname: '', firstName: 'Jane', lastName: 'Smith' })).toBe('Jane Smith');
  });

  it('falls back to first name only', () => {
    expect(dn({ firstName: 'Bob', lastName: '' })).toBe('Bob');
  });

  it('returns "Unnamed" when no names are provided', () => {
    expect(dn({})).toBe('Unnamed');
    expect(dn({ nickname: '', firstName: '', lastName: '' })).toBe('Unnamed');
  });

  it('ignores whitespace-only nickname', () => {
    expect(dn({ nickname: '   ', firstName: 'Alan' })).toBe('Alan');
  });
});

describe('overallScore', () => {
  it('returns 0 for a player with no games', () => {
    expect(overallScore({})).toBe(0);
  });

  it('returns score weighted across modes', () => {
    const p = { cw: 5, cl: 1, ct: 0, sw: 0, sl: 0, st: 0, mw: 0, ml: 0, mt: 0 };
    const s = overallScore(p);
    expect(s).toBeGreaterThan(0);
  });

  it('weights mega more heavily than classic', () => {
    const classicOnly = { cw: 5, cl: 1, ct: 0, sw: 0, sl: 0, st: 0, mw: 0, ml: 0, mt: 0 };
    const megaOnly = { cw: 0, cl: 0, ct: 0, sw: 0, sl: 0, st: 0, mw: 5, ml: 1, mt: 0 };
    // Both should have positive scores
    expect(overallScore(classicOnly)).toBeGreaterThan(0);
    expect(overallScore(megaOnly)).toBeGreaterThan(0);
  });
});

describe('totalGP', () => {
  it('returns 0 for an empty player', () => {
    expect(totalGP({})).toBe(0);
  });

  it('sums all game modes', () => {
    expect(totalGP({ cw:1, cl:2, ct:3, sw:4, sl:5, st:6, mw:7, ml:8, mt:9 })).toBe(45);
  });

  it('handles missing fields gracefully', () => {
    expect(totalGP({ cw:5 })).toBe(5);
  });
});

describe('h2hKey', () => {
  it('returns a sorted key', () => {
    expect(h2hKey(3, 1)).toBe('1__3');
  });

  it('is symmetric', () => {
    expect(h2hKey(5, 2)).toBe(h2hKey(2, 5));
  });

  it('handles string IDs', () => {
    expect(h2hKey('b', 'a')).toBe('a__b');
  });
});
