import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing trophyChecker
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../lib/logger', () => ({
  logError: vi.fn(),
}));

import { checkMilestones, checkAchievements } from '../lib/trophyChecker';
import { supabase } from '../lib/supabase';

/**
 * Helper to create a chainable mock for supabase queries.
 * Usage: mockQuery(data) chains .select().eq().or().limit() etc. and resolves { data }.
 */
function mockQuery(data) {
  const chain = {
    select: vi.fn().mockReturnValue(chain),
    eq: vi.fn().mockReturnValue(chain),
    or: vi.fn().mockReturnValue(chain),
    limit: vi.fn().mockReturnValue(chain),
    order: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    // Terminal — resolves with data
    then: (resolve) => resolve({ data }),
  };
  // Make the chain thenable so await works
  chain[Symbol.for('vitest:thenable')] = true;
  return chain;
}

/** Create a proper thenable chain */
function createChain(finalData) {
  const handler = {
    get(target, prop) {
      if (prop === 'then') {
        return (resolve) => resolve({ data: finalData });
      }
      if (prop === 'catch') {
        return () => handler;
      }
      return (..._args) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

describe('checkMilestones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for null userId', async () => {
    const result = await checkMilestones(null);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty userId', async () => {
    const result = await checkMilestones('');
    expect(result).toEqual([]);
  });

  it('detects first_win milestone', async () => {
    const callCount = { n: 0 };
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_player_stats') {
        return createChain([
          { game_mode: 'classic', elo_rating: 1000, wins: 5, losses: 3, draws: 0 },
        ]);
      }
      if (table === 'ttt_league_members') return createChain([]);
      if (table === 'ttt_rivals') return createChain([]);
      if (table === 'ttt_milestones') {
        return createChain([{ milestone_key: 'first_win' }, { milestone_key: 'games_10' }]);
      }
      return createChain([]);
    });

    const result = await checkMilestones('user-1');
    // Should return keys from the insert response
    expect(result).toContain('first_win');
  });

  it('detects rank milestones based on ELO', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_player_stats') {
        return createChain([
          { game_mode: 'classic', elo_rating: 1500, wins: 100, losses: 50, draws: 10 },
          { game_mode: 'ultimate', elo_rating: 1300, wins: 50, losses: 20, draws: 5 },
        ]);
      }
      if (table === 'ttt_league_members') return createChain([]);
      if (table === 'ttt_rivals') return createChain([]);
      if (table === 'ttt_milestones') {
        return createChain([
          { milestone_key: 'rank_silver' },
          { milestone_key: 'rank_gold' },
        ]);
      }
      return createChain([]);
    });

    const result = await checkMilestones('user-2');
    // Max ELO = 1500 → silver (1200) and gold (1400) met, platinum (1600) not met
    expect(result).toContain('rank_silver');
    expect(result).toContain('rank_gold');
    expect(result).not.toContain('rank_platinum');
  });

  it('detects social milestones (league + rival)', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_player_stats') {
        return createChain([
          { game_mode: 'classic', elo_rating: 1000, wins: 1, losses: 0, draws: 0 },
        ]);
      }
      if (table === 'ttt_league_members') return createChain([{ id: 'lm-1' }]);
      if (table === 'ttt_rivals') return createChain([{ id: 'r-1' }]);
      if (table === 'ttt_milestones') {
        return createChain([
          { milestone_key: 'join_league' },
          { milestone_key: 'add_rival' },
        ]);
      }
      return createChain([]);
    });

    const result = await checkMilestones('user-3');
    expect(result).toContain('join_league');
    expect(result).toContain('add_rival');
  });

  it('returns empty when no milestones earned', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_player_stats') return createChain([]);
      if (table === 'ttt_league_members') return createChain([]);
      if (table === 'ttt_rivals') return createChain([]);
      return createChain([]);
    });

    const result = await checkMilestones('user-4');
    expect(result).toEqual([]);
  });
});

