import { ACHIEVEMENTS } from '../../lib/trophyDefinitions';

/**
 * AchievementList — Shows earned achievements (full color) + locked hints.
 * Earned: icon + name + description + date
 * Locked: dimmed, ??? hints for discoverability
 */
export default function AchievementList({ earned = [] }) {
  // Map earned array to a lookup { key: { unlocked_at, metadata } }
  const earnedMap = {};
  for (const e of earned) {
    earnedMap[e.achievement_key] = e;
  }

  const earnedList = ACHIEVEMENTS.filter(a => earnedMap[a.key]);
  const lockedList = ACHIEVEMENTS.filter(a => !earnedMap[a.key]);

  return (
    <div role="list" aria-label="Achievements">
      {/* Earned achievements */}
      {earnedList.length > 0 && (
        <div style={{ marginBottom: lockedList.length > 0 ? 24 : 0 }}>
          <div style={{
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--gn)', marginBottom: 10,
          }}>
            Earned ({earnedList.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {earnedList.map(a => {
              const data = earnedMap[a.key];
              return (
                <div
                  key={a.key}
                  role="listitem"
                  aria-label={`${a.name} — Earned`}
                  style={{
                    background: 'var(--sf)',
                    border: '1px solid var(--bd)',
                    borderLeft: '3px solid var(--gn)',
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }} role="img" aria-hidden="true">{a.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'DM Mono',monospace",
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--tx)',
                      letterSpacing: 1,
                    }}>
                      {a.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2 }}>
                      {a.description}
                    </div>
                  </div>
                  {data?.unlocked_at && (
                    <div style={{
                      fontSize: 9, color: 'var(--mu)',
                      fontFamily: "'DM Mono',monospace",
                      flexShrink: 0,
                    }}>
                      {new Date(data.unlocked_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked achievements with hints */}
      {lockedList.length > 0 && (
        <div>
          <div style={{
            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--mu)', marginBottom: 10,
          }}>
            Locked ({lockedList.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lockedList.map(a => (
              <div
                key={a.key}
                role="listitem"
                aria-label={`${a.name} — Locked`}
                style={{
                  background: 'var(--sf)',
                  border: '1px solid var(--bd)',
                  borderLeft: '3px solid var(--s3)',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  opacity: 0.4,
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0, filter: 'grayscale(1)' }} role="img" aria-hidden="true">
                  {a.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: 11,
                    color: 'var(--mu)',
                    letterSpacing: 1,
                  }}>
                    ???
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 2, fontStyle: 'italic' }}>
                    {a.hint}
                  </div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--mu)', opacity: 0.6 }} aria-hidden="true">🔒</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {earnedList.length === 0 && lockedList.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--mu)', fontSize: 11, letterSpacing: 2, padding: 30, border: '1px dashed var(--bd)' }}>
          No achievements available.
        </div>
      )}
    </div>
  );
}
