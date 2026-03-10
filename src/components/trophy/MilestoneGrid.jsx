import { MILESTONES, TIER_COLORS, milestoneProgress } from '../../lib/trophyDefinitions';

/**
 * MilestoneGrid — Shows all milestones in a grid.
 * Unlocked = colorful, Locked = dimmed with lock icon.
 * Includes progress bars for cumulative milestones.
 */
export default function MilestoneGrid({ unlockedKeys = [], stats = [] }) {
  const unlockedSet = new Set(unlockedKeys);

  return (
    <div
      role="list"
      aria-label="Career milestones"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 10,
      }}
    >
      {MILESTONES.map(m => {
        const unlocked = unlockedSet.has(m.key);
        const tierColor = TIER_COLORS[m.tier] || 'var(--mu)';
        const progress = !unlocked ? milestoneProgress(m, stats) : null;

        return (
          <div
            key={m.key}
            role="listitem"
            aria-label={`${m.name}${unlocked ? ' — Unlocked' : ' — Locked'}`}
            style={{
              background: 'var(--sf)',
              border: '1px solid var(--bd)',
              borderLeft: `3px solid ${unlocked ? tierColor : 'var(--s3)'}`,
              padding: 16,
              opacity: unlocked ? 1 : 0.4,
              transition: 'opacity 0.2s',
              position: 'relative',
            }}
          >
            {/* Lock icon for locked milestones */}
            {!unlocked && (
              <div style={{
                position: 'absolute', top: 8, right: 8,
                fontSize: 12, color: 'var(--mu)', opacity: 0.6,
              }} aria-hidden="true">
                🔒
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{
                fontSize: 22,
                filter: unlocked ? 'none' : 'grayscale(1)',
              }} role="img" aria-hidden="true">
                {m.icon}
              </span>
              <div>
                <div style={{
                  fontFamily: "'DM Mono',monospace",
                  fontSize: 11,
                  fontWeight: 500,
                  color: unlocked ? tierColor : 'var(--mu)',
                  letterSpacing: 1,
                }}>
                  {m.name}
                </div>
                <div style={{
                  fontSize: 9,
                  letterSpacing: 1,
                  color: 'var(--mu)',
                  textTransform: 'uppercase',
                }}>
                  {m.tier}
                </div>
              </div>
            </div>

            <div style={{
              fontSize: 10,
              color: unlocked ? 'var(--tx)' : 'var(--mu)',
              lineHeight: 1.4,
              marginBottom: progress ? 8 : 0,
            }}>
              {m.description}
            </div>

            {/* Progress bar for locked cumulative milestones */}
            {progress && !unlocked && (
              <div>
                <div style={{
                  height: 4,
                  background: 'var(--s2)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progress.pct}%`,
                    background: tierColor,
                    borderRadius: 2,
                    transition: 'width 0.3s',
                  }} />
                </div>
                <div style={{
                  fontSize: 9,
                  color: 'var(--mu)',
                  fontFamily: "'DM Mono',monospace",
                  marginTop: 3,
                  letterSpacing: 1,
                }}>
                  {progress.current.toLocaleString()} / {progress.target.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