describe('checkAchievements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for null userId', async () => {
    const result = await checkAchievements(null);
    expect(result).toEqual([]);
  });

  it('detects upset_king when beating higher ELO', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain([]);
      if (table === 'ttt_league_stats') return createChain([]);
      if (table === 'ttt_achievements') {
        return createChain([{ achievement_key: 'upset_king' }]);
      }
      return createChain([]);
    });

    const result = await checkAchievements('user-1', {
      winnerId: 'user-1',
      myElo: 1000,
      opponentElo: 1250, // 250 gap >= 200
    });
    expect(result).toContain('upset_king');
  });

  it('does not grant upset_king when ELO gap < 200', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain([]);
      if (table === 'ttt_league_stats') return createChain([]);
      if (table === 'ttt_achievements') return createChain([]);
      return createChain([]);
    });

    const result = await checkAchievements('user-1', {
      winnerId: 'user-1',
      myElo: 1000,
      opponentElo: 1150, // 150 gap < 200
    });
    expect(result).not.toContain('upset_king');
  });

  it('detects giant_slayer when beating 1800+ opponent', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain([]);
      if (table === 'ttt_league_stats') return createChain([]);
      if (table === 'ttt_achievements') {
        return createChain([{ achievement_key: 'giant_slayer' }]);
      }
      return createChain([]);
    });

    const result = await checkAchievements('user-1', {
      winnerId: 'user-1',
      myElo: 1200,
      opponentElo: 1850,
    });
    expect(result).toContain('giant_slayer');
  });

  it('detects dawn_warrior for early morning win', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain([]);
      if (table === 'ttt_league_stats') return createChain([]);
      if (table === 'ttt_achievements') {
        return createChain([{ achievement_key: 'dawn_warrior' }]);
      }
      return createChain([]);
    });

    // 4 AM game
    const earlyMorning = new Date();
    earlyMorning.setHours(4, 0, 0, 0);

    const result = await checkAchievements('user-1', {
      winnerId: 'user-1',
      createdAt: earlyMorning.toISOString(),
    });
    expect(result).toContain('dawn_warrior');
  });

  it('does not grant dawn_warrior for afternoon game', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain([]);
      if (table === 'ttt_league_stats') return createChain([]);
      if (table === 'ttt_achievements') return createChain([]);
      return createChain([]);
    });

    const afternoon = new Date();
    afternoon.setHours(14, 0, 0, 0);

    const result = await checkAchievements('user-1', {
      winnerId: 'user-1',
      createdAt: afternoon.toISOString(),
    });
    expect(result).not.toContain('dawn_warrior');
  });

  it('does not grant achievements when user lost', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain([]);
      if (table === 'ttt_league_stats') return createChain([]);
      if (table === 'ttt_achievements') return createChain([]);
      return createChain([]);
    });

    const result = await checkAchievements('user-1', {
      winnerId: 'user-2', // Different user won
      myElo: 1000,
      opponentElo: 1800,
    });
    // Should not earn upset_king or giant_slayer since they lost
    expect(result).not.toContain('upset_king');
    expect(result).not.toContain('giant_slayer');
  });

  it('detects iron_streak from match history', async () => {
    const fiveWins = Array.from({ length: 5 }, (_, i) => ({
      game_mode: 'classic',
      winner_id: 'user-1',
      created_at: new Date().toISOString(),
      match_type: 'ranked',
    }));

    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain(fiveWins);
      if (table === 'ttt_league_stats') return createChain([]);
      if (table === 'ttt_achievements') {
        return createChain([{ achievement_key: 'iron_streak' }]);
      }
      return createChain([]);
    });

    const result = await checkAchievements('user-1', { winnerId: 'user-1' });
    expect(result).toContain('iron_streak');
  });

  it('returns empty when no achievements earned', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'ttt_matches') return createChain([]);
      if (table === 'ttt_league_stats') return createChain([]);
      return createChain([]);
    });

    const result = await checkAchievements('user-1', {
      winnerId: 'user-2', // Lost the game
    });
    expect(result).toEqual([]);
  });
});
