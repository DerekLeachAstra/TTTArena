import { useState, useEffect, useCallback, useRef } from "react";
import { Routes, Route, NavLink, useNavigate, useLocation, useSearchParams, Navigate } from 'react-router-dom';
import './styles.css';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthModal from './components/AuthModal';
import ProtectedRoute from './components/ProtectedRoute';
import WinProbabilityBar from './components/WinProbabilityBar';
import { checkWin, getWinLine, score, WIN_LINES, calcElo, getRankBadge } from './lib/gameLogic';
import { getAIMove } from './ai/engine';
import { classicProbability, ultimateProbability, megaProbability } from './ai/probability';
import { supabase } from './lib/supabase';
import Profile from './components/Profile';
import PublicProfile from './components/PublicProfile';
import ResetPassword from './components/ResetPassword';
import Leagues from './components/Leagues';
import LiveGame from './components/LiveGame';
import Arena from './components/Arena';

// M4: Default to empty array; existing users keep localStorage data
const INITIAL_PLAYERS = [];

function dn(p) {
  if (p.nickname && p.nickname.trim()) return p.nickname.trim();
  const n = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return n || "Unnamed";
}

function PlayerLabel({ p, color }) {
  const nick = p.nickname && p.nickname.trim();
  const real = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  const style = color ? { color } : {};
  if (nick) return (<span style={{ display:"flex", flexDirection:"column", gap:1 }}><span style={{ ...style, fontFamily:"'DM Mono',monospace", fontWeight:500 }}>"{nick}"</span>{real && <span style={{ fontSize:10, color:"var(--mu)", fontStyle:"italic" }}>{real}</span>}</span>);
  return <span style={{ ...style, fontWeight:500 }}>{real || "Unnamed"}</span>;
}

function overallScore(p) {
  const cs = score(p.cw||0, p.cl||0, p.ct||0);
  const us = score(p.sw||0, p.sl||0, p.st||0);
  const ms = score(p.mw||0, p.ml||0, p.mt||0);
  const hc = (p.cw||0)+(p.cl||0)+(p.ct||0)>0, hu = (p.sw||0)+(p.sl||0)+(p.st||0)>0, hm = (p.mw||0)+(p.ml||0)+(p.mt||0)>0;
  const tot = (hc?1:0)+(hu?3:0)+(hm?5:0);
  if (!tot) return 0;
  return ((hc?cs:0) + (hu?us*3:0) + (hm?ms*5:0)) / tot;
}

function totalGP(p) { return (p.cw||0)+(p.cl||0)+(p.ct||0)+(p.sw||0)+(p.sl||0)+(p.st||0)+(p.mw||0)+(p.ml||0)+(p.mt||0); }
function h2hKey(a, b) { return [a,b].sort().join("__"); }

function AiThinking() {
  return <div className="ai-thinking"><span>AI thinking</span><span className="dot"/><span className="dot"/><span className="dot"/></div>;
}

