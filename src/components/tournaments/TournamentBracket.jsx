import TournamentMatchCard from './TournamentMatchCard';

/**
 * TournamentBracket — CSS Grid bracket visualization.
 * Columns = rounds, rows = matches. Horizontal scroll on mobile.
 */
export default function TournamentBracket({ tournament, rounds, matches, isManager, onRefresh }) {
  // Group matches by round
  const matchesByRound = {};
  for (const m of matches) {
    const roundNum = rounds.find(r => r.id === m.round_id)?.round_number || 0;
    if (!matchesByRound[roundNum]) matchesByRound[roundNum] = [];
    matchesByRound[roundNum].push(m);
  }

  // Sort matches within each round by match_number
  for (const key of Object.keys(matchesByRound)) {
    matchesByRound[key].sort((a, b) => a.match_number - b.match_number);
  }

  const numRounds = rounds.length;

  return (
    <div>
      <div style={{
        fontSize: 10, letterSpacing: 3, color: 'var(--ac)', textTransform: 'uppercase',
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        Bracket
        <span style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
      </div>

      <div style={{
        overflowX: 'auto',
        paddingBottom: 16,
      }}>
        <div
          role="group"
          aria-label="Tournament bracket"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${numRounds}, minmax(200px, 1fr))`,
            gap: 16,
            minWidth: numRounds * 216,
          }}
        >
          {rounds.map((round, ri) => {
            const roundMatches = matchesByRound[round.round_number] || [];
            // Calculate spacing: later rounds need more vertical space between matches
            const spacingMultiplier = Math.pow(2, ri);

            return (
              <div
                key={round.id}
                role="group"
                aria-label={round.name || `Round ${round.round_number}`}
              >
                {/* Round header */}
                <div style={{
                  fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                  color: round.status === 'active' ? 'var(--ac)' : 'var(--mu)',
                  marginBottom: 10, fontFamily: "'DM Mono',monospace",
                  textAlign: 'center',
                }}>
                  {round.name || `Round ${round.round_number}`}
                  {round.scheduled_at && (
                    <div style={{ fontSize: 8, color: 'var(--mu)', marginTop: 2 }}>
                      {new Date(round.scheduled_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {/* Match cards with spacing */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  justifyContent: 'space-around',
                  minHeight: roundMatches.length > 0 ? roundMatches.length * 80 * spacingMultiplier / roundMatches.length : 80,
                }}>
                  {roundMatches.map(m => (
                    <div key={m.id} style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      minHeight: 70 * spacingMultiplier / Math.max(1, roundMatches.length),
                    }}>
                      <div style={{ width: '100%' }}>
                        <TournamentMatchCard
                          match={m}
                          bestOf={tournament.best_of}
                          isManager={isManager}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connector lines via CSS — simplified approach */}
      <style>{`
        @media (max-width: 640px) {
          [aria-label="Tournament bracket"] {
            min-width: ${numRounds * 180}px !important;
          }
        }
      `}</style>
    </div>
  );
}
