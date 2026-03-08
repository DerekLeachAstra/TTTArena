import { useState, useEffect, useRef, useCallback } from 'react';
import { checkWin } from '../../lib/gameLogic';
import { getAIMove } from '../../ai/engine';
import { ultimateProbability } from '../../ai/probability';
import WinProbabilityBar from '../WinProbabilityBar';
import { dn } from '../../lib/playerUtils';
import AiThinking from './AiThinking';
import { cellLabel, srOnly } from '../../lib/a11y';

export default function UltimateGame({ pX, pO, onEnd, onAbandon, aiDifficulty, canSaveRanked, onSaveRanked, rankedSaving, onRematch }) {
  const E = () => Array(9).fill(null);
  const [boards, setBoards] = useState(() => Array(9).fill(null).map(E));
  const [bWins, setBWins] = useState(E);
  const [active, setActive] = useState(null);
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [saved, setSaved] = useState(false);
  const [rankedSaved, setRankedSaved] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [prob, setProb] = useState({ x:50, o:50 });
  const [announce, setAnnounce] = useState('');
  const gridRef = useRef(null);

  useEffect(() => {
    if (!winner) setProb(ultimateProbability(boards, bWins, active));
  }, [boards, bWins, active, winner]);

  useEffect(() => {
    if (aiDifficulty && turn === "O" && !winner && !aiThinking) {
      setAiThinking(true);
      getAIMove('ultimate', { boards, bWins, active }, 'O', aiDifficulty).then(move => {
        if (move) {
          const [bi, ci] = move;
          applyMove(bi, ci, 'O');
        }
        setAiThinking(false);
      });
    }
  }, [turn, winner, aiDifficulty, boards, bWins, active, aiThinking]);

  // Announce turn changes and game end
  useEffect(() => {
    const curName = turn === "X" ? dn(pX) : dn(pO);
    if (winner) {
      const winName = winner === "X" ? dn(pX) : dn(pO);
      setAnnounce(winner === "T" ? "Game over. Draw!" : `Game over. ${winName} wins!`);
    } else if (aiThinking) {
      setAnnounce("AI is thinking...");
    } else {
      const boardMsg = active === null ? "Play on any open board" : `Must play on Board ${active + 1}`;
      setAnnounce(`${curName}'s turn as ${turn}. ${boardMsg}`);
    }
  }, [turn, winner, aiThinking, active, pX, pO]);

  function applyMove(bi, ci, player) {
    const nb = boards.map((b,i) => i===bi ? b.map((c,j) => j===ci ? player : c) : [...b]);
    const nw = bWins.map((w,i) => i===bi && !w ? checkWin(nb[i]) : w);
    const mw = checkWin(nw);
    const nextActive = nw[ci] ? null : ci;
    setBoards(nb); setBWins(nw); setActive(nextActive);
    if (mw) { setWinner(mw); return; }
    const boardsToCheck = nextActive !== null ? [nextActive] : Array.from({ length: 9 }, (_, i) => i);
    const hasMovesLeft = boardsToCheck.some(b => !nw[b] && nb[b].some(c => !c));
    if (!hasMovesLeft) setWinner('T');
    else setTurn(t => t==="X"?"O":"X");
  }

  function play(bi, ci) {
    if (bWins[bi] || (active !== null && active !== bi) || boards[bi][ci] || winner || aiThinking) return;
    if (aiDifficulty && turn !== "X") return;
    applyMove(bi, ci, turn);
  }

  function reset() { setBoards(Array(9).fill(null).map(E)); setBWins(E()); setActive(null); setTurn("X"); setWinner(null); setSaved(false); setRankedSaved(false); setAiThinking(false); onRematch?.(); }

  const handleBoardKeyDown = useCallback((bi, e) => {
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

  const winName = winner === "X" ? dn(pX) : dn(pO);
  const curName = turn === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <div role="status" aria-live="polite" style={srOnly}>{announce}</div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>
          {aiThinking ? <AiThinking /> : <>Turn: <strong style={{ color: turn==="X"?"var(--X)":"var(--O)" }}>{curName} ({turn})</strong></>}
        </div>
        <button className="smbtn" onClick={onAbandon}>Abandon</button>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={dn(pX)} oName={dn(pO)} />
      <div style={{ textAlign:"center", marginBottom:14, fontSize:11, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase" }}>
        {!winner && (active===null
          ? <span>Play on <strong style={{ color:"var(--hl)" }}>any open board</strong></span>
          : <span>Must play on <strong style={{ color:"var(--hl)" }}>Board {active+1}</strong></span>
        )}
      </div>
      <div style={{ position:"relative" }}>
        <div ref={gridRef} role="grid" aria-label="Ultimate Tic-Tac-Toe board" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {Array(9).fill(null).map((_,bi) => {
            const bw = bWins[bi];
            const isAct = !winner && (active===null ? !bw : active===bi);
            const boardStatus = bw === "X" ? "Won by X" : bw === "O" ? "Won by O" : bw === "T" ? "Draw" : isAct ? "Active" : "Inactive";
            return (
              <div key={bi} role="group" aria-label={`Board ${bi+1}, ${boardStatus}`} onKeyDown={(e) => handleBoardKeyDown(bi, e)} style={{
                border:"2px solid "+(isAct?"var(--hl)":bw==="X"?"var(--X)":bw==="O"?"var(--O)":"var(--bd)"),
                padding:5, position:"relative",
                background: bw==="X"?"rgba(232,255,71,0.06)":bw==="O"?"rgba(71,200,255,0.06)":bw==="T"?"var(--s2)":"var(--sf)"
              }}>
                {bw && (
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(32px,7vw,64px)", color:bw==="X"?"var(--X)":bw==="O"?"var(--O)":"var(--mu)", zIndex:5, pointerEvents:"none" }} aria-hidden="true">
                    {bw==="T"?"\u2014":bw}
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3, opacity:bw?0.2:1 }}>
                  {boards[bi].map((c,ci) => {
                    const row = Math.floor(ci / 3), col = ci % 3;
                    const disabled = !!c || !!bw || !isAct || aiThinking;
                    return (
                      <button key={ci} data-cell={ci} onClick={() => play(bi,ci)} disabled={disabled}
                        aria-label={cellLabel(row, col, c, `Board ${bi+1}`)}
                        tabIndex={(bi === (active !== null ? active : 0) && ci === 0) ? 0 : -1}
                        style={{
                          aspectRatio:"1", background:"var(--s2)", border:"1px solid var(--s3)",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(13px,2.5vw,22px)",
                          cursor: disabled ? "default" : "pointer",
                          color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent",
                          outline:"none",
                        }}
                        onFocus={e => { if (!disabled) e.target.style.boxShadow = '0 0 0 2px var(--ac)'; }}
                        onBlur={e => { e.target.style.boxShadow = 'none'; }}
                      >{c}</button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {winner && (
          <div role="dialog" aria-label={winner==="T" ? "Draw" : winName + " wins"} style={{ position:"absolute", inset:0, background:"rgba(8,8,14,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:20, zIndex:20 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,7vw,52px)", letterSpacing:3, color: winner==="T"?"var(--mu)":winner==="X"?"var(--X)":"var(--O)" }}>
              {winner==="T" ? "Draw!" : winName + " Wins!"}
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
