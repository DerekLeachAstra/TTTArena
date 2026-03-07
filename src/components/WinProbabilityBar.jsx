import { useState, useEffect, useRef } from 'react';

export default function WinProbabilityBar({ xPct, oPct, xName, oName }) {
  const [displayX, setDisplayX] = useState(50);
  const animRef = useRef(null);

  useEffect(() => {
    const target = xPct;
    const start = displayX;
    const startTime = performance.now();
    const duration = 400;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayX(start + (target - start) * eased);
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [xPct]);

  const xW = Math.max(2, displayX);
  const oW = Math.max(2, 100 - displayX);

  return (
    <div style={{ margin: '12px 0 16px', padding: '0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: 'var(--X)' }}>
            {Math.round(displayX)}%
          </span>
          <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>
            {xName || 'X'}
          </span>
        </div>
        <div style={{ fontSize: 9, letterSpacing: 3, color: 'var(--mu)', textTransform: 'uppercase' }}>
          Win Probability
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase' }}>
            {oName || 'O'}
          </span>
          <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: 'var(--O)' }}>
            {Math.round(100 - displayX)}%
          </span>
        </div>
      </div>
      <div style={{
        display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden',
        background: 'var(--s2)', border: '1px solid var(--bd)'
      }}>
        <div style={{
          width: xW + '%',
          background: 'linear-gradient(90deg, var(--X), #c4d93a)',
          transition: 'none',
          borderRadius: '4px 0 0 4px'
        }} />
        <div style={{
          width: oW + '%',
          background: 'linear-gradient(90deg, #3aaBd9, var(--O))',
          transition: 'none',
          borderRadius: '0 4px 4px 0'
        }} />
      </div>
    </div>
  );
}
