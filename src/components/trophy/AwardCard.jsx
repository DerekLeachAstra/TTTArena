/**
 * AwardCard — Displays a single award (champion trophy, tournament win, etc.)
 * Used inside TrophyCase Awards tab.
 */

export default function AwardCard({ award }) {
  const isChampion = award.award_type === 'champion' || award.award_type === 'tournament_winner';
  const borderColor = isChampion ? 'var(--go)' : 'var(--ac)';

  return (
    <div
      role="listitem"
      style={{
        background: 'var(--sf)',
        border: '1px solid var(--bd)',
        borderTop: `3px solid ${borderColor}`,
        padding: 20,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      {/* Trophy icon or image */}
      <div style={{
        width: 52, height: 52, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--s2)', border: '1px solid var(--bd)', borderRadius: 4,
        overflow: 'hidden',
      }}>
        {award.trophy_image_url ? (
          <img
            src={award.trophy_image_url}
            alt={award.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ fontSize: 28 }} role="img" aria-label="trophy">🏆</span>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue',sans-serif",
          fontSize: 20,
          letterSpacing: 1,
          lineHeight: 1.2,
          color: borderColor,
        }}>
          {award.title}
        </div>
        {award.description && (
          <div style={{ fontSize: 11, color: 'var(--mu)', marginTop: 2 }}>
            {award.description}
          </div>
        )}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8,
          fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)',
          fontFamily: "'DM Mono',monospace",
        }}>
          {award.game_mode && (
            <span style={{
              padding: '2px 8px', background: 'var(--s2)', border: '1px solid var(--bd)',
              color: award.game_mode === 'classic' ? 'var(--X)' : award.game_mode === 'ultimate' ? 'var(--O)' : 'var(--mega)',
            }}>
              {award.game_mode}
            </span>
          )}
          {award.season != null && (
            <span style={{ padding: '2px 8px', background: 'var(--s2)', border: '1px solid var(--bd)' }}>
              Season {award.season}
            </span>
          )}
          {award.award_type && (
            <span style={{ padding: '2px 8px', background: 'var(--s2)', border: '1px solid var(--bd)' }}>
              {award.award_type === 'champion' ? 'Champion' : award.award_type === 'tournament_winner' ? 'Tournament' : award.award_type === 'season_mvp' ? 'MVP' : 'Award'}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 6, fontFamily: "'DM Mono',monospace" }}>
          {new Date(award.granted_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}