// ── Classic Game ─────────────────────────────────────────
function ClassicGame({ pX, pO, onEnd, onAbandon, aiDifficulty, canSaveRanked, onSaveRanked, rankedSaving }) {
  const [cells, setCells] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [saved, setSaved] = useState(false);
  const [rankedSaved, setRankedSaved] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [prob, setProb] = useState({ x:50, o:50 });

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

  function play(i) {
    if (cells[i] || winner || aiThinking) return;
    if (aiDifficulty && turn !== "X") return;
    const next = cells.map((c,j) => j===i ? turn : c);
    const w = checkWin(next);
    setCells(next);
    if (w) { setWinner(w); setWinLine(getWinLine(next)); }
    else setTurn(t => t==="X"?"O":"X");
  }

  function reset() { setCells(Array(9).fill(null)); setTurn("X"); setWinner(null); setWinLine([]); setSaved(false); setAiThinking(false); }

  const curName = turn === "X" ? dn(pX) : dn(pO);
  const winName = winner === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:460, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>
          {aiThinking ? <AiThinking /> : <>Turn: <strong style={{ color: turn==="X"?"var(--X)":"var(--O)" }}>{curName} ({turn})</strong></>}
        </div>
        <button className="smbtn" onClick={onAbandon}>Abandon</button>
      </div>
      <WinProbabilityBar xPct={prob.x} oPct={prob.o} xName={dn(pX)} oName={dn(pO)} />
      <div style={{ position:"relative" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:18 }}>
          {cells.map((c,i) => (
            <div key={i} onClick={() => play(i)} style={{
              aspectRatio:"1", background: winLine.includes(i) ? (c==="X"?"rgba(232,255,71,0.08)":"rgba(71,200,255,0.08)") : "var(--sf)",
              border:"1px solid "+(winLine.includes(i)?(c==="X"?"var(--X)":"var(--O)"):"var(--bd)"),
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(38px,9vw,68px)",
              cursor: c||winner||aiThinking ? "default" : "pointer",
              color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent", transition:"all 0.12s"
            }}>{c}</div>
          ))}
        </div>
        {winner && (
          <div style={{ position:"absolute", inset:0, background:"rgba(8,8,14,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:20 }}>
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
                <button className="savebtn" disabled={rankedSaving} onClick={async () => { await onSaveRanked(winner); setRankedSaved(true); }}>
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

// ── Ultimate Game ─────────────────────────────────────────
function UltimateGame({ pX, pO, onEnd, onAbandon, aiDifficulty, canSaveRanked, onSaveRanked, rankedSaving }) {
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

  function applyMove(bi, ci, player) {
    // W9: Copy all boards to avoid shared array references with previous state
    const nb = boards.map((b,i) => i===bi ? b.map((c,j) => j===ci ? player : c) : [...b]);
    const nw = bWins.map((w,i) => i===bi && !w ? checkWin(nb[i]) : w);
    const mw = checkWin(nw);
    setBoards(nb); setBWins(nw); setActive(nw[ci] ? null : ci);
    if (mw) setWinner(mw);
    else setTurn(t => t==="X"?"O":"X");
  }

  function play(bi, ci) {
    if (bWins[bi] || (active !== null && active !== bi) || boards[bi][ci] || winner || aiThinking) return;
    if (aiDifficulty && turn !== "X") return;
    applyMove(bi, ci, turn);
  }

  function reset() { setBoards(Array(9).fill(null).map(E)); setBWins(E()); setActive(null); setTurn("X"); setWinner(null); setSaved(false); setAiThinking(false); }

  const winName = winner === "X" ? dn(pX) : dn(pO);
  const curName = turn === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {Array(9).fill(null).map((_,bi) => {
            const bw = bWins[bi];
            const isAct = !winner && (active===null ? !bw : active===bi);
            return (
              <div key={bi} style={{
                border:"2px solid "+(isAct?"var(--hl)":bw==="X"?"var(--X)":bw==="O"?"var(--O)":"var(--bd)"),
                padding:5, position:"relative",
                background: bw==="X"?"rgba(232,255,71,0.06)":bw==="O"?"rgba(71,200,255,0.06)":bw==="T"?"var(--s2)":"var(--sf)"
              }}>
                {bw && (
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(32px,7vw,64px)", color:bw==="X"?"var(--X)":bw==="O"?"var(--O)":"var(--mu)", zIndex:5, pointerEvents:"none" }}>
                    {bw==="T"?"\u2014":bw}
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3, opacity:bw?0.2:1 }}>
                  {boards[bi].map((c,ci) => (
                    <div key={ci} onClick={() => play(bi,ci)} style={{
                      aspectRatio:"1", background:"var(--s2)", border:"1px solid var(--s3)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(13px,2.5vw,22px)",
                      cursor: (c||bw||!isAct||aiThinking) ? "default" : "pointer",
                      color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent"
                    }}>{c}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {winner && (
          <div style={{ position:"absolute", inset:0, background:"rgba(8,8,14,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:20, zIndex:20 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,7vw,52px)", letterSpacing:3, color: winner==="T"?"var(--mu)":winner==="X"?"var(--X)":"var(--O)" }}>
              {winner==="T" ? "Draw!" : winName + " Wins!"}
            </div>
            {saved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Records Updated</div>}
            {rankedSaved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Ranked Result Saved</div>}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {!saved && !aiDifficulty && <button className="savebtn" onClick={() => { onEnd(winner); setSaved(true); }}>Save Results</button>}
              {canSaveRanked && !rankedSaved && (
                <button className="savebtn" disabled={rankedSaving} onClick={async () => { await onSaveRanked(winner); setRankedSaved(true); }}>
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

// ── MEGA Game ─────────────────────────────────────────────
function MegaGame({ pX, pO, onEnd, onAbandon, aiDifficulty, canSaveRanked, onSaveRanked, rankedSaving }) {
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
    const nextMid = nmw[ci] ? null : ci;
    const nextSmall = nextMid===null ? null : (nsw[nextMid][ci] ? null : ci);
    setCells(nc); setSmallW(nsw); setMidW(nmw);
    if (nm) setMetaW(nm);
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
    setMetaW(null); setAMid(null); setASmall(null); setTurn("X"); setSaved(false); setAiThinking(false);
  }

  const curName = turn === "X" ? dn(pX) : dn(pO);
  const winName = metaW === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:760, margin:"0 auto" }}>
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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, minWidth:300 }}>
          {Array(9).fill(null).map((_,mi) => {
            const mw = midW[mi];
            const midAct = !metaW && (aMid===null ? !mw : aMid===mi);
            return (
              <div key={mi} style={{
                border:"2px solid "+(midAct?"var(--mega)":mw==="X"?"var(--X)":mw==="O"?"var(--O)":"var(--bd)"),
                padding:4, position:"relative",
                background: mw==="X"?"rgba(232,255,71,0.05)":mw==="O"?"rgba(71,200,255,0.05)":"transparent",
                opacity: mw==="T"?0.4:1
              }}>
                {mw && mw !== "T" && (
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(20px,4vw,40px)", color:mw==="X"?"var(--X)":"var(--O)", zIndex:5, pointerEvents:"none" }}>{mw}</div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3, opacity:mw?0.15:1 }}>
                  {Array(9).fill(null).map((_2,si) => {
                    const sw = smallW[mi][si];
                    const smAct = canPlay(mi,si);
                    return (
                      <div key={si} style={{
                        border:"1px solid "+(smAct&&!sw?"var(--hl)":"var(--s3)"),
                        padding:2, position:"relative",
                        background: sw==="X"?"rgba(232,255,71,0.08)":sw==="O"?"rgba(71,200,255,0.08)":"transparent",
                        opacity: sw==="T"?0.35:1
                      }}>
                        {sw && sw !== "T" && (
                          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(10px,2vw,18px)", color:sw==="X"?"var(--X)":"var(--O)", zIndex:4, pointerEvents:"none" }}>{sw}</div>
                        )}
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, opacity:sw?0.15:1 }}>
                          {cells[mi][si].map((c,ci) => (
                            <div key={ci} onClick={() => play(mi,si,ci)} style={{
                              aspectRatio:"1", background:"var(--s3)",
                              display:"flex", alignItems:"center", justifyContent:"center",
                              fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(7px,1.4vw,13px)",
                              cursor: (c||mw||sw||!canPlay(mi,si)||aiThinking) ? "default" : "pointer",
                              color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent"
                            }}>{c}</div>
                          ))}
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
          <div style={{ position:"absolute", inset:0, background:"rgba(8,8,14,0.92)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14, padding:20, zIndex:20 }}>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(28px,7vw,52px)", letterSpacing:3, color: metaW==="T"?"var(--mu)":metaW==="X"?"var(--X)":"var(--O)" }}>
              {metaW==="T" ? "Draw!" : winName + " Wins!"}
            </div>
            {saved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Records Updated</div>}
            {rankedSaved && <div style={{ fontSize:10, letterSpacing:2, color:"var(--gn)", textTransform:"uppercase" }}>Ranked Result Saved</div>}
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {!saved && !aiDifficulty && <button className="savebtn" onClick={() => { onEnd(metaW); setSaved(true); }}>Save Results</button>}
              {canSaveRanked && !rankedSaved && (
                <button className="savebtn" disabled={rankedSaving} onClick={async () => { await onSaveRanked(metaW); setRankedSaved(true); }}>
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

// ── Game Setup ────────────────────────────────────────────
function GameSetup({ players, mode, onStart, onStartAI, isAuthenticated }) {
  const [xId, setXId] = useState("");
  const [oId, setOId] = useState("");
  const [playMode, setPlayMode] = useState("ai");
  const pX = players.find(p => p.id === +xId);
  const pO = players.find(p => p.id === +oId);
  const ok = pX && pO && pX.id !== pO.id;
  const isMega = mode === "mega", isUlt = mode === "ultimate";
  const accent = isMega ? "var(--mega)" : isUlt ? "var(--O)" : "var(--ac)";
  const title = isMega ? "MEGA Tic-Tac-Toe" : isUlt ? "Ultimate Tic-Tac-Toe" : "Classic Tic-Tac-Toe";
  const desc = isMega
    ? "Three layers deep. Win small boards to claim mid-board cells. Win mid-boards to win."
    : isUlt
    ? "Nine boards in a 3x3 grid. Win 3 boards in a row to win. Cell position determines opponent's next board."
    : "Classic 3x3 Tic-Tac-Toe. First to get three in a row wins.";
  const sorted = [...players].sort((a,b) => dn(a).localeCompare(dn(b)));
  const difficulties = ['easy','medium','hard','unbeatable'];

  return (
    <div style={{ maxWidth:540, margin:"0 auto" }}>
      <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderTop:"3px solid "+accent, padding:30, marginBottom:18 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:34, letterSpacing:2, color:accent, marginBottom:6 }}>{title}</div>
        <div style={{ fontSize:11, color:"var(--mu)", letterSpacing:"1.5px", marginBottom:22, lineHeight:1.9 }}>{desc}</div>

        <div style={{ display:"flex", gap:2, marginBottom:22, borderBottom:"1px solid var(--bd)" }}>
          {[{id:"ai",label:"Play vs AI"},{id:"local",label:"Local Play"}].map(t => (
            <button key={t.id} onClick={() => setPlayMode(t.id)} style={{
              background:"none", border:"none", borderBottom:"2px solid "+(playMode===t.id?accent:"transparent"),
              color: playMode===t.id?accent:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10,
              letterSpacing:2, textTransform:"uppercase", padding:"9px 16px", cursor:"pointer", marginBottom:-1
            }}>{t.label}</button>
          ))}
        </div>

        {playMode === "ai" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)" }}>Select Difficulty</div>
              {isAuthenticated && (
                <div style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 8px", background:"rgba(168,85,247,0.12)", border:"1px solid rgba(168,85,247,0.3)", borderRadius:999 }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:"var(--hl)" }}/>
                  <span style={{ fontSize:9, letterSpacing:2, color:"var(--hl)", textTransform:"uppercase" }}>Ranked</span>
                </div>
              )}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
              {difficulties.map(d => (
                <button key={d} onClick={() => onStartAI(d)} style={{
                  background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)",
                  fontFamily:"'DM Mono',monospace", fontSize:12, letterSpacing:2, textTransform:"uppercase",
                  padding:"14px 12px", cursor:"pointer", transition:"all 0.15s",
                  borderColor: d==='unbeatable'?'var(--rd)':d==='hard'?accent:'var(--bd)'
                }}
                onMouseOver={e => { e.target.style.borderColor = accent; e.target.style.color = accent; }}
                onMouseOut={e => { e.target.style.borderColor = d==='unbeatable'?'var(--rd)':d==='hard'?accent:'var(--bd)'; e.target.style.color = 'var(--tx)'; }}
                >{d}{d==='unbeatable' ? ' \u{1F480}' : ''}</button>
              ))}
            </div>
          </div>
        )}

        {playMode === "local" && (
          <div>
            <div style={{ display:"flex", gap:14, marginBottom:22, flexWrap:"wrap" }}>
              <div style={{ flex:1, minWidth:130 }}>
                <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", marginBottom:7, color:"var(--mu)" }}>Player <span style={{ fontFamily:"'Bebas Neue'", fontSize:15, color:"var(--X)" }}>X</span></div>
                <select value={xId} onChange={e=>setXId(e.target.value)} style={{ width:"100%", background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 12px", outline:"none" }}>
                  <option value="">Select player...</option>
                  {sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}
                </select>
              </div>
              <div style={{ display:"flex", alignItems:"flex-end", paddingBottom:10, fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"var(--a2)", letterSpacing:2 }}>VS</div>
              <div style={{ flex:1, minWidth:130 }}>
                <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", marginBottom:7, color:"var(--mu)" }}>Player <span style={{ fontFamily:"'Bebas Neue'", fontSize:15, color:"var(--O)" }}>O</span></div>
                <select value={oId} onChange={e=>setOId(e.target.value)} style={{ width:"100%", background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 12px", outline:"none" }}>
                  <option value="">Select player...</option>
                  {sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}
                </select>
              </div>
            </div>
            <button disabled={!ok} onClick={() => onStart(pX, pO)} style={{
              width:"100%", background:ok?accent:"var(--bd)", color:ok?"var(--bg)":"var(--mu)",
              fontFamily:"'DM Mono',monospace", fontSize:12, letterSpacing:4, textTransform:"uppercase",
              border:"none", padding:13, cursor:ok?"pointer":"not-allowed", fontWeight:500
            }}>{ok ? "Start \u2014 " + dn(pX) + " vs " + dn(pO) : "Select Two Players to Begin"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// Standings component removed — replaced by Arena.jsx landing page

// ── H2H (Online) ─────────────────────────────────────────
function OnlineH2H({ userId }) {
  const [opponents, setOpponents] = useState([]);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    async function fetchOpponents() {
      setLoading(true);
      // Get all PvP matches for this user (exclude AI games)
      const { data } = await supabase
        .from('ttt_matches')
        .select('*, player_x:ttt_profiles!player_x_id(display_name, username), player_o:ttt_profiles!player_o_id(display_name, username)')
        .or(`player_x_id.eq.${userId},player_o_id.eq.${userId}`)
        .is('ai_difficulty', null)
        .order('created_at', { ascending: false });

      if (data) {
        // Group by opponent
        const oppMap = {};
        data.forEach(m => {
          const isX = m.player_x_id === userId;
          const oppId = isX ? m.player_o_id : m.player_x_id;
          if (!oppId) return; // skip if no opponent
          const oppProfile = isX ? m.player_o : m.player_x;
          if (!oppMap[oppId]) {
            oppMap[oppId] = {
              id: oppId,
              name: oppProfile?.display_name || 'Unknown',
              username: oppProfile?.username,
              wins: 0, losses: 0, draws: 0, matches: [],
            };
          }
          if (m.is_draw) oppMap[oppId].draws++;
          else if (m.winner_id === userId) oppMap[oppId].wins++;
          else oppMap[oppId].losses++;
          oppMap[oppId].matches.push(m);
        });
        const oppList = Object.values(oppMap).sort((a, b) => (b.wins + b.losses + b.draws) - (a.wins + a.losses + a.draws));
        setOpponents(oppList);
      }
      setLoading(false);
    }
    fetchOpponents();
  }, [userId]);

  const opp = selectedOpp ? opponents.find(o => o.id === selectedOpp) : null;
  const allMatches = opp ? opp.matches : [];
  const shown = filter === "all" ? allMatches : allMatches.filter(m => m.game_mode === filter);

  if (loading) return <div className="ai-thinking" style={{ justifyContent:"center", padding:40 }}><span>Loading</span><span className="dot"/><span className="dot"/><span className="dot"/></div>;

  if (opponents.length === 0) {
    return (
      <div style={{ textAlign:"center", color:"var(--mu)", fontSize:11, letterSpacing:2, padding:40, border:"1px dashed var(--bd)" }}>
        No PvP matches yet. Play ranked online games to build your head-to-head records.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize:10, letterSpacing:3, color:"var(--ac)", textTransform:"uppercase", marginBottom:14, display:"flex", alignItems:"center", gap:12 }}>
        Your Opponents
        <span style={{ flex:1, height:1, background:"var(--bd)" }} />
      </div>

      {/* Opponent list */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))", gap:8, marginBottom:24 }}>
        {opponents.map(o => {
          const total = o.wins + o.losses + o.draws;
          const isSelected = selectedOpp === o.id;
          return (
            <div key={o.id} onClick={() => setSelectedOpp(isSelected ? null : o.id)} style={{
              background: isSelected ? "rgba(232,255,71,0.06)" : "var(--sf)",
              border: "1px solid " + (isSelected ? "var(--ac)" : "var(--bd)"),
              padding: "14px 16px", cursor: "pointer", transition: "all 0.15s"
            }}>
              <div style={{ fontWeight:500, fontSize:13, marginBottom:4 }}>{o.name}</div>
              {o.username && <div style={{ fontSize:10, color:"var(--mu)", fontFamily:"'DM Mono',monospace", marginBottom:6 }}>@{o.username}</div>}
              <div style={{ display:"flex", gap:10, fontSize:11 }}>
                <span style={{ color:"var(--gn)" }}>{o.wins}W</span>
                <span style={{ color:"var(--rd)" }}>{o.losses}L</span>
                <span style={{ color:"var(--a3)" }}>{o.draws}D</span>
                <span style={{ color:"var(--mu)", marginLeft:"auto" }}>{total} games</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected opponent detail */}
      {opp && (
        <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", padding:26 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22, gap:12, flexWrap:"wrap" }}>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>You</div>
            </div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:"var(--a2)" }}>VS</div>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>{opp.name}</div>
            </div>
          </div>
          <div style={{ display:"flex", border:"1px solid var(--bd)", marginBottom:18 }}>
            {[{v:opp.wins,l:"Your Wins",hi:opp.wins>opp.losses},{v:opp.draws,l:"Draws",hi:false},{v:opp.losses,l:opp.name.split(" ")[0]+" Wins",hi:opp.losses>opp.wins}].map((item,i) => (
              <div key={i} style={{ flex:1, textAlign:"center", padding:"13px 6px", borderRight:i<2?"1px solid var(--bd)":"none" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color: item.hi?"var(--gn)":i===1?"var(--a3)":"var(--tx)" }}>{item.v}</div>
                <div style={{ fontSize:9, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginTop:3 }}>{item.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
            <span style={{ fontSize:9, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase" }}>Filter:</span>
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"5px 9px", outline:"none" }}>
              <option value="all">All ({allMatches.length})</option><option value="classic">Classic</option><option value="ultimate">Ultimate</option><option value="mega">MEGA</option>
            </select>
          </div>
          <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:10 }}>Match History ({shown.length})</div>
          {shown.length === 0
            ? <div style={{ color:"var(--mu)", fontSize:11, letterSpacing:2, textAlign:"center", padding:22, border:"1px dashed var(--bd)" }}>No matches in this mode</div>
            : shown.map(m => {
              const won = m.winner_id === userId;
              const draw = m.is_draw;
              const isX = m.player_x_id === userId;
              const eloChange = isX ? m.elo_change_x : m.elo_change_o;
              const modeColor = m.game_mode === 'classic' ? 'var(--X)' : m.game_mode === 'ultimate' ? 'var(--O)' : 'var(--mega)';
              return (
                <div key={m.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderBottom:"1px solid var(--bd)", fontSize:12 }}>
                  <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, padding:"3px 10px", minWidth:46, textAlign:"center",
                    background: draw?"rgba(71,200,255,0.1)":won?"rgba(71,255,154,0.1)":"rgba(255,71,87,0.1)",
                    color: draw?"var(--a3)":won?"var(--gn)":"var(--rd)" }}>
                    {draw ? "DRAW" : won ? "WIN" : "LOSS"}
                  </span>
                  <span style={{ fontSize:10, letterSpacing:1, color:modeColor, textTransform:"uppercase", minWidth:60 }}>{m.game_mode}</span>
                  <span style={{ flex:1 }} />
                  {eloChange !== 0 && eloChange != null && (
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:eloChange>0?"var(--gn)":"var(--rd)" }}>
                      {eloChange>0?"+":""}{eloChange}
                    </span>
                  )}
                  <span style={{ fontSize:10, color:"var(--mu)" }}>{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ── H2H (Local) ──────────────────────────────────────────
function LocalH2H({ players, h2hData, onDel, onAdd }) {
  const [pAid, setPAid] = useState(""); const [pBid, setPBid] = useState("");
  const [res, setRes] = useState("W"); const [note, setNote] = useState(""); const [date, setDate] = useState(""); const [filter, setFilter] = useState("all");
  const sorted = [...players].sort((a,b) => dn(a).localeCompare(dn(b)));
  const pA = players.find(p => p.id === +pAid), pB = players.find(p => p.id === +pBid);
  const key = pA && pB ? h2hKey(pA.id, pB.id) : null;
  const all = key ? (h2hData[key] || []) : [];
  const shown = filter === "all" ? all : all.filter(e => e.mode === filter);
  const aW = shown.filter(e => !e.tie && e.winner===pA?.id).length;
  const bW = shown.filter(e => !e.tie && e.winner===pB?.id).length;
  const ties = shown.filter(e => e.tie).length;
  const logMode = filter === "all" ? "ultimate" : filter;
  function doAdd() {
    if (!pA || !pB || pA.id === pB.id) return;
    const d = date || new Date().toLocaleDateString();
    const w = res === "T" ? null : res === "W" ? pA.id : pB.id;
    onAdd(h2hKey(pA.id,pB.id), { id:Date.now(), winner:w, tie:res==="T", note:note.trim()||logMode+" match", date:d, mode:logMode });
    setNote(""); setDate("");
  }
  const sel = { background:"var(--sf)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none", cursor:"pointer", minWidth:150, appearance:"none" };

  if (players.length === 0) {
    return (
      <div style={{ textAlign:"center", color:"var(--mu)", fontSize:11, letterSpacing:2, padding:40, border:"1px dashed var(--bd)" }}>
        No local players. Add players from the Manage tab to use local H2H tracking.
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", marginBottom:26 }}>
        <select value={pAid} onChange={e=>setPAid(e.target.value)} style={sel}><option value="">Player A</option>{sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}</select>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"var(--a2)", letterSpacing:2 }}>VS</div>
        <select value={pBid} onChange={e=>setPBid(e.target.value)} style={sel}><option value="">Player B</option>{sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}</select>
      </div>
      {pA && pB && pA.id !== pB.id ? (
        <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", padding:26 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22, gap:12, flexWrap:"wrap" }}>
            <div style={{ textAlign:"center", flex:1 }}><div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>{dn(pA)}</div></div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:"var(--a2)" }}>VS</div>
            <div style={{ textAlign:"center", flex:1 }}><div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>{dn(pB)}</div></div>
          </div>
          <div style={{ display:"flex", border:"1px solid var(--bd)", marginBottom:18 }}>
            {[{v:aW,l:dn(pA).split(" ")[0]+" Wins",hi:aW>bW},{v:ties,l:"Ties",hi:false},{v:bW,l:dn(pB).split(" ")[0]+" Wins",hi:bW>aW}].map((item,i) => (
              <div key={i} style={{ flex:1, textAlign:"center", padding:"13px 6px", borderRight:i<2?"1px solid var(--bd)":"none" }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, color: item.hi?"var(--gn)":i===1?"var(--a3)":"var(--tx)" }}>{item.v}</div>
                <div style={{ fontSize:9, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginTop:3 }}>{item.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14, alignItems:"center" }}>
            <span style={{ fontSize:9, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase" }}>Filter:</span>
            <select value={filter} onChange={e=>setFilter(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:11, padding:"5px 9px", outline:"none" }}>
              <option value="all">All ({all.length})</option><option value="classic">Classic</option><option value="ultimate">Ultimate</option><option value="mega">MEGA</option>
            </select>
          </div>
          <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:10 }}>Match History ({shown.length})</div>
          {shown.length === 0
            ? <div style={{ color:"var(--mu)", fontSize:11, letterSpacing:2, textAlign:"center", padding:22, border:"1px dashed var(--bd)" }}>No matches recorded</div>
            : shown.map(e => (
              <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid var(--bd)", fontSize:12 }}>
                <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, padding:"3px 10px", background:e.tie?"rgba(71,200,255,0.12)":e.winner===pA.id?"rgba(71,255,154,0.12)":"rgba(255,71,87,0.12)", color:e.tie?"var(--a3)":e.winner===pA.id?"var(--gn)":"var(--rd)" }}>
                  {e.tie ? "TIE" : e.winner===pA.id ? dn(pA).split(" ")[0]+" W" : dn(pB).split(" ")[0]+" W"}
                </span>
                <span style={{ flex:1, color:"var(--mu)", fontSize:11 }}>{e.note||"\u2014"}</span>
                <span style={{ fontSize:11, color:"var(--mu)" }}>{e.date}</span>
                <button onClick={() => onDel(key,e.id)} style={{ background:"none", border:"none", color:"var(--bd)", cursor:"pointer", fontSize:13 }}>x</button>
              </div>
            ))}
          <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap", alignItems:"flex-end" }}>
            <select value={res} onChange={e=>setRes(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none" }}>
              <option value="W">{dn(pA)} Wins</option><option value="L">{dn(pB)} Wins</option><option value="T">Tie</option>
            </select>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note" onKeyDown={e=>e.key==="Enter"&&doAdd()} style={{ flex:1, minWidth:110, background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none" }}/>
            <button className="savebtn" onClick={doAdd}>+ Log</button>
          </div>
        </div>
      ) : <div style={{ color:"var(--mu)", fontSize:12, letterSpacing:2, textAlign:"center", padding:40 }}>Select two different players to view head-to-head</div>}
    </div>
  );
}

// ── H2H (Combined) ───────────────────────────────────────
function H2H({ players, h2hData, onDel, onAdd, user }) {
  const [view, setView] = useState(user ? "online" : "local");

  return (
    <div>
      {/* View toggle — only show if user is signed in and has local players */}
      {user && players.length > 0 && (
        <div style={{ display:"flex", gap:2, marginBottom:24, borderBottom:"1px solid var(--bd)" }}>
          {[{id:"online",label:"Online Records"},{id:"local",label:"Local Players"}].map(t => (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              background:"none", border:"none", borderBottom:"2px solid "+(view===t.id?"var(--ac)":"transparent"),
              color:view===t.id?"var(--ac)":"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10,
              letterSpacing:2, textTransform:"uppercase", padding:"9px 16px", cursor:"pointer", marginBottom:-1
            }}>{t.label}</button>
          ))}
        </div>
      )}

      {user && view === "online" ? (
        <OnlineH2H userId={user.id} />
      ) : (
        <LocalH2H players={players} h2hData={h2hData} onDel={onDel} onAdd={onAdd} />
      )}
    </div>
  );
}

// ── Manage ────────────────────────────────────────────────
function Manage({ players, setPlayers, onEdit, onDel, onReset }) {
  const [tab, setTab] = useState("ultimate");
  const [fn, setFn] = useState(""); const [ln, setLn] = useState(""); const [nick, setNick] = useState("");
  const [w, setW] = useState(""); const [l, setL] = useState(""); const [t, setT] = useState(""); const [mode, setMode] = useState("ultimate");
  const modes = { classic:{wf:"cw",lf:"cl",tf:"ct",label:"Classic",ac:"var(--X)"}, ultimate:{wf:"sw",lf:"sl",tf:"st",label:"Ultimate",ac:"var(--O)"}, mega:{wf:"mw",lf:"ml",tf:"mt",label:"MEGA",ac:"var(--mega)"} };
  const mc = modes[tab]; const sorted = [...players].sort((a,b) => dn(a).localeCompare(dn(b)));
  function addPlayer() {
    if (!fn.trim()) return;
    const isU=mode==="ultimate", isM=mode==="mega";
    setPlayers(ps => [...ps, { id:Date.now(), firstName:fn.trim(), lastName:ln.trim(), nickname:nick.trim(),
      cw:(!isU&&!isM)?(+w||0):0, cl:(!isU&&!isM)?(+l||0):0, ct:(!isU&&!isM)?(+t||0):0,
      sw:isU?(+w||0):0, sl:isU?(+l||0):0, st:isU?(+t||0):0,
      mw:isM?(+w||0):0, ml:isM?(+l||0):0, mt:isM?(+t||0):0 }]);
    setFn(""); setLn(""); setNick(""); setW(""); setL(""); setT("");
  }
  function adj(pid, field, delta) { setPlayers(ps => ps.map(p => p.id===pid ? {...p, [field]:Math.max(0,(p[field]||0)+delta)} : p)); }
  const inp = { background:"var(--sf)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none" };
  const btnStyle = (up) => ({ background:"none", border:"1px solid var(--bd)", color:up?"var(--gn)":"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:10, padding:"1px 6px", cursor:"pointer", lineHeight:1 });
  return (
    <>
      <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderTop:"3px solid var(--ac)", padding:24, marginBottom:26 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:2, color:"var(--ac)", marginBottom:16 }}>Add Player</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:12 }}>
          <input style={{...inp, flex:1, minWidth:100}} placeholder="First Name *" value={fn} onChange={e=>setFn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()}/>
          <input style={{...inp, flex:1, minWidth:100}} placeholder="Last Name" value={ln} onChange={e=>setLn(e.target.value)}/>
          <input style={{...inp, flex:1, minWidth:100}} placeholder="Nickname" value={nick} onChange={e=>setNick(e.target.value)}/>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
          <select value={mode} onChange={e=>setMode(e.target.value)} style={{...inp, minWidth:120}}><option value="classic">Classic</option><option value="ultimate">Ultimate</option><option value="mega">MEGA</option></select>
          <input style={{...inp, width:60}} type="number" min="0" placeholder="W" value={w} onChange={e=>setW(e.target.value)}/>
          <input style={{...inp, width:60}} type="number" min="0" placeholder="L" value={l} onChange={e=>setL(e.target.value)}/>
          <input style={{...inp, width:60}} type="number" min="0" placeholder="T" value={t} onChange={e=>setT(e.target.value)}/>
          <button className="savebtn" onClick={addPlayer}>+ Add</button>
        </div>
      </div>
      <div style={{ display:"flex", gap:2, marginBottom:20, borderBottom:"1px solid var(--bd)" }}>
        {Object.entries(modes).map(([k,v]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background:"none", border:"none", borderBottom:"2px solid "+(tab===k?v.ac:"transparent"), color:tab===k?v.ac:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:2, textTransform:"uppercase", padding:"9px 16px", cursor:"pointer", marginBottom:-1 }}>{v.label}</button>
        ))}
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr style={{ borderBottom:"2px solid "+mc.ac }}>
            <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"left" }}>Player</th>
            <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>W</th>
            <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>L</th>
            <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>T</th>
            <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>GP</th>
            <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>Q?</th>
            <th></th><th></th>
          </tr></thead>
          <tbody>
            {sorted.map(p => {
              const mw=p[mc.wf]||0, ml=p[mc.lf]||0, mt=p[mc.tf]||0, mgp=mw+ml+mt, mq=mgp>=3;
              const stepStyle = { display:"flex", alignItems:"center", gap:4 };
              return (
                <tr key={p.id} style={{ borderBottom:"1px solid var(--bd)" }}>
                  <td style={{ padding:"12px 12px", fontWeight:500 }}>{dn(p)}</td>
                  <td style={{ padding:"12px 12px", textAlign:"right" }}><div style={stepStyle}><span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:mc.ac, minWidth:22, textAlign:"center" }}>{mw}</span><div style={{ display:"flex", flexDirection:"column", gap:1 }}><button style={btnStyle(true)} onClick={()=>adj(p.id,mc.wf,1)}>+</button><button style={btnStyle(false)} onClick={()=>adj(p.id,mc.wf,-1)}>-</button></div></div></td>
                  <td style={{ padding:"12px 12px", textAlign:"right" }}><div style={stepStyle}><span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:mc.ac, minWidth:22, textAlign:"center" }}>{ml}</span><div style={{ display:"flex", flexDirection:"column", gap:1 }}><button style={btnStyle(true)} onClick={()=>adj(p.id,mc.lf,1)}>+</button><button style={btnStyle(false)} onClick={()=>adj(p.id,mc.lf,-1)}>-</button></div></div></td>
                  <td style={{ padding:"12px 12px", textAlign:"right" }}><div style={stepStyle}><span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:mc.ac, minWidth:22, textAlign:"center" }}>{mt}</span><div style={{ display:"flex", flexDirection:"column", gap:1 }}><button style={btnStyle(true)} onClick={()=>adj(p.id,mc.tf,1)}>+</button><button style={btnStyle(false)} onClick={()=>adj(p.id,mc.tf,-1)}>-</button></div></div></td>
                  <td style={{ padding:"12px 12px", textAlign:"right", fontSize:12, color:"var(--mu)" }}>{mgp}</td>
                  <td style={{ padding:"12px 12px", textAlign:"right", fontSize:12, color:mq?"var(--gn)":"var(--rd)" }}>{mq?"Y":"N"}</td>
                  <td style={{ padding:"12px 4px" }}><button className="smbtn" onClick={()=>onEdit({...p})}>Edit</button></td>
                  <td style={{ padding:"12px 4px" }}><button onClick={()=>onDel(p.id)} style={{ background:"none", border:"none", color:"var(--mu)", cursor:"pointer", fontSize:12, padding:"4px 8px" }}>x</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:40, paddingTop:22, borderTop:"1px solid var(--bd)", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <span style={{ fontSize:10, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase" }}>Danger Zone</span>
        <button onClick={onReset} style={{ background:"none", border:"1px solid var(--rd)", color:"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", padding:"12px 16px", cursor:"pointer" }}>Reset All Data</button>
      </div>
    </>
  );
}

// ── Edit Modal ────────────────────────────────────────────
function EditModal({ p, onSave, onDel, onClose }) {
  const [ep, setEp] = useState(p);
  const inp = { width:"100%", background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:14, padding:"10px 12px", outline:"none" };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderTop:"3px solid var(--ac)", padding:30, width:"100%", maxWidth:500, maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:30, letterSpacing:2, color:"var(--ac)", marginBottom:22 }}>Edit Player</div>
        <div style={{ display:"flex", gap:10, marginBottom:14 }}>
          <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>First</label><input style={inp} value={ep.firstName||""} onChange={e=>setEp(x=>({...x,firstName:e.target.value}))}/></div>
          <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Last</label><input style={inp} value={ep.lastName||""} onChange={e=>setEp(x=>({...x,lastName:e.target.value}))}/></div>
        </div>
        <div style={{ marginBottom:14 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Nickname</label><input style={inp} value={ep.nickname||""} placeholder="e.g. The Champ" onChange={e=>setEp(x=>({...x,nickname:e.target.value}))}/></div>
        {[{label:"Classic",color:"var(--X)",wf:"cw",lf:"cl",tf:"ct"},{label:"Ultimate",color:"var(--O)",wf:"sw",lf:"sl",tf:"st"},{label:"MEGA",color:"var(--mega)",wf:"mw",lf:"ml",tf:"mt"}].map(sec => (
          <div key={sec.wf}>
            <div style={{ fontSize:10, letterSpacing:3, color:sec.color, textTransform:"uppercase", margin:"18px 0 8px", borderTop:"1px solid var(--bd)", paddingTop:14 }}>{sec.label}</div>
            <div style={{ display:"flex", gap:10 }}>
              {['W','L','T'].map((x,i) => { const f = [sec.wf,sec.lf,sec.tf][i]; return (
                <div key={x} style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>{x}</label><input style={inp} type="number" min="0" value={ep[f]||0} onChange={e=>setEp(x2=>({...x2,[f]:parseInt(e.target.value,10)||0}))}/></div>
              );})}
            </div>
          </div>
        ))}
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          <button onClick={onClose} className="smbtn" style={{ flex:1, padding:12 }}>Cancel</button>
          <button onClick={()=>onDel(ep.id)} style={{ background:"none", border:"1px solid var(--rd)", color:"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", padding:"12px 16px", cursor:"pointer" }}>Delete</button>
          <button onClick={()=>onSave(ep)} className="savebtn" style={{ flex:1, padding:12 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm ───────────────────────────────────────────────
function Confirm({ title, msg, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div style={{ background:"var(--sf)", border:"1px solid var(--rd)", borderTop:"3px solid var(--rd)", padding:28, width:"100%", maxWidth:380, textAlign:"center" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:2, color:"var(--rd)", marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:11, color:"var(--mu)", letterSpacing:"1.5px", lineHeight:1.8, marginBottom:22 }}>{msg}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} className="smbtn" style={{ flex:1, padding:12 }}>Cancel</button>
          <button onClick={()=>{ onConfirm(); }} style={{ background:"none", border:"1px solid var(--rd)", color:"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", padding:"12px 16px", cursor:"pointer" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── LiveGame URL wrapper ─────────────────────────────────
function LiveGameWrapper() {
  const [searchParams] = useSearchParams();
  const leagueId = searchParams.get('leagueId');
  const leagueName = searchParams.get('leagueName');
  return <LiveGame leagueId={leagueId} leagueName={leagueName} />;
}

// ── Main App ─────────────────────────────────────────────

function AppContent() {
  const { user, profile, loading, isGuest, signOut, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const load = (key, def) => { try { const s=localStorage.getItem(key); return s?JSON.parse(s):def; } catch { return def; } };
  const [players, setPlayers]   = useState(() => load("ttta_p", INITIAL_PLAYERS));
  const [h2hData, setH2hData]   = useState(() => load("ttta_h", {}));
  const [gameState, setGameState] = useState(null);
  const [aiGame, setAiGame]     = useState(null); // { difficulty, mode }
  const [editP, setEditP]       = useState(null);
  const [confirm, setConfirm]   = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [globalStats, setGlobalStats] = useState([]);
  const [rankedSaving, setRankedSaving] = useState(false);
  const gameStartRef = useRef(null);

  // Navigation helper — clears game state before navigating
  function navigateTo(path) {
    setGameState(null); setAiGame(null); setConfirm(null);
    navigate(path);
  }

  // Nav links — auth-dependent (guests get limited nav)
  const NAV_LINKS = user && !isGuest
    ? [
        { to:"/",         label:"Arena" },
        { to:"/profile",  label:"Profile" },
        { to:"/classic",  label:"Classic" },
        { to:"/ultimate", label:"Ultimate TTT" },
        { to:"/mega",     label:"MEGA" },
        { to:"/leagues",  label:"Leagues" },
        { to:"/h2h",      label:"Head-to-Head" },
      ]
    : [
        { to:"/",         label:"Arena" },
        { to:"/classic",  label:"Classic" },
        { to:"/ultimate", label:"Ultimate TTT" },
        { to:"/mega",     label:"MEGA" },
        { to:"/live",     label:"Live" },
      ];

  useEffect(() => { try { localStorage.setItem("ttta_p", JSON.stringify(players)); } catch {} }, [players]);
  useEffect(() => { try { localStorage.setItem("ttta_h", JSON.stringify(h2hData)); } catch {} }, [h2hData]);

  // Clear game state when navigating away from game pages
  useEffect(() => {
    const gamePaths = ['/classic', '/ultimate', '/mega'];
    if (!gamePaths.includes(location.pathname)) {
      setGameState(null);
      setAiGame(null);
    }
  }, [location.pathname]);

  // Fetch global stats
  useEffect(() => {
    async function fetchGlobal() {
      const { data } = await supabase
        .from('ttt_player_stats')
        .select('*, ttt_profiles(display_name, avatar_url, username)')
        .order('elo_rating', { ascending: false })
        .limit(20);
      if (data) setGlobalStats(data.map(d => ({ ...d, display_name: d.ttt_profiles?.display_name, username: d.ttt_profiles?.username })));
    }
    fetchGlobal();
  }, []);

  // Save ranked game result to Supabase
  async function saveRankedResult(mode, result, difficulty) {
    if (!user) return;
    setRankedSaving(true);
    try {
      const isDraw = result === 'T';
      const playerWon = result === 'X'; // human is always X
      const duration = gameStartRef.current ? Math.round((Date.now() - gameStartRef.current) / 1000) : null;

      // Get current ELO
      const { data: statRow } = await supabase
        .from('ttt_player_stats')
        .select('elo_rating')
        .eq('user_id', user.id)
        .eq('game_mode', mode)
        .single();

      const currentElo = statRow?.elo_rating || 1200;
      const aiElo = difficulty === 'easy' ? 800 : difficulty === 'medium' ? 1200 : difficulty === 'hard' ? 1500 : 1800;
      const { winnerDelta, loserDelta } = calcElo(
        isDraw ? currentElo : (playerWon ? currentElo : aiElo),
        isDraw ? aiElo : (playerWon ? aiElo : currentElo),
        isDraw
      );

      const eloDelta = isDraw ? winnerDelta : (playerWon ? winnerDelta : loserDelta);

      // Insert match record
      await supabase.from('ttt_matches').insert({
        game_mode: mode,
        player_x_id: user.id,
        player_o_id: null,
        winner_id: isDraw ? null : (playerWon ? user.id : null),
        result: isDraw ? 'draw' : (playerWon ? 'x_wins' : 'o_wins'),
        is_draw: isDraw,
        match_type: 'ranked',
        ai_difficulty: difficulty,
        elo_change_x: eloDelta,
        elo_change_o: 0,
        duration_seconds: duration,
        completed_at: new Date().toISOString(),
      });

      // C3: Upsert player stats (creates row if missing instead of silently failing)
      await supabase
        .from('ttt_player_stats')
        .upsert({
          user_id: user.id,
          game_mode: mode,
          elo_rating: Math.max(0, currentElo + eloDelta),
          wins: (statRow?.wins || 0) + (playerWon ? 1 : 0),
          losses: (statRow?.losses || 0) + (!isDraw && !playerWon ? 1 : 0),
          draws: (statRow?.draws || 0) + (isDraw ? 1 : 0),
        }, { onConflict: 'user_id,game_mode' });

      // Refresh global stats
      const { data } = await supabase
        .from('ttt_player_stats')
        .select('*, ttt_profiles(display_name, avatar_url, username)')
        .order('elo_rating', { ascending: false })
        .limit(20);
      if (data) setGlobalStats(data.map(d => ({ ...d, display_name: d.ttt_profiles?.display_name, username: d.ttt_profiles?.username })));
    } catch (err) {
      console.error('Failed to save ranked result:', err);
    } finally { setRankedSaving(false); }
  }

  function startGame(pX, pO) { setGameState({ pX, pO, finished:false }); setAiGame(null); gameStartRef.current = Date.now(); }
  function startAIGame(mode, difficulty) {
    const aiPlayer = { id:'ai', firstName:'AI', lastName:'('+difficulty+')', nickname: difficulty.charAt(0).toUpperCase()+difficulty.slice(1)+' AI' };
    const humanPlayer = user
      ? { id:'human', firstName: profile?.display_name || 'You', lastName:'', nickname: profile?.username ? '@'+profile.username : '' }
      : { id:'human', firstName:'You', lastName:'', nickname:'' };
    setGameState({ pX: humanPlayer, pO: aiPlayer, finished:false });
    setAiGame({ difficulty, mode });
    gameStartRef.current = Date.now();
  }

  function tryAbandon() {
    if (gameState && !gameState.finished) {
      setConfirm({ title:"Abandon Game?", msg:"The game is still in progress. Leaving will discard this match.", onConfirm:doAbandon });
    } else doAbandon();
  }
  function doAbandon() { setGameState(null); setAiGame(null); setConfirm(null); }
  function handlePlayLeagueMatch(leagueId, leagueName) {
    navigateTo('/live?leagueId=' + leagueId + '&leagueName=' + encodeURIComponent(leagueName));
  }

  function handleViewLeagueFromArena(league) {
    // Navigate to leagues page — public leagues no longer auto-join,
    // membership is created when playing a match in the league
    navigateTo('/leagues');
  }

  function handleEnd(result, mode) {
    if (!gameState || aiGame) return; // Don't save AI game stats to local
    setGameState(gs => gs ? {...gs, finished:true} : gs);
    const { pX, pO } = gameState;
    const isC=mode==="classic", isU=mode==="ultimate", isM=mode==="mega";
    setPlayers(ps => ps.map(p => {
      if (result === "T") {
        if (p.id===pX.id||p.id===pO.id) return {...p, ct:isC?(p.ct||0)+1:(p.ct||0), st:isU?(p.st||0)+1:(p.st||0), mt:isM?(p.mt||0)+1:(p.mt||0)};
      } else {
        const wid = result==="X"?pX.id:pO.id, lid = result==="X"?pO.id:pX.id;
        if (p.id===wid) return {...p, cw:isC?(p.cw||0)+1:(p.cw||0), sw:isU?(p.sw||0)+1:(p.sw||0), mw:isM?(p.mw||0)+1:(p.mw||0)};
        if (p.id===lid) return {...p, cl:isC?(p.cl||0)+1:(p.cl||0), sl:isU?(p.sl||0)+1:(p.sl||0), ml:isM?(p.ml||0)+1:(p.ml||0)};
      }
      return p;
    }));
    const k = h2hKey(pX.id, pO.id);
    const wid = result==="T"?null:result==="X"?pX.id:pO.id;
    setH2hData(d => ({...d, [k]:[...(d[k]||[]),{id:Date.now(),winner:wid,tie:result==="T",note:mode+" match",date:new Date().toLocaleDateString(),mode}]}));
  }

  function saveEdit(ep) { setPlayers(ps => ps.map(p => p.id===ep.id ? {...ep, cw:+ep.cw||0,cl:+ep.cl||0,ct:+ep.ct||0,sw:+ep.sw||0,sl:+ep.sl||0,st:+ep.st||0,mw:+ep.mw||0,ml:+ep.ml||0,mt:+ep.mt||0} : p)); setEditP(null); }
  function delPlayer(id) { setPlayers(ps => ps.filter(p => p.id !== id)); setEditP(null); }
  function addH2h(key, entry) { setH2hData(d => ({...d, [key]:[...(d[key]||[]),entry]})); }
  function delH2h(key, eid) { setH2hData(d => ({...d, [key]:(d[key]||[]).filter(e=>e.id!==eid)})); }
  function resetAll() { localStorage.removeItem("ttta_p"); localStorage.removeItem("ttta_h"); setPlayers(INITIAL_PLAYERS); setH2hData({}); setConfirm(null); }

  const renderGame = (mode) => {
    const GameComp = mode === "classic" ? ClassicGame : mode === "ultimate" ? UltimateGame : MegaGame;
    if (gameState) {
      return <GameComp pX={gameState.pX} pO={gameState.pO} onEnd={r=>handleEnd(r,mode)} onAbandon={tryAbandon} aiDifficulty={aiGame?.difficulty}
        canSaveRanked={!!user && !!aiGame} onSaveRanked={(result) => saveRankedResult(mode, result, aiGame?.difficulty)} rankedSaving={rankedSaving} />;
    }
    return <GameSetup players={players} mode={mode} onStart={startGame} onStartAI={(diff) => startAIGame(mode, diff)} isAuthenticated={!!user} />;
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div className="ai-thinking"><span>Loading</span><span className="dot"/><span className="dot"/><span className="dot"/></div>
    </div>
  );

  return (
    <>
      <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
        <div style={{ position:"relative", zIndex:1, maxWidth:980, margin:"0 auto", padding:"30px 18px 80px" }}>
          {/* Header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:30 }}>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontSize:10, letterSpacing:4, color:"var(--ac)", textTransform:"uppercase", marginBottom:8 }}>Competitive Tic-Tac-Toe Platform</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(44px,7vw,76px)", lineHeight:0.9, letterSpacing:3 }}>
                TTT<span style={{ color:"var(--ac)", display:"block" }}>ARENA</span>
              </div>
            </div>
            <div style={{ position:"absolute", right:18, top:30, display:"flex", gap:8, alignItems:"center" }}>
              {user && !isGuest ? (
                <>
                  {profile?.avatar_url && (
                    <div style={{ width:28, height:28, borderRadius:"50%", overflow:"hidden", border:"1px solid var(--bd)" }}>
                      <img src={profile.avatar_url} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                    </div>
                  )}
                  <span style={{ fontSize:11, color:"var(--mu)", letterSpacing:1, cursor:"pointer" }} onClick={() => navigateTo("/profile")}>
                    {profile?.display_name || user.email}
                  </span>
                  <button className="smbtn" onClick={signOut}>Sign Out</button>
                </>
              ) : isGuest ? (
                <>
                  <span style={{ fontSize:9, color:"var(--go)", letterSpacing:2, fontWeight:600, border:"1px solid rgba(255,200,71,0.3)", padding:"2px 8px" }}>GUEST</span>
                  <span style={{ fontSize:11, color:"var(--mu)", letterSpacing:1 }}>
                    {profile?.display_name || 'Guest'}
                  </span>
                  <button className="smbtn" onClick={signOut}>Leave</button>
                  <button className="savebtn" style={{ padding:"6px 14px", fontSize:10 }} onClick={() => { signOut(); setAuthOpen(true); }}>Sign Up</button>
                </>
              ) : (
                <>
                  <button className="smbtn" onClick={() => setAuthOpen(true)}>Sign In</button>
                  <button className="savebtn" style={{ padding:"6px 14px", fontSize:10 }} onClick={() => setAuthOpen(true)}>Sign Up</button>
                </>
              )}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display:"flex", gap:2, marginBottom:30, borderBottom:"2px solid var(--bd)", overflowX:"auto" }}>
            {NAV_LINKS.map(link => (
              <NavLink key={link.to} to={link.to} end={link.to === "/"} style={({ isActive }) => ({
                background:"none", border:"none", borderBottom:"2px solid "+(isActive?"var(--ac)":"transparent"),
                color: isActive?"var(--ac)":"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:2,
                textTransform:"uppercase", padding:"10px 14px", cursor:"pointer", marginBottom:-2, whiteSpace:"nowrap",
                textDecoration:"none"
              })}>{link.label}</NavLink>
            ))}
          </div>

          {/* Routes */}
          <Routes>
            <Route path="/" element={<Arena globalStats={globalStats} onSelectDifficulty={(mode) => navigateTo("/" + mode)} onFindOpponent={() => navigateTo("/live")} isAuthenticated={!!user} onSignUp={() => setAuthOpen(true)} onViewLeague={handleViewLeagueFromArena} onBrowseLeagues={() => navigateTo("/leagues")} />} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/player/:username" element={<PublicProfile />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/classic" element={renderGame("classic")} />
            <Route path="/ultimate" element={renderGame("ultimate")} />
            <Route path="/mega" element={renderGame("mega")} />
            <Route path="/live" element={<LiveGameWrapper />} />
            <Route path="/leagues" element={<ProtectedRoute><Leagues onPlayLeagueMatch={handlePlayLeagueMatch} /></ProtectedRoute>} />
            <Route path="/h2h" element={<H2H players={players} h2hData={h2hData} onAdd={addH2h} onDel={delH2h} user={user} />} />
            <Route path="/manage" element={
              <Manage players={players} setPlayers={setPlayers} onEdit={setEditP}
                onDel={id => setConfirm({ title:"Delete Player?", msg:"This will permanently remove this player.", onConfirm:()=>delPlayer(id) })}
                onReset={() => setConfirm({ title:"Reset All Data?", msg:"This permanently deletes all records. Cannot be undone.", onConfirm:resetAll })} />
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
      {editP && <EditModal p={editP} onSave={saveEdit} onDel={id=>setConfirm({title:"Delete Player?",msg:"Permanently remove this player?",onConfirm:()=>delPlayer(id)})} onClose={()=>setEditP(null)}/>}
      {confirm && <Confirm title={confirm.title} msg={confirm.msg} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
