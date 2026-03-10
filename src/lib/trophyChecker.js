import { supabase } from './supabase';
import { logError } from './logger';
import { MILESTONES, ACHIEVEMENTS } from './trophyDefinitions';

/**
 * Check and grant milestones for a user based on their current stats.
 * Idempotent: uses INSERT ... ON CONFLICT DO NOTHING.
 * @param {string} userId
 * @returns {Promise<string[]>} Array of newly granted milestone keys
 */
export async function checkMilestones(userId) {
  if (!userId) return [];

  try {
    // Fetch all required data in parallel
    const [statsRes, leaguesRes, rivalsRes] = await Promise.all([
      supabase.from('ttt_player_stats').select('game_mode, elo_rating, wins, losses, draws').eq('user_id', userId),
      supabase.from('ttt_league_members').select('id').eq('user_id', userId).limit(1),
      supabase.from('ttt_rivals').select('id').or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`).eq('status', 'accepted').limit(1),
    ]);

    const stats = statsRes.data || [];
    const totalWins = stats.reduce((s, r) => s + (r.wins || 0), 0);
    const totalDraws = stats.reduce((s, r) => s + (r.draws || 0), 0);
    const totalGames = stats.reduce((s, r) => s + (r.wins || 0) + (r.losses || 0) + (r.draws || 0), 0);
    const maxElo = Math.max(0, ...stats.map(r => r.elo_rating || 0));
    const modes = new Set(stats.filter(r => (r.wins || 0) + (r.losses || 0) + (r.draws || 0) > 0).map(r => r.game_mode));
    const hasLeague = (leaguesRes.data || []).length > 0;
    const hasRival = (rivalsRes.data || []).length > 0;

    const earned = [];

    for (const m of MILESTONES) {
      let met = false;
      if (m.category === 'wins' && m.threshold) met = totalWins >= m.threshold;
      else if (m.category === 'games' && m.threshold) met = totalGames >= m.threshold;
      else if (m.category === 'rank' && m.eloThreshold) met = maxElo >= m.eloThreshold;
      else if (m.key === 'first_draw') met = totalDraws >= 1;
      else if (m.key === 'all_modes') met = modes.size >= 3;
      else if (m.key === 'join_league') met = hasLeague;
      else if (m.key === 'add_rival') met = hasRival;

      if (met) earned.push(m.key);
    }

    if (earned.length === 0) return [];

    // Batch insert, ON CONFLICT DO NOTHING
    const rows = earned.map(key => ({ user_id: userId, milestone_key: key }));
    const { data } = await supabase.from('ttt_milestones').insert(rows).select('milestone_key');

    return (data || []).map(r => r.milestone_key);
  } catch (err) {
    logError('checkMilestones failed:', err);
    return [];
  }
}

/**
 * Check and grant achievements for a user after a game.
 * @param {string} userId
 * @param {object} matchData - { winnerId, myElo, opponentElo, gameMode, matchType, createdAt }
 * @returns {Promise<string[]>} Array of newly granted achievement keys
 */
export async function checkAchievements(userId, matchData = {}) {
  if (!userId) return [];

  try {
    const earned = [];
    const won = matchData.winnerId === userId;

    // Upset King: beat someone 200+ ELO higher
    if (won && matchData.opponentElo && matchData.myElo && (matchData.opponentElo - matchData.myElo) >= 200) {
      earned.push('upset_king');
    }

    // Giant Slayer: beat a Diamond player (1800+)
    if (won && matchData.opponentElo && matchData.opponentElo >= 1800) {
      earned.push('giant_slayer');
    }

    // Dawn Warrior: win before 6 AM
    if (won && matchData.createdAt) {
      const hour = new Date(matchData.createdAt).getHours();
      if (hour < 6) earned.push('dawn_warrior');
    }

    // For cumulative achievements, query the database
    const [matchesRes, leagueMatchesRes, rivalMatchesRes] = await Promise.all([
      supabase.from('ttt_matches').select('game_mode, winner_id, created_at, match_type')
        .or(`player_x_id.eq.${userId},player_o_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('ttt_matches').select('id').eq('match_type', 'league')
        .or(`player_x_id.eq.${userId},player_o_id.eq.${userId}`),
      supabase.from('ttt_matches').select('id, winner_id').eq('match_type', 'rival')
        .or(`player_x_id.eq.${userId},player_o_id.eq.${userId}`),
    ]);

    const matches = matchesRes.data || [];
    const leagueMatches = leagueMatchesRes.data || [];
    const rivalMatches = rivalMatchesRes.data || [];

    // Unbeatable: 10 wins in a row
    let streak = 0;
    for (const m of matches) {
      if (m.winner_id === userId) { streak++; if (streak >= 10) { earned.push('unbeatable'); break; } }
      else { streak = 0; }
    }

    // Iron Streak: 5 wins in a row
    let streak5 = 0;
    for (const m of matches) {
      if (m.winner_id === userId) { streak5++; if (streak5 >= 5) { earned.push('iron_streak'); break; } }
      else { streak5 = 0; }
    }

    // Triple Threat: win all 3 modes in one day
    const today = new Date().toDateString();
    const todayWins = matches.filter(m => m.winner_id === userId && new Date(m.created_at).toDateString() === today);
    const todayModes = new Set(todayWins.map(m => m.game_mode));
    if (todayModes.size >= 3) earned.push('triple_threat');

    // Marathon: 10+ games in one day
    const todayGames = matches.filter(m => new Date(m.created_at).toDateString() === today);
    if (todayGames.length >= 10) earned.push('marathon');

    // League Veteran: 50 league matches
    if (leagueMatches.length >= 50) earned.push('league_veteran');

    // Rivalry Master: win 10 rival matches
    const rivalWins = rivalMatches.filter(m => m.winner_id === userId).length;
    if (rivalWins >= 10) earned.push('rivalry_master');

    // Perfect Season: check league stats for any season with 10+ wins, 0 losses
    const { data: leagueStats } = await supabase.from('ttt_league_stats')
      .select('wins, losses').eq('user_id', userId);
    if (leagueStats) {
      for (const ls of leagueStats) {
        if ((ls.wins || 0) >= 10 && (ls.losses || 0) === 0) {
          earned.push('perfect_season');
          break;
        }
      }
    }

    // Tournament Champion: checked separately when tournament completes
    // Comeback Kid: checked separately when series completes

    if (earned.length === 0) return [];

    // Deduplicate
    const unique = [...new Set(earned)];
    const rows = unique.map(key => ({ user_id: userId, achievement_key: key, metadata: matchData.winnerId ? { match_winner: matchData.winnerId } : {} }));
    const { data } = await supabase.from('ttt_achievements').insert(rows).select('achievement_key');

    return (data || []).map(r => r.achievement_key);
  } catch (err) {
    logError('checkAchievements failed:', err);
    return [];
  }
}
