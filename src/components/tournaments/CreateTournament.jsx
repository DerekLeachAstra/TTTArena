import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logError } from '../../lib/logger';
import useFocusTrap from '../../hooks/useFocusTrap';

const inp = {
  background: 'var(--s2)', border: '1px solid var(--bd)', color: 'var(--tx)',
  fontFamily: "'DM Mono',monospace", fontSize: 12, padding: '8px 10px', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

const labelSt = {
  fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
  color: 'var(--mu)', display: 'block', marginBottom: 4,
};

/**
 * CreateTournament — Modal for creating a new tournament within a league.
 */
export default function CreateTournament({ league, onClose, onCreated }) {
  const { user } = useAuth();
  const containerRef = useFocusTrap(true, onClose);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gameMode, setGameMode] = useState(league.game_modes?.[0] || 'classic');
  const [bestOf, setBestOf] = useState(1);
  const [entryMode, setEntryMode] = useState('open');
  const [seedMode, setSeedMode] = useState('standings');
  const [scheduleMode, setScheduleMode] = useState('all_at_once');
  const [startsAt, setStartsAt] = useState('');
  const [trophyName, setTrophyName] = useState('');

  // Qualifier settings
  const [qualMinWins, setQualMinWins] = useState('');
  const [qualMinWinPct, setQualMinWinPct] = useState('');
  const [qualMaxStanding, setQualMaxStanding] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    setError('');
    if (!name.trim()) { setError('Tournament name is required'); return; }
    if (name.trim().length > 80) { setError('Name must be 80 characters or less'); return; }

    setSaving(true);
    try {
      const { data, error: insertErr } = await supabase.from('ttt_tournaments').insert({
        league_id: league.id,
        name: name.trim(),
        description: description.trim() || null,
        game_mode: gameMode,
        season: league.season || null,
        best_of: bestOf,
        entry_mode: entryMode,
        seed_mode: seedMode,
        schedule_mode: scheduleMode,
        starts_at: startsAt || null,
        trophy_name: trophyName.trim() || null,
        qual_min_wins: qualMinWins !== '' ? parseInt(qualMinWins, 10) : null,
        qual_min_win_pct: qualMinWinPct !== '' ? parseFloat(qualMinWinPct) : null,
        qual_max_standing: qualMaxStanding !== '' ? parseInt(qualMaxStanding, 10) : null,
        created_by: user.id,
      }).select().single();

      if (insertErr) throw insertErr;
      onCreated(data);
    } catch (err) {
      logError('Create tournament failed:', err);
      setError(err.message || 'Failed to create tournament');
    } finally { setSaving(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div
        ref={containerRef}
        role="dialog"
        aria-label="Create Tournament"
        aria-modal="true"
        style={{
          background: 'var(--bg)', border: '1px solid var(--bd)',
          borderTop: '3px solid var(--ac)', padding: 28,
          maxWidth: 520, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 2, marginBottom: 20 }}>
          Create Tournament
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Name */}
          <div>
            <label style={labelSt} htmlFor="t-name">Tournament Name *</label>
            <input id="t-name" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g., Season 1 Playoffs" style={inp} />
          </div>

          {/* Description */}
          <div>
            <label style={labelSt} htmlFor="t-desc">Description</label>
            <textarea id="t-desc" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional description" rows={2}
              style={{ ...inp, resize: 'vertical' }} />
          </div>

          {/* Game Mode */}
          <div>
            <label style={labelSt} htmlFor="t-mode">Game Mode</label>
            <select id="t-mode" value={gameMode} onChange={e => setGameMode(e.target.value)} style={inp}>
              {(league.game_modes || ['classic']).map(m => (
                <option key={m} value={m}>{m === 'classic' ? 'Classic 3×3' : m === 'ultimate' ? 'Ultimate 9×9' : 'MEGA 6×6'}</option>
              ))}
            </select>
          </div>

          {/* Best-of */}
          <div>
            <label style={labelSt} htmlFor="t-bestof">Match Format</label>
            <select id="t-bestof" value={bestOf} onChange={e => setBestOf(parseInt(e.target.value, 10))} style={inp}>
              <option value={1}>Single Game (Bo1)</option>
              <option value={3}>Best of 3</option>
              <option value={5}>Best of 5</option>
              <option value={7}>Best of 7</option>
            </select>
          </div>

          {/* Entry mode */}
          <div>
            <label style={labelSt} htmlFor="t-entry">Entry Mode</label>
            <select id="t-entry" value={entryMode} onChange={e => setEntryMode(e.target.value)} style={inp}>
              <option value="open">Open (anyone can join)</option>
              <option value="qualifier">Qualifier (must meet requirements)</option>
              <option value="manual">Manual (manager selects)</option>
            </select>
            <div style={{ fontSize: 9, color: 'var(--mu)', marginTop: 3 }}>
              {entryMode === 'open' ? 'All league members can enroll.' : entryMode === 'qualifier' ? 'Only members meeting qualifications can enter.' : 'Manager manually selects participants.'}
            </div>
          </div>

          {/* Qualifier settings */}
          {entryMode === 'qualifier' && (
            <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: 14 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--hl)', marginBottom: 10 }}>
                Qualifier Requirements
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={labelSt} htmlFor="t-qwins">Min Wins</label>
                  <input id="t-qwins" type="number" min={0} value={qualMinWins}
                    onChange={e => setQualMinWins(e.target.value)} style={inp} placeholder="—" />
                </div>
                <div>
                  <label style={labelSt} htmlFor="t-qpct">Min Win %</label>
                  <input id="t-qpct" type="number" min={0} max={100} step={0.1} value={qualMinWinPct}
                    onChange={e => setQualMinWinPct(e.target.value)} style={inp} placeholder="—" />
                </div>
                <div>
                  <label style={labelSt} htmlFor="t-qstand">Top N Standing</label>
                  <input id="t-qstand" type="number" min={1} value={qualMaxStanding}
                    onChange={e => setQualMaxStanding(e.target.value)} style={inp} placeholder="—" />
                </div>
              </div>
            </div>
          )}

          {/* Seed mode */}
          <div>
            <label style={labelSt} htmlFor="t-seed">Seeding</label>
            <select id="t-seed" value={seedMode} onChange={e => setSeedMode(e.target.value)} style={inp}>
              <option value="standings">By League Standings</option>
              <option value="manual">Manual Seeding</option>
            </select>
          </div>

          {/* Schedule mode */}
          <div>
            <label style={labelSt} htmlFor="t-schedule">Schedule</label>
            <select id="t-schedule" value={scheduleMode} onChange={e => setScheduleMode(e.target.value)} style={inp}>
              <option value="all_at_once">All rounds at once</option>
              <option value="per_round">Scheduled per round</option>
            </select>
          </div>

          {/* Start date */}
          <div>
            <label style={labelSt} htmlFor="t-start">Start Date (optional)</label>
            <input id="t-start" type="datetime-local" value={startsAt}
              onChange={e => setStartsAt(e.target.value)} style={inp} />
          </div>

          {/* Trophy name */}
          <div>
            <label style={labelSt} htmlFor="t-trophy">Trophy/Award Name</label>
            <input id="t-trophy" value={trophyName} onChange={e => setTrophyName(e.target.value)}
              placeholder="e.g., Golden Crown" style={inp} />
          </div>

          {error && <div style={{ fontSize: 11, color: 'var(--rd)' }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="savebtn" style={{ padding: '8px 20px' }} onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating...' : 'Create Tournament'}
            </button>
            <button className="smbtn" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
