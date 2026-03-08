/**
 * Trophy Case definitions — Milestones, Achievements
 * Milestones: always shown (locked/unlocked), earned passively through cumulative play
 * Achievements: shown earned + locked hints, earned through specific conditions
 */

export const MILESTONES = [
  // Win milestones
  { key: 'first_win', name: 'First Victory', icon: '⚔', description: 'Win your first game', tier: 'bronze', category: 'wins', threshold: 1 },
  { key: 'wins_10', name: 'Rising Contender', icon: '⚔', description: 'Win 10 games', tier: 'bronze', category: 'wins', threshold: 10 },
  { key: 'wins_50', name: 'Veteran Fighter', icon: '⚔', description: 'Win 50 games', tier: 'silver', category: 'wins', threshold: 50 },
  { key: 'wins_100', name: 'Centurion', icon: '⚔', description: 'Win 100 games', tier: 'gold', category: 'wins', threshold: 100 },
  { key: 'wins_500', name: 'War Machine', icon: '⚔', description: 'Win 500 games', tier: 'platinum', category: 'wins', threshold: 500 },
  { key: 'wins_1000', name: 'Legendary', icon: '⚔', description: 'Win 1,000 games', tier: 'diamond', category: 'wins', threshold: 1000 },

  // Games played milestones
  { key: 'games_10', name: 'Getting Started', icon: '▶', description: 'Play 10 games', tier: 'bronze', category: 'games', threshold: 10 },
  { key: 'games_100', name: 'Dedicated', icon: '▶', description: 'Play 100 games', tier: 'silver', category: 'games', threshold: 100 },
  { key: 'games_500', name: 'Arena Addict', icon: '▶', description: 'Play 500 games', tier: 'gold', category: 'games', threshold: 500 },
  { key: 'games_1000', name: 'Arena Lifer', icon: '▶', description: 'Play 1,000 games', tier: 'diamond', category: 'games', threshold: 1000 },

  // Special milestones
  { key: 'first_draw', name: 'Stalemate', icon: '🤝', description: 'Draw your first game', tier: 'bronze', category: 'special' },
  { key: 'rank_silver', name: 'Silver Tier', icon: '★', description: 'Reach Silver rank (1200+ ELO)', tier: 'silver', category: 'rank', eloThreshold: 1200 },
  { key: 'rank_gold', name: 'Gold Tier', icon: '★', description: 'Reach Gold rank (1400+ ELO)', tier: 'gold', category: 'rank', eloThreshold: 1400 },
  { key: 'rank_platinum', name: 'Platinum Tier', icon: '★', description: 'Reach Platinum rank (1600+ ELO)', tier: 'platinum', category: 'rank', eloThreshold: 1600 },
  { key: 'rank_diamond', name: 'Diamond Tier', icon: '♦', description: 'Reach Diamond rank (1800+ ELO)', tier: 'diamond', category: 'rank', eloThreshold: 1800 },
  { key: 'all_modes', name: 'Mode Master', icon: '✦', description: 'Play all 3 game modes', tier: 'silver', category: 'special' },
  { key: 'join_league', name: 'Team Player', icon: '🛡', description: 'Join a league', tier: 'bronze', category: 'social' },
  { key: 'add_rival', name: 'Arch Nemesis', icon: '👊', description: 'Add a rival', tier: 'bronze', category: 'social' },
];

export const ACHIEVEMENTS = [
  { key: 'upset_king', name: 'Upset King', icon: '👑', description: 'Beat someone 200+ ELO higher than you', hint: 'Win against a much stronger opponent' },
  { key: 'giant_slayer', name: 'Giant Slayer', icon: '🗡', description: 'Beat a Diamond-ranked player (1800+ ELO)', hint: 'Defeat the best of the best' },
  { key: 'unbeatable', name: 'Unbeatable', icon: '🔥', description: 'Win 10 games in a row', hint: 'Build an incredible win streak' },
  { key: 'triple_threat', name: 'Triple Threat', icon: '✦', description: 'Win a Classic, Ultimate, and MEGA game in one day', hint: 'Master all three modes in a single day' },
  { key: 'perfect_season', name: 'Perfect Season', icon: '🏆', description: 'Win 10+ league games with 0 losses in a season', hint: 'Dominate a league season' },
  { key: 'comeback_kid', name: 'Comeback Kid', icon: '↑', description: 'Win a best-of series after trailing 0-2', hint: 'Never give up in a tournament series' },
  { key: 'tournament_champ', name: 'Tournament Champion', icon: '🥇', description: 'Win a tournament', hint: 'Claim the ultimate prize' },
  { key: 'league_veteran', name: 'League Veteran', icon: '🎖', description: 'Play 50 league matches', hint: 'Commit to competitive league play' },
  { key: 'rivalry_master', name: 'Rivalry Master', icon: '🤜', description: 'Win 10 rival matches', hint: 'Prove your dominance over rivals' },
  { key: 'iron_streak', name: 'Iron Streak', icon: '🛡', description: 'Win 5 games in a row', hint: 'Build a solid winning streak' },
  { key: 'dawn_warrior', name: 'Dawn Warrior', icon: '🌅', description: 'Win a game before 6 AM', hint: 'Early bird gets the win' },
  { key: 'marathon', name: 'Marathon', icon: '⏱', description: 'Play 10+ games in one day', hint: 'Endurance is key' },
];

// Tier colors matching the existing design system
export const TIER_COLORS = {
  bronze: 'var(--br)',
  silver: 'var(--si)',
  gold: 'var(--go)',
  platinum: '#e5e4e2',
  diamond: '#b9f2ff',
};

/**
 * Compute progress toward a cumulative milestone.
 * Returns { current, target, pct } or null if not a cumulative milestone.
 */
export function milestoneProgress(milestone, stats) {
  const totalWins = stats.reduce((sum, s) => sum + (s.wins || 0), 0);
  const totalLosses = stats.reduce((sum, s) => sum + (s.losses || 0), 0);
  const totalDraws = stats.reduce((sum, s) => sum + (s.draws || 0), 0);
  const totalGames = totalWins + totalLosses + totalDraws;
  const maxElo = Math.max(0, ...stats.map(s => s.elo_rating || 0));

  if (milestone.category === 'wins' && milestone.threshold) {
    return { current: totalWins, target: milestone.threshold, pct: Math.min(100, (totalWins / milestone.threshold) * 100) };
  }
  if (milestone.category === 'games' && milestone.threshold) {
    return { current: totalGames, target: milestone.threshold, pct: Math.min(100, (totalGames / milestone.threshold) * 100) };
  }
  if (milestone.category === 'rank' && milestone.eloThreshold) {
    return { current: maxElo, target: milestone.eloThreshold, pct: Math.min(100, (maxElo / milestone.eloThreshold) * 100) };
  }
  return null;
}
