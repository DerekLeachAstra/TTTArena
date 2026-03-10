import { describe, it, expect } from 'vitest';
import { checkNickname } from '../lib/profanityFilter';

describe('checkNickname', () => {
  it('allows clean nicknames', () => {
    expect(checkNickname('Player1')).toEqual({ blocked: false, reason: '' });
    expect(checkNickname('TheChamp')).toEqual({ blocked: false, reason: '' });
    expect(checkNickname('CoolCat99')).toEqual({ blocked: false, reason: '' });
  });

  it('blocks explicit words', () => {
    expect(checkNickname('fuck').blocked).toBe(true);
    expect(checkNickname('shit').blocked).toBe(true);
  });

  it('blocks slurs', () => {
    expect(checkNickname('nigger').blocked).toBe(true);
    expect(checkNickname('faggot').blocked).toBe(true);
  });

  it('is case insensitive', () => {
    expect(checkNickname('FUCK').blocked).toBe(true);
    expect(checkNickname('Shit').blocked).toBe(true);
    expect(checkNickname('fUcK').blocked).toBe(true);
  });

  it('catches leet-speak evasions', () => {
    expect(checkNickname('f4ggot').blocked).toBe(true);
    expect(checkNickname('sh1t').blocked).toBe(true);
    expect(checkNickname('n1gger').blocked).toBe(true);
  });

  it('catches words embedded in other text', () => {
    expect(checkNickname('superfuck123').blocked).toBe(true);
    expect(checkNickname('xNigg3rx').blocked).toBe(true);
  });

  it('handles null/undefined/empty gracefully', () => {
    expect(checkNickname(null)).toEqual({ blocked: false, reason: '' });
    expect(checkNickname(undefined)).toEqual({ blocked: false, reason: '' });
    expect(checkNickname('')).toEqual({ blocked: false, reason: '' });
  });

  it('provides a reason when blocked', () => {
    const result = checkNickname('asshole');
    expect(result.blocked).toBe(true);
    expect(result.reason).toContain('inappropriate');
  });
});
