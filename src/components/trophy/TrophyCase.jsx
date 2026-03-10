import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { checkMilestones } from '../../lib/trophyChecker';
import AwardCard from './AwardCard';
import MilestoneGrid from './MilestoneGrid';
import AchievementList from './AchievementList';

const SUB_TABS = [
  { id: 'awards', label: 'Awards' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'achievements', label: 'Achievements' },
];

/**
 * TrophyCase — Full trophy case component for user profiles.
 * Fetches awards, milestones, and achievements for the given userId.
 * Works for own profile and public profiles.
 * @param {{ userId: string, isOwn?: boolean }} props
 */
export default function TrophyCase({ userId, isOwn = false }) {
  const [subTab, setSubTab] = useState('awards');
  const [awards, setAwards] = useState([]);
  const [milestoneKeys, setMilestoneKeys] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // Retroactive grant on first load (own profile only)
      if (isOwn) {
        await checkMilestones(userId);
      }

      const [awardsRes, milestonesRes, achievementsRes, statsRes] = await Promise.all([
        supabase
          .from('ttt_awards')
          .select('*')
          .eq('user_id', userId)
          .order('granted_at', { ascending: false }),
        supabase
          .from('ttt_milestones')
          .select('milestone_key, unlocked_at')
          .eq('user_id', userId),
        supabase
          .from('ttt_achievements')
          .select('achievement_key, unlocked_at, metadata')
          .eq('user_id', userId),
        supabase
          .from('ttt_player_stats')
          .select('game_mode, elo_rating, wins, losses, draws')
          .eq('user_id', userId),
      ]);

      setAwards(awardsRes.data || []);
      setMilestoneKeys((milestonesRes.data || []).map(r => r.milestone_key));
      setAchievements(achievementsRes.data || []);
      setStats(statsRes.data || []);
    } catch {
      // Silently handle — data just won't render
    } finally {
      setLoading(false);
    }
  }, [userId, isOwn]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div className="ai-thinking"><span>Loading</span><span className="dot" /><span className="dot" /><span className="dot" /></div>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs: Awards | Milestones | Achievements */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20,
        borderBottom: '1px solid var(--bd)',
      }}>
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: '2px solid ' + (subTab === t.id ? 'var(--ac)' : 'transparent'),
              color: subTab === t.id ? 'var(--ac)' : 'var(--mu)',
              fontFamily: "'DM Mono',monospace",
              fontSize: 10,
              letterSpacing: 2,
              textTransform: 'uppercase',
              padding: '8px 14px',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
            {t.id === 'awards' && awards.length > 0 && (
              <span style={{ marginLeft: 6, color: 'var(--go)' }}>({awards.length})</span>
            )}
            {t.id === 'milestones' && milestoneKeys.length > 0 && (
              <span style={{ marginLeft: 6, color: 'var(--gn)' }}>({milestoneKeys.length})</span>
            )}
            {t.id === 'achievements' && achievements.length > 0 && (
              <span style={{ marginLeft: 6, color: 'var(--gn)' }}>({achievements.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Awards tab */}
      {subTab === 'awards' && (
        awards.length === 0 ? (
          <div style={{
            textAlign: 'center', color: 'var(--mu)', fontSize: 11,
            letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)',
          }}>
            No awards yet. Win tournaments and league championships to earn trophies!
          </div>
        ) : (
          <div role="list" aria-label="Awards" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {awards.map(a => <AwardCard key={a.id} award={a} />)}
          </div>
        )
      )}

      {/* Milestones tab */}
      {subTab === 'milestones' && (
        <MilestoneGrid unlockedKeys={milestoneKeys} stats={stats} />
      )}

      {/* Achievements tab */}
      {subTab === 'achievements' && (
        <AchievementList earned={achievements} />
      )}
    </div>
  );
}
