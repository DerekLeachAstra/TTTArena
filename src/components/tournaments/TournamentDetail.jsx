import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logError } from '../../lib/logger';
import { generateBracket, isSeriesDecided } from '../../lib/bracketUtils';
import TournamentBracket from './TournamentBracket';

/**
 * TournamentDetail — Full tournament view: enrollment, bracket, management.
 */
export default function TournamentDetail({ tournament: initialTournament, league, isManager, members, standings, onBack, onRefresh }) {
  const { user } = useAuth();
  const [tournament, setTournament] = useState(initialTournament);
  const [participants, setParticipants] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [opening, setOpening] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!tournament?.id) return;
    setLoading(true);
    try {
      const [tRes, pRes, rRes, mRes] = await Promise.all([
        supabase.from('ttt_tournaments').select('*, winner:ttt_profiles!winner_id(id, display_name)').eq('id', tournament.id).single(),
        supabase.from('ttt_tournament_participants')
          .select('*, profile:ttt_profiles!user_id(id, display_name, username, avatar_url)')
          .eq('tournament_id', tournament.id)
          .order('seed', { ascending: true }),
        supabase.from('ttt_tournament_rounds')
          .select('*')
          .eq('tournament_id', tournament.id)
          .order('round_number', { ascending: true }),
        supabase.from('ttt_tournament_matches')
          .select('*, player_a:ttt_profiles!player_a_id(id, display_name), player_b:ttt_profiles!player_b_id(id, display_name)')
          .eq('tournament_id', tournament.id)
          .order('match_number', { ascending: true }),
      ]);
      if (tRes.data) setTournament(tRes.data);
      setParticipants(pRes.data || []);
      setRounds(rRes.data || []);
      setMatches(mRes.data || []);
    } catch (err) {
      logError('fetchTournamentDetail:', err);
    } finally { setLoading(false); }
  }, [tournament?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription for match updates
  useEffect(() => {
    if (!tournament?.id) return;
    const channel = supabase.channel(`tournament-${tournament.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_tournament_matches', filter: `tournament_id=eq.${tournament.id}` }, () => fetchAll())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [tournament?.id, fetchAll]);

  const isEnrolled = participants.some(p => p.user_id === user?.id);
  const isMember = members?.some(m => m.user_id === user?.id);

  // Enroll in tournament
  async function enroll() {
    if (!user || isEnrolled) return;
    setEnrolling(true);
    try {
      // Qualifier check
      if (tournament.entry_mode === 'qualifier' && standings) {
        const myStanding = standings.find(s => s.user_id === user.id);
        if (!myStanding) { alert('You have no stats in this league.'); setEnrolling(false); return; }
        if (tournament.qual_min_wins && (myStanding.wins || 0) < tournament.qual_min_wins) {
          alert(`You need at least ${tournament.qual_min_wins} wins. You have ${myStanding.wins || 0}.`);
          setEnrolling(false); return;
        }
        if (tournament.qual_min_win_pct && (myStanding.wpct || 0) < tournament.qual_min_win_pct) {
          alert(`You need at least ${tournament.qual_min_win_pct}% win rate.`);
          setEnrolling(false); return;
        }
        if (tournament.qual_max_standing) {
          const rank = standings.indexOf(myStanding) + 1;
          if (rank > tournament.qual_max_standing) {
            alert(`Only top ${tournament.qual_max_standing} players qualify. You are #${rank}.`);
            setEnrolling(false); return;
          }
        }
      }

      await supabase.from('ttt_tournament_participants').insert({
        tournament_id: tournament.id,
        user_id: user.id,
      });
      fetchAll();
    } catch (err) {
      logError('Enroll failed:', err);
    } finally { setEnrolling(false); }
  }

  // Withdraw from tournament
  async function withdraw() {
    if (!user) return;
    await supabase.from('ttt_tournament_participants').delete()
      .eq('tournament_id', tournament.id).eq('user_id', user.id);
    fetchAll();
  }

  // Open registration
  async function openRegistration() {
    setOpening(true);
    try {
      await supabase.from('ttt_tournaments').update({ status: 'open' }).eq('id', tournament.id);
      fetchAll();
    } catch (err) { logError('Open registration:', err); }
    finally { setOpening(false); }
  }

  // Generate bracket and start tournament
  async function finalizeBracket() {
    if (participants.length < 2) { alert('Need at least 2 participants.'); return; }
    setGenerating(true);
    try {
      // Assign seeds based on standings or manual order
      let seeded = [...participants];
      if (tournament.seed_mode === 'standings' && standings) {
        seeded.sort((a, b) => {
          const aIdx = standings.findIndex(s => s.user_id === a.user_id);
          const bIdx = standings.findIndex(s => s.user_id === b.user_id);
          return (aIdx === -1 ? 9999 : aIdx) - (bIdx === -1 ? 9999 : bIdx);
        });
      }

      // Update seeds
      for (let i = 0; i < seeded.length; i++) {
        await supabase.from('ttt_tournament_participants').update({ seed: i + 1 }).eq('id', seeded[i].id);
      }

      // Generate bracket structure
      const bracketParticipants = seeded.map((p, i) => ({
        id: p.user_id,
        seed: i + 1,
        display_name: p.profile?.display_name || 'Unknown',
      }));
      const bracket = generateBracket(bracketParticipants, tournament.best_of);

      // Insert rounds
      const roundInserts = bracket.rounds.map(r => ({
        tournament_id: tournament.id,
        round_number: r.roundNumber,
        name: r.name,
        status: r.roundNumber === 1 ? 'active' : 'pending',
      }));
      const { data: insertedRounds } = await supabase.from('ttt_tournament_rounds').insert(roundInserts).select();
      const roundMap = {};
      (insertedRounds || []).forEach(r => { roundMap[r.round_number] = r.id; });

      // Insert matches (without next_match_id first, link after)
      const matchInserts = bracket.matches.map(m => ({
        tournament_id: tournament.id,
        round_id: roundMap[m.roundNumber],
        match_number: m.matchNumber,
        player_a_id: m.playerA?.id || null,
        player_b_id: m.playerB?.id || null,
        is_bye: m.isBye,
        winner_id: m.winner?.id || null,
        status: m.isBye ? 'completed' : (m.roundNumber === 1 && m.playerA && m.playerB ? 'active' : 'pending'),
        player_a_wins: 0,
        player_b_wins: 0,
        next_match_slot: m.nextMatchSlot || null,
      }));

      const { data: insertedMatches } = await supabase.from('ttt_tournament_matches').insert(matchInserts).select();

      // Build matchNumber → DB id mapping
      const matchIdMap = {};
      (insertedMatches || []).forEach(m => { matchIdMap[m.match_number] = m.id; });

      // Link next_match_id
      for (const m of bracket.matches) {
        if (m.nextMatchNumber && matchIdMap[m.matchNumber] && matchIdMap[m.nextMatchNumber]) {
          await supabase.from('ttt_tournament_matches')
            .update({ next_match_id: matchIdMap[m.nextMatchNumber] })
            .eq('id', matchIdMap[m.matchNumber]);
        }
      }

      // Update tournament status
      await supabase.from('ttt_tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
      fetchAll();
      if (onRefresh) onRefresh();
    } catch (err) {
      logError('Generate bracket failed:', err);
      alert('Failed to generate bracket: ' + (err.message || 'Unknown error'));
    } finally { setGenerating(false); }
  }

  // Cancel tournament
  async function cancelTournament() {
    if (!confirm('Cancel this tournament? This cannot be undone.')) return;
    await supabase.from('ttt_tournaments').update({ status: 'cancelled' }).eq('id', tournament.id);
    fetchAll();
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div className="ai-thinking"><span>Loading</span><span className="dot" /><span className="dot" /><span className="dot" /></div>
      </div>
    );
  }

  const statusColor = tournament.status === 'in_progress' ? 'var(--gn)' : tournament.status === 'open' ? 'var(--ac)' : tournament.status === 'completed' ? 'var(--mu)' : 'var(--hl)';

  return (
    <div>
      <button className="smbtn" onClick={onBack} style={{ marginBottom: 16 }}>&larr; Back to Tournaments</button>

      {/* Header */}
      <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', borderTop: `3px solid ${statusColor}`, padding: '20px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2 }}>{tournament.name}</div>
            {tournament.description && <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 4 }}>{tournament.description}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, letterSpacing: 1.5, color: 'var(--mu)', textTransform: 'uppercase', fontFamily: "'DM Mono',monospace", flexWrap: 'wrap' }}>
              <span style={{ color: tournament.game_mode === 'classic' ? 'var(--X)' : tournament.game_mode === 'ultimate' ? 'var(--O)' : 'var(--mega)' }}>{tournament.game_mode}</span>
              <span>Bo{tournament.best_of}</span>
              <span>{tournament.format.replace('_', ' ')}</span>
              <span style={{ color: statusColor }}>{tournament.status.replace('_', ' ')}</span>
              <span>{participants.length} players</span>
            </div>
            {tournament.winner?.display_name && (
              <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: 'rgba(255,200,71,0.08)', border: '1px solid rgba(255,200,71,0.3)' }}>
                <span style={{ fontSize: 18 }}>🏆</span>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: 1, color: 'var(--go)' }}>
                  Winner: {tournament.winner.display_name}
                </span>
              </div>
            )}
          </div>
          {/* Manager controls */}
          {isManager && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              {tournament.status === 'setup' && (
                <button className="savebtn" style={{ padding: '6px 14px', fontSize: 10 }}
                  onClick={openRegistration} disabled={opening}>
                  {opening ? 'Opening...' : 'Open Registration'}
                </button>
              )}
              {(tournament.status === 'open' || tournament.status === 'setup') && participants.length >= 2 && (
                <button className="savebtn" style={{ padding: '6px 14px', fontSize: 10 }}
                  onClick={finalizeBracket} disabled={generating}>
                  {generating ? 'Generating...' : `Finalize Bracket (${participants.length} players)`}
                </button>
              )}
              {['setup', 'open', 'in_progress'].includes(tournament.status) && (
                <button className="smbtn" style={{ padding: '4px 10px', fontSize: 9, borderColor: 'var(--rd)', color: 'var(--rd)' }}
                  onClick={cancelTournament}>
                  Cancel Tournament
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Enrollment section (when setup or open) */}
      {['setup', 'open'].includes(tournament.status) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            Participants ({participants.length})
            <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>

          {/* Enrollment button */}
          {user && isMember && !isEnrolled && tournament.status === 'open' && tournament.entry_mode !== 'manual' && (
            <button className="savebtn" style={{ marginBottom: 12, padding: '8px 20px' }}
              onClick={enroll} disabled={enrolling}>
              {enrolling ? 'Enrolling...' : 'Enroll in Tournament'}
            </button>
          )}
          {isEnrolled && tournament.status === 'open' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--gn)', padding: '6px 14px', background: 'rgba(71,255,154,0.06)', border: '1px solid rgba(71,255,154,0.2)', fontFamily: "'DM Mono',monospace" }}>
                Enrolled
              </span>
              <button className="smbtn" style={{ padding: '4px 10px', fontSize: 9, borderColor: 'var(--rd)', color: 'var(--rd)' }}
                onClick={withdraw}>
                Withdraw
              </button>
            </div>
          )}

          {/* Manual enrollment for managers */}
          {isManager && tournament.entry_mode === 'manual' && (
            <ManualEnroll
              members={members}
              participants={participants}
              tournamentId={tournament.id}
              onDone={fetchAll}
            />
          )}

          {/* Participant list */}
          {participants.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 20, border: '1px dashed var(--bd)' }}>
              No participants yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {participants.map((p, i) => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
                  background: 'var(--sf)', border: '1px solid var(--bd)',
                }}>
                  <span style={{ fontSize: 10, color: 'var(--mu)', fontFamily: "'DM Mono',monospace" }}>
                    {p.seed ? `#${p.seed}` : `${i + 1}.`}
                  </span>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.profile?.avatar_url ? (
                      <img src={p.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--mu)' }}>{(p.profile?.display_name || '?')[0].toUpperCase()}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 11 }}>{p.profile?.display_name || 'Unknown'}</span>
                  {isManager && tournament.status !== 'in_progress' && (
                    <button style={{ background: 'none', border: 'none', color: 'var(--rd)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                      onClick={async () => {
                        await supabase.from('ttt_tournament_participants').delete().eq('id', p.id);
                        fetchAll();
                      }}
                      aria-label={`Remove ${p.profile?.display_name}`}>×</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bracket (when in_progress or completed) */}
      {['in_progress', 'completed'].includes(tournament.status) && rounds.length > 0 && (
        <TournamentBracket
          tournament={tournament}
          rounds={rounds}
          matches={matches}
          isManager={isManager}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}

/** Manual enrollment — manager picks from roster */
function ManualEnroll({ members, participants, tournamentId, onDone }) {
  const enrolled = new Set(participants.map(p => p.user_id));

  async function addPlayer(userId) {
    try {
      await supabase.from('ttt_tournament_participants').insert({
        tournament_id: tournamentId,
        user_id: userId,
      });
      onDone();
    } catch (err) {
      logError('Manual enroll:', err);
    }
  }

  const available = (members || []).filter(m => !enrolled.has(m.user_id));

  if (available.length === 0) {
    return <div style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 12 }}>All roster members are enrolled.</div>;
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--hl)', marginBottom: 6 }}>
        Add Players
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {available.map(m => (
          <button key={m.user_id} className="smbtn" style={{ padding: '4px 10px', fontSize: 9 }}
            onClick={() => addPlayer(m.user_id)}>
            + {m.ttt_profiles?.display_name || 'Unknown'}
          </button>
        ))}
      </div>
    </div>
  );
}
