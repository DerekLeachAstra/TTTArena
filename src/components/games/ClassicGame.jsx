import { useState, useEffect, useRef, useCallback } from 'react';
import { checkWin, getWinLine } from '../../lib/gameLogic';
import { getAIMove } from '../../ai/engine';
import { classicProbability } from '../../ai/probability';
import WinProbabilityBar from '../WinProbabilityBar';
import { dn } from '../../lib/playerUtils';
import AiThinking from './AiThinking';
import { cellLabel, srOnly } from '../../lib/a11y';

export default function ClassicGame({ pX, pO, onEnd, onAbandon, aiDifficulty, canSaveRanked, onSaveRanked, rankedSaving, onRematch }) {
  const [cells, setCells] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [saved, setSaved] = useState(false);
  const [rankedSaved, setRankedSaved] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [prob, setProb] = useState({ x:50, o:50 });
  const [announce, setAnnounce] = useState('');
  const gridRef = useRef(null);

  useEffect(() => {
    if (!winner) setProb(classicProbability(cells, turn));
  }, [cells, turn, winner]);

  useEffect(() => {
    if (aiDifficulty && turn === "O" && !winner && !aiThinking) {
      setAiThinking(true);
      getAIMove('classic', { cells }, 'O', aiDifficulty).then(move => {
        if (move >= 0) {
          const next = cells.map((c,j) => j===move ? 'O' : c);
          const w = checkWin(next);
          setCells(next);
          if (w) { setWinner(w); setWinLine(getWinLine(next)); }
          else setTurn('X');
        }
        setAiThinking(false);
      });
    }
  }, [turn, winner, aiDifficulty, cells, aiThinking]);

  // Announce turn changes and game end for screen readers
  useEffect(() => {
    const curName = turn === "X" ? dn(pX) : dn(pO);
    if (winner) {
      const winName = winner === "X" ? dn(pX) : dn(pO);
      setAnnounce(winner === "T" ? "Game over. Draw!" : `Game over. ${winName} wins!`);
    } else if (aiThinking) {
      setAnnounce("AI is thinking...");
    } else {
      setAnnounce(`${curName}'s turn as ${turn}`);
    }
  }, [turn, winner, aiThinking, pX, pO]);

  function play(i) {
    if (cells[i] || winner || aiThinking) return;
    if (aiDifficulty && turn !== "X") return;
    const next = cells.map((c,j) => j===i ? turn : c);
    const w = checkWin(next);
    setCells(next);
    if (w) { setWinner(w); setWinLine(getWinLine(next)); }
    else setTurn(t => t==="X"?"O":"X");
  }

  function reset() { setCells(Array(9).fill(null)); setTurn("X"); setWinner(null); setWinLine([]); setSaved(false); setRankedSaved(false); setAiThinking(false); onRematch?.(); }

  const handleGridKeyDown = useCallback((e) => {
    const focused = document.activeElement;
    if (!gridRef.current || !gridRef.current.contains(focused)) return;
    const btns = Array.from(gridRef.current.querySelectorAll('button[data-cell]'));
    const idx = btns.indexOf(focused);
    if (idx === -1) return;
    const row = Math.floor(idx / 3), col = idx % 3;
    let next = -1;
    if (e.key === 'ArrowRight') next = row * 3 + ((col + 1) % 3);
    else if (e.key === 'ArrowLeft') next = row * 3 + ((col + 2) % 3);
    else if (e.key === 'ArrowDown') next = ((row + 1) % 3) * 3 + col;
    else if (e.key === 'ArrowUp') next = ((row + 2) % 3) * 3 + col;
    if (next >= 0 && btns[next]) { e.preventDefault(); btns[next].focus(); }
  }, []);

  const curName = turn === "X" ? dn(pX) : dn(pO);
  const winName = winner === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:460, margin:"0 auto" }}>
      {/* Live region for screen reader announcements */}
      <div role="status" aria-live="polite" style={srOnly}>{announce}</div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>
          {aiThinking ? <AiThinking /> : <>Turn: <strong style={{ color: turn==="X"?"var(--X)":"var(--O)" }}>{curName} ({turn})</strong></>}
        </div>
        <button className="smbtn" onClick={onAbandon}>Abandon</button>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={dn(pX)} oName={dn(pO)} />
      <div style={{ position:"relative" }}>
        <div ref={gridRef} role="grid" aria-label="Classic Tic-Tac-Toe board" onKeyDown={handleGridKeyDown} style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:18 }}>
          {cells.map((c,i) => {
            const row = Math.floor(i / 3), col = i % 3;
            const disabled = !!c || !!winner || aiThinking;
            return (
              <button key={i} data-cell={i} onClick={() => play(i)} disabled={disabled}
                aria-label={cellLabel(row, col, c)}
                tabIndex={i === 0 ? 0 : -1}
                style={{
                  aspectRatio:"1", background: winLine.includes(i) ? (c==="X"?"rgba(232,255,71,0.08)":"rgba(71,200,255,0.08)") : "var(--sf)",
                  border:"1px solid "+(winLine.includes(i)?(c==="X"?"var(--X)":"var(--O)"):"var(--bd)"),
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(38px,9vw,68px)",
                  cursor: disabled ? "default" : "pointer",
                  color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent", transition:"all 0.12s",
                  outline:"none",
                }}
                onFocus={e => { if (!disabled) e.target.style.boxShadow = '0 0 0 2px var(--ac)'; }}
                onBlur={e => { e.target.style.boxShadow = 'none'; }}
              >{c}</button>
            );
          })}
        </div>
        {winner && (
          <div role="dialog" aria-label={winner==="T" ? "Draw" : winName + " wins"} style={{ position:"absolute", inset:0, background:"rgba(8,8,14,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:20 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,7vw,52px)", letterSpacing:3, color: winner==="T"?"var(--mu)":winner==="X"?"var(--X)":"var(--O)" }}>
              {winner==="T" ? "Draw!" : winName + " Wins!"}
            </div>
            <div style={{ fontSize:10, letterSpacing:3, color:"var(--mu)", textTransform:"uppercase" }}>
              {winner==="T" ? "No winner" : winName + " defeats " + (winner==="X"?dn(pO):dn(pX))}
            </div>
            {saved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Records Updated</div>}
            {rankedSaved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Ranked Result Saved</div>}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {!saved && !aiDifficulty && <button className="savebtn" onClick={() => { onEnd(winner); setSaved(true); }}>Save Results</button>}
              {canSaveRanked && !rankedSaved && (
                <button className="savebtn" disabled={rankedSaving} onClick={async () => { try { await onSaveRanked(winner); setRankedSaved(true); } catch {} }}>
                  {rankedSaving ? 'Saving...' : 'Save Ranked'}
                </button>
              )}
              <button className="savebtn" style={{ background:"var(--s2)", color:"var(--ac)", border:"1px solid var(--ac)" }} onClick={reset}>Rematch</button>
              <button className="smbtn" onClick={onAbandon}>Back</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display:"flex", justifyContent:"center", gap:22, marginTop:12, fontSize:10, letterSpacing:2, color:"var(--mu)" }}>
        <span style={{ color:"var(--X)" }}>X = {dn(pX)}</span>
        <span style={{ color:"var(--O)" }}>O = {dn(pO)}</span>
      </div>
    </div>
  );
}
