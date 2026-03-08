import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logError } from '../../lib/logger';
import CreateTournament from './CreateTournament';
import TournamentDetail from './TournamentDetail';

/**
 * TournamentList — Shows all tournaments for a league.
 * Managers can create new tournaments. All members can view & enroll.
 */
export default function TournamentList({ league, isManager, members, standings }) {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const fetchTournaments = useCallback(async () => {
    const { data, error } = await supabase
      .from('ttt_tournaments')
      .select('*, winner:ttt_profiles!winner_id(id, display_name)')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false });

    if (error) logError('fetchTournaments:', error);
    setTournaments(data || []);
    setLoading(false);
  }, [league.id]);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  // If a tournament is selected, show its detail
  if (selectedId) {
    const t = tournaments.find(t => t.id === selectedId);
    return (
      <TournamentDetail
        tournament={t}
        league={league}
        isManager={isManager}
        members={members}
        standings={standings}
        onBack={() => { setSelectedId(null); fetchTournaments(); }}
        onRefresh={fetchTournaments}
      />
    );
  }

  const statusColor = (s) => {
    if (s === 'in_progress') return 'var(--gn)';
    if (s === 'open') return 'var(--ac)';
    if (s === 'completed') return 'var(--mu)';
    if (s === 'cancelled') return 'var(--rd)';
    return 'var(--hl)';
  };

  const active = tournaments.filter(t => ['setup', 'open', 'in_progress'].includes(t.status));
  const past = tournaments.filter(t => ['completed', 'cancelled'].includes(t.status));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          Tournaments
          <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
        </div>
        {isManager && (
          <button className="savebtn" style={{ marginLeft: 12, whiteSpace: 'nowrap', padding: '6px 14px', fontSize: 10 }}
            onClick={() => setShowCreate(true)}>
            + Create Tournament
          </button>
        )}
      </div>

      {/* Declare Champion (no-tournament path) */}
      {isManager && standings && standings.length > 0 && (
        <DeclareChampion league={league} standings={standings} onDone={fetchTournaments} />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30 }}>
          <div className="ai-thinking"><span>Loading</span><span className="dot" /><span className="dot" /><span className="dot" /></div>
        </div>
      ) : tournaments.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
          No tournaments yet.{isManager ? ' Create one to get started!' : ''}
        </div>
      ) : (
        <>
          {/* Active tournaments */}
          {active.length > 0 && (
            <div style={{ marginBottom: past.length > 0 ? 24 : 0 }}>
              {active.map(t => (
                <TournamentCard key={t.id} tournament={t} statusColor={statusColor} onClick={() => setSelectedId(t.id)} />
              ))}
            </div>
          )}

          {/* Past tournaments */}
          {past.length > 0 && (
            <div>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 8 }}>
                Past Tournaments
              </div>
              {past.map(t => (
                <TournamentCard key={t.id} tournament={t} statusColor={statusColor} onClick={() => setSelectedId(t.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Tournament Modal */}
      {showCreate && (
        <CreateTournament
          league={league}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchTournaments(); }}
        />
      )}
    </div>
  );
}

function TournamentCard({ tournament: t, statusColor, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--sf)', border: '1px solid var(--bd)',
        borderLeft: `3px solid ${statusColor(t.status)}`,
        padding: '16px 20px', marginBottom: 8, cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 1, lineHeight: 1.2 }}>
            {t.name}
          </div>
          {t.description && <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>{t.description}</div>}
        </div>
        <span style={{
          fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', whiteSpace: 'nowrap',
          padding: '3px 10px', border: `1px solid ${statusColor(t.status)}`,
          color: statusColor(t.status), fontFamily: "'DM Mono',monospace",
        }}>
          {t.status.replace('_', ' ')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 9, letterSpacing: 1.5, color: 'var(--mu)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", flexWrap: 'wrap' }}>
        <span style={{ color: t.game_mode === 'classic' ? 'var(--X)' : t.game_mode === 'ultimate' ? 'var(--O)' : 'var(--mega)' }}>{t.game_mode}</span>
        <span>Bo{t.best_of}</span>
        <span>{t.format.replace('_', ' ')}</span>
        {t.winner?.display_name && <span style={{ color: 'var(--go)' }}>Winner: {t.winner.display_name}</span>}
        {t.starts_at && <span>Starts {new Date(t.starts_at).toLocaleDateString()}</span>}
      </div>
    </button>
  );
}

function DeclareChampion({ league, standings, onDone }) {
  const { user } = useAuth();
  const [declaring, setDeclaring] = useState(false);

  async function declare() {
    if (!standings[0]) return;
    const top = standings[0];
    if (!confirm(`Declare ${top.display_name || 'Player'} as Season ${league.season} Champion?`)) return;

    setDeclaring(true);
    try {
      await supabase.from('ttt_awards').insert({
        user_id: top.user_id,
        league_id: league.id,
        award_type: 'champion',
        title: `${league.name} Season ${league.season} Champion`,
        description: `#1 in standings with ${top.wins || 0}W-${top.losses || 0}L`,
        game_mode: league.game_modes?.[0] || null,
        season: league.season,
        granted_by: user?.id,
      });
      onDone();
    } catch (err) {
      logError('Declare champion failed:', err);
    } finally { setDeclaring(false); }
  }

  if (!standings[0]) return null;
  const top = standings[0];

  return (
    <div style={{
      background: 'rgba(255,200,71,0.04)', border: '1px solid rgba(255,200,71,0.2)',
      padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center',
      gap: 12, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 20 }}>🏆</span>
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--hl)' }}>
          Declare Season Champion
        </div>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>
          Award #1 seed <strong style={{ color: 'var(--tx)' }}>{top.display_name || 'Unknown'}</strong> without a tournament
        </div>
      </div>
      <button className="savebtn" style={{ padding: '6px 14px', fontSize: 10 }}
        onClick={declare} disabled={declaring}>
        {declaring ? 'Declaring...' : 'Declare Champion'}
      </button>
    </div>
  );
}
