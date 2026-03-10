import { useNavigate } from 'react-router-dom';

/**
 * TournamentMatchCard — Single match in the bracket.
 * Shows players, seeds, series score, and play button.
 */
export default function TournamentMatchCard({ match, bestOf, isManager }) {
  const navigate = useNavigate();

  const statusColor = match.status === 'active' ? 'var(--ac)' : match.status === 'completed' ? 'var(--gn)' : 'var(--s3)';
  const isBye = match.is_bye;

  function handlePlay() {
    navigate(`/live?tournamentMatchId=${match.id}&tournamentName=${encodeURIComponent('Tournament Match')}`);
  }

  return (
    <div
      role="group"
      aria-label={`Match ${match.match_number}: ${match.player_a?.display_name || 'TBD'} vs ${match.player_b?.display_name || 'TBD'}`}
      style={{
        background: 'var(--sf)',
        border: '1px solid var(--bd)',
        borderLeft: `3px solid ${statusColor}`,
        padding: '8px 12px',
        minWidth: 180,
        fontSize: 11,
      }}
    >
      {/* Player A */}
      <PlayerRow
        player={match.player_a}
        wins={match.player_a_wins}
        isWinner={match.winner_id && match.winner_id === match.player_a_id}
        showScore={bestOf > 1}
      />

      {/* Divider */}
      <div style={{
        height: 1, background: 'var(--bd)', margin: '4px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {!isBye && (
          <span style={{
            fontSize: 8, letterSpacing: 1, color: 'var(--mu)',
            background: 'var(--sf)', padding: '0 4px',
            textTransform: 'uppercase',
          }}>
            vs
          </span>
        )}
      </div>

      {/* Player B */}
      <PlayerRow
        player={match.player_b}
        wins={match.player_b_wins}
        isWinner={match.winner_id && match.winner_id === match.player_b_id}
        showScore={bestOf > 1}
      />

      {/* Status / Play button */}
      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 8, letterSpacing: 1.5, textTransform: 'uppercase',
          color: statusColor, fontFamily: "'DM Mono',monospace",
        }}>
          {isBye ? 'BYE' : match.status}
        </span>
        {match.status === 'active' && match.player_a_id && match.player_b_id && !isBye && (
          <button
            className="smbtn"
            style={{ padding: '2px 8px', fontSize: 8, borderColor: 'var(--ac)', color: 'var(--ac)' }}
            onClick={handlePlay}
          >
            Play
          </button>
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player, wins, isWinner, showScore }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      opacity: player ? 1 : 0.3,
    }}>
      <span style={{
        fontWeight: isWinner ? 700 : 400,
        color: isWinner ? 'var(--gn)' : 'var(--tx)',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 11,
      }}>
        {player?.display_name || 'TBD'}
      </span>
      {showScore && player && (
        <span style={{
          fontFamily: "'Bebas Neue',sans-serif",
          fontSize: 16,
          color: isWinner ? 'var(--gn)' : 'var(--mu)',
          minWidth: 16,
          textAlign: 'center',
        }}>
          {wins}
        </span>
      )}
      {isWinner && (
        <span style={{ fontSize: 10, color: 'var(--gn)' }} aria-label="Winner">✓</span>
      )}
    </div>
  );
}
