import { describe, it, expect } from 'vitest';
import { MILESTONES, ACHIEVEMENTS, TIER_COLORS, milestoneProgress } from '../lib/trophyDefinitions';

/* ---------- MILESTONES ---------- */
describe('MILESTONES', () => {
  it('has 18 milestones', () => {
    expect(MILESTONES).toHaveLength(18);
  });

  it('all have required fields', () => {
    for (const m of MILESTONES) {
      expect(m.key).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.description).toBeTruthy();
      expect(m.tier).toBeTruthy();
      expect(m.category).toBeTruthy();
    }
  });

  it('all keys are unique', () => {
    const keys = MILESTONES.map(m => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('all tiers are valid', () => {
    const validTiers = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    for (const m of MILESTONES) {
      expect(validTiers).toContain(m.tier);
    }
  });

  it('all categories are valid', () => {
    const validCats = ['wins', 'games', 'rank', 'special', 'social'];
    for (const m of MILESTONES) {
      expect(validCats).toContain(m.category);
    }
  });

  it('win milestones have ascending thresholds', () => {
    const wins = MILESTONES.filter(m => m.category === 'wins');
    for (let i = 1; i < wins.length; i++) {
      expect(wins[i].threshold).toBeGreaterThan(wins[i - 1].threshold);
    }
  });

  it('games milestones have ascending thresholds', () => {
    const games = MILESTONES.filter(m => m.category === 'games');
    for (let i = 1; i < games.length; i++) {
      expect(games[i].threshold).toBeGreaterThan(games[i - 1].threshold);
    }
  });

  it('rank milestones have ascending ELO thresholds', () => {
    const ranks = MILESTONES.filter(m => m.category === 'rank');
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i].eloThreshold).toBeGreaterThan(ranks[i - 1].eloThreshold);
    }
  });
});

/* ---------- ACHIEVEMENTS ---------- */
describe('ACHIEVEMENTS', () => {
  it('has 12 achievements', () => {
    expect(ACHIEVEMENTS).toHaveLength(12);
  });

  it('all have required fields', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.key).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.icon).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.hint).toBeTruthy();
    }
  });

  it('all keys are unique', () => {
    const keys = ACHIEVEMENTS.map(a => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('no key overlap with milestones', () => {
    const milestoneKeys = new Set(MILESTONES.map(m => m.key));
    for (const a of ACHIEVEMENTS) {
      expect(milestoneKeys.has(a.key)).toBe(false);
    }
  });
});

/* ---------- TIER_COLORS ---------- */
describe('TIER_COLORS', () => {
  it('has all 5 tiers', () => {
    expect(Object.keys(TIER_COLORS)).toHaveLength(5);
    expect(TIER_COLORS).toHaveProperty('bronze');
    expect(TIER_COLORS).toHaveProperty('silver');
    expect(TIER_COLORS).toHaveProperty('gold');
    expect(TIER_COLORS).toHaveProperty('platinum');
    expect(TIER_COLORS).toHaveProperty('diamond');
  });
});

/* ---------- milestoneProgress ---------- */
describe('milestoneProgress', () => {
  const stats = [
    { wins: 30, losses: 15, draws: 5, elo_rating: 1350, game_mode: 'classic' },
    { wins: 20, losses: 10, draws: 2, elo_rating: 1250, game_mode: 'ultimate' },
  ];

  it('computes win milestone progress', () => {
    const m = MILESTONES.find(m => m.key === 'wins_100');
    const p = milestoneProgress(m, stats);
    expect(p.current).toBe(50); // 30 + 20
    expect(p.target).toBe(100);
    expect(p.pct).toBe(50);
  });

  it('computes games milestone progress', () => {
    const m = MILESTONES.find(m => m.key === 'games_100');
    const p = milestoneProgress(m, stats);
    // total = (30+15+5) + (20+10+2) = 82
    expect(p.current).toBe(82);
    expect(p.target).toBe(100);
    expect(p.pct).toBeCloseTo(82, 0);
  });

  it('computes rank milestone progress using max ELO', () => {
    const m = MILESTONES.find(m => m.key === 'rank_gold');
    const p = milestoneProgress(m, stats);
    expect(p.current).toBe(1350); // max of 1350, 1250
    expect(p.target).toBe(1400);
    expect(p.pct).toBeCloseTo((1350 / 1400) * 100, 0);
  });

  it('caps progress at 100%', () => {
    const m = MILESTONES.find(m => m.key === 'wins_10');
    const p = milestoneProgress(m, stats);
    expect(p.pct).toBe(100);
  });

  it('returns null for special milestones', () => {
    const m = MILESTONES.find(m => m.key === 'first_draw');
    const p = milestoneProgress(m, stats);
    expect(p).toBeNull();
  });

  it('returns null for social milestones', () => {
    const m = MILESTONES.find(m => m.key === 'join_league');
    const p = milestoneProgress(m, stats);
    expect(p).toBeNull();
  });

  it('handles empty stats', () => {
    const m = MILESTONES.find(m => m.key === 'wins_10');
    const p = milestoneProgress(m, []);
    expect(p.current).toBe(0);
    expect(p.target).toBe(10);
    expect(p.pct).toBe(0);
  });
});
