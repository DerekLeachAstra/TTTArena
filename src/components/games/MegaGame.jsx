import { useState, useEffect, useRef, useCallback } from 'react';
import { checkWin } from '../../lib/gameLogic';
import { getAIMove } from '../../ai/engine';
import { megaProbability } from '../../ai/probability';
import WinProbabilityBar from '../WinProbabilityBar';
import { dn } from '../../lib/playerUtils';
import AiThinking from './AiThinking';
import { cellLabel, srOnly } from '../../lib/a11y';

export default function MegaGame({ pX, pO, onEnd, onAbandon, aiDifficulty, canSaveRanked, onSaveRanked, rankedSaving, onRematch }) {
  const E = () => Array(9).fill(null);
  const [cells, setCells] = useState(() => Array(9).fill(null).map(() => Array(9).fill(null).map(E)));
  const [smallW, setSmallW] = useState(() => Array(9).fill(null).map(E));
  const [midW, setMidW] = useState(E);
  const [metaW, setMetaW] = useState(null);
  const [aMid, setAMid] = useState(null);
  const [aSmall, setASmall] = useState(null);
  const [turn, setTurn] = useState("X");
  const [saved, setSaved] = useState(false);
  const [rankedSaved, setRankedSaved] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [prob, setProb] = useState({ x:50, o:50 });
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (!metaW) setProb(megaProbability(smallW, midW));
  }, [smallW, midW, metaW]);

  useEffect(() => {
    if (aiDifficulty && turn === "O" && !metaW && !aiThinking) {
      setAiThinking(true);
      getAIMove('mega', { cells, smallW, midW, aMid, aSmall }, 'O', aiDifficulty).then(move => {
        if (move) {
          const [mi, si, ci] = move;
          applyMove(mi, si, ci, 'O');
        }
        setAiThinking(false);
      });
    }
  }, [turn, metaW, aiDifficulty, cells, smallW, midW, aMid, aSmall, aiThinking]);

  // Announce turn changes and game end
  useEffect(() => {
    const curName = turn === "X" ? dn(pX) : dn(pO);
    if (metaW) {
      const winName = metaW === "X" ? dn(pX) : dn(pO);
      setAnnounce(metaW === "T" ? "Game over. Draw!" : `Game over. ${winName} wins!`);
    } else if (aiThinking) {
      setAnnounce("AI is thinking...");
    } else {
      const loc = aMid === null ? "Play in any mid-board" : aSmall === null ? `Mid ${aMid+1}, any small board` : `Mid ${aMid+1}, Small ${aSmall+1}`;
      setAnnounce(`${curName}'s turn as ${turn}. ${loc}`);
    }
  }, [turn, metaW, aiThinking, aMid, aSmall, pX, pO]);

  function canPlay(mi, si) {
    if (metaW || midW[mi] || smallW[mi][si]) return false;
    if (aMid !== null && aMid !== mi) return false;
    if (aMid === mi && aSmall !== null && aSmall !== si) return false;
    return true;
  }

  function applyMove(mi, si, ci, player) {
    const nc = cells.map((m,m2) => m.map((s,s2) => (m2===mi&&s2===si) ? s.map((c,c2) => c2===ci?player:c) : s));
    const nsw = smallW.map((m,m2) => m.map((w,s2) => (m2===mi&&s2===si&&!w) ? checkWin(nc[m2][s2]) : w));
    const nmw = midW.map((w,m2) => (m2===mi&&!w) ? checkWin(nsw[m2]) : w);
    const nm = checkWin(nmw);
    const nextMid = nmw[si] ? null : si;
    const nextSmall = nextMid===null ? null : (nsw[nextMid][ci] ? null : ci);
    setCells(nc); setSmallW(nsw); setMidW(nmw);
    if (nm) { setMetaW(nm); return; }
    let hasMovesLeft = false;
    for (let m = 0; m < 9 && !hasMovesLeft; m++) {
      if (nmw[m]) continue;
      if (nextMid !== null && nextMid !== m) continue;
      for (let s = 0; s < 9 && !hasMovesLeft; s++) {
        if (nsw[m][s]) continue;
        if (nextMid === m && nextSmall !== null && nextSmall !== s) continue;
        if (nc[m][s].some(c => !c)) hasMovesLeft = true;
      }
    }
    if (!hasMovesLeft) setMetaW('T');
    else { setAMid(nextMid); setASmall(nextSmall); setTurn(t => t==="X"?"O":"X"); }
  }

  function play(mi, si, ci) {
    if (!canPlay(mi,si) || cells[mi][si][ci] || aiThinking) return;
    if (aiDifficulty && turn !== "X") return;
    applyMove(mi, si, ci, turn);
  }

  function reset() {
    setCells(Array(9).fill(null).map(() => Array(9).fill(null).map(E)));
    setSmallW(Array(9).fill(null).map(E)); setMidW(E());
    setMetaW(null); setAMid(null); setASmall(null); setTurn("X"); setSaved(false); setRankedSaved(false); setAiThinking(false); onRematch?.();
  }

  const handleSmallBoardKeyDown = useCallback((mi, si, e) => {
    const focused = document.activeElement;
    const board = e.currentTarget;
    const btns = Array.from(board.querySelectorAll('button[data-cell]'));
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
  const winName = metaW === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:760, margin:"0 auto" }}>
      <div role="status" aria-live="polite" style={srOnly}>{announce}</div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>
          {aiThinking ? <AiThinking /> : <>Turn: <strong style={{ color: turn==="X"?"var(--X)":"var(--O)" }}>{curName} ({turn})</strong></>}
        </div>
        <button className="smbtn" onClick={onAbandon}>Abandon</button>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={dn(pX)} oName={dn(pO)} />
      <div style={{ textAlign:"center", marginBottom:12, fontSize:10, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase", lineHeight:1.8 }}>
        {!metaW && (aMid===null
          ? <span>Play in <strong style={{ color:"var(--mega)" }}>any mid-board</strong></span>
          : aSmall===null
            ? <span>Mid <strong style={{ color:"var(--mega)" }}>{aMid+1}</strong> — <strong style={{ color:"var(--hl)" }}>any small board</strong></span>
            : <span>Mid <strong style={{ color:"var(--mega)" }}>{aMid+1}</strong> / Small <strong style={{ color:"var(--hl)" }}>{aSmall+1}</strong></span>
        )}
      </div>
      <div style={{ position:"relative", overflowX:"auto" }}>
        <div role="grid" aria-label="MEGA Tic-Tac-Toe board" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, minWidth:300 }}>
          {Array(9).fill(null).map((_,mi) => {
            const mw = midW[mi];
            const midAct = !metaW && (aMid===null ? !mw : aMid===mi);
            const midStatus = mw === "X" ? "Won by X" : mw === "O" ? "Won by O" : mw === "T" ? "Draw" : midAct ? "Active" : "Inactive";
            return (
              <div key={mi} role="group" aria-label={`Mid-board ${mi+1}, ${midStatus}`} style={{
                border:"2px solid "+(midAct?"var(--mega)":mw==="X"?"var(--X)":mw==="O"?"var(--O)":"var(--bd)"),
                padding:4, position:"relative",
                background: mw==="X"?"rgba(232,255,71,0.05)":mw==="O"?"rgba(71,200,255,0.05)":"transparent",
                opacity: mw==="T"?0.4:1
              }}>
                {mw && mw !== "T" && (
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(20px,4vw,40px)", color:mw==="X"?"var(--X)":"var(--O)", zIndex:5, pointerEvents:"none" }} aria-hidden="true">{mw}</div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3, opacity:mw?0.15:1 }}>
                  {Array(9).fill(null).map((_2,si) => {
                    const sw = smallW[mi][si];
                    const smAct = canPlay(mi,si);
                    const smallStatus = sw === "X" ? "Won by X" : sw === "O" ? "Won by O" : sw === "T" ? "Draw" : smAct ? "Active" : "Inactive";
                    return (
                      <div key={si} role="group" aria-label={`Mid ${mi+1}, Small ${si+1}, ${smallStatus}`} onKeyDown={(e) => handleSmallBoardKeyDown(mi, si, e)} style={{
                        border:"1px solid "+(smAct&&!sw?"var(--hl)":"var(--s3)"),
                        padding:2, position:"relative",
                        background: sw==="X"?"rgba(232,255,71,0.08)":sw==="O"?"rgba(71,200,255,0.08)":"transparent",
                        opacity: sw==="T"?0.35:1
                      }}>
                        {sw && sw !== "T" && (
                          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(10px,2vw,18px)", color:sw==="X"?"var(--X)":"var(--O)", zIndex:4, pointerEvents:"none" }} aria-hidden="true">{sw}</div>
                        )}
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, opacity:sw?0.15:1 }}>
                          {cells[mi][si].map((c,ci) => {
                            const row = Math.floor(ci / 3), col = ci % 3;
                            const disabled = !!c || !!mw || !!sw || !canPlay(mi,si) || aiThinking;
                            return (
                              <button key={ci} data-cell={ci} onClick={() => play(mi,si,ci)} disabled={disabled}
                                aria-label={cellLabel(row, col, c, `Mid ${mi+1}, Small ${si+1}`)}
                                tabIndex={(mi === (aMid !== null ? aMid : 0) && si === (aSmall !== null ? aSmall : 0) && ci === 0) ? 0 : -1}
                                style={{
                                  aspectRatio:"1", background:"var(--s3)",
                                  display:"flex", alignItems:"center", justifyContent:"center",
                                  fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(7px,1.4vw,13px)",
                                  cursor: disabled ? "default" : "pointer",
                                  color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent",
                                  border:"none", outline:"none",
                                }}
                              >{c}</button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {metaW && (
          <div role="dialog" aria-label={metaW==="T" ? "Draw" : winName + " wins"} style={{ position:"absolute", inset:0, background:"rgba(8,8,14,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:20, zIndex:20 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,7vw,52px)", letterSpacing:3, color: metaW==="T"?"var(--mu)":metaW==="X"?"var(--X)":"var(--O)" }}>
              {metaW==="T" ? "Draw!" : winName + " Wins!"}
            </div>
            {saved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Records Updated</div>}
            {rankedSaved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Ranked Result Saved</div>}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {!saved && !aiDifficulty && <button className="savebtn" onClick={() => { onEnd(metaW); setSaved(true); }}>Save Results</button>}
              {canSaveRanked && !rankedSaved && (
                <button className="savebtn" disabled={rankedSaving} onClick={async () => { try { await onSaveRanked(metaW); setRankedSaved(true); } catch {} }}>
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
