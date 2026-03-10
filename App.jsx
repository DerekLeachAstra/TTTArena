import { useState, useEffect } from "react";
import { supabase } from "./src/supabase.js";
import ProfilePage from "./src/Profile.jsx";
import LeaguesPage from "./src/Leagues.jsx";
import MultiplayerPage from "./src/Multiplayer.jsx";

const INITIAL_PLAYERS = [
  { id:1,  firstName:"Mr.",     lastName:"Leach",   nickname:"", cw:0,cl:0,ct:0, sw:16,sl:3, st:0, mw:0,ml:0,mt:0 },
  { id:2,  firstName:"Roman",   lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:3, sl:0, st:0, mw:0,ml:0,mt:0 },
  { id:3,  firstName:"Alondra", lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:3, sl:2, st:0, mw:0,ml:0,mt:0 },
  { id:4,  firstName:"Griffin", lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:5, sl:7, st:0, mw:0,ml:0,mt:0 },
  { id:5,  firstName:"David",   lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:4, sl:4, st:0, mw:0,ml:0,mt:0 },
  { id:6,  firstName:"Charlie", lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:1, sl:1, st:1, mw:0,ml:0,mt:0 },
  { id:7,  firstName:"Khloe",   lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:1, sl:4, st:0, mw:0,ml:0,mt:0 },
  { id:8,  firstName:"Cassie",  lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:0, sl:2, st:1, mw:0,ml:0,mt:0 },
  { id:9,  firstName:"Donho",   lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:4, sl:12,st:0, mw:0,ml:0,mt:0 },
  { id:10, firstName:"Lanea",   lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:1, sl:1, st:0, mw:0,ml:0,mt:0 },
  { id:11, firstName:"Alyanna", lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:0, sl:1, st:0, mw:0,ml:0,mt:0 },
  { id:12, firstName:"Jordana", lastName:"",        nickname:"", cw:0,cl:0,ct:0, sw:0, sl:1, st:0, mw:0,ml:0,mt:0 },
];

function dn(p) {
  if (p.nickname && p.nickname.trim()) return p.nickname.trim();
  const n = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  return n || "Unnamed";
}

function PlayerLabel({ p, color }) {
  const nick = p.nickname && p.nickname.trim();
  const real = [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
  const style = color ? { color } : {};
  if (nick) {
    return (
      <span style={{ display:"flex", flexDirection:"column", gap:1 }}>
        <span style={{ ...style, fontFamily:"'DM Mono',monospace", fontWeight:500 }}>"{nick}"</span>
        {real && <span style={{ fontSize:10, color:"var(--mu)", fontStyle:"italic" }}>{real}</span>}
      </span>
    );
  }
  return <span style={{ ...style, fontWeight:500 }}>{real || "Unnamed"}</span>;
}

const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

function checkWin(cells) {
  for (const [a,b,c] of WIN_LINES) {
    if (cells[a] && cells[a] !== "T" && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return cells.every(Boolean) ? "T" : null;
}

function getWinLine(cells) {
  for (const ln of WIN_LINES) {
    if (cells[ln[0]] && cells[ln[0]] !== "T" && cells[ln[0]] === cells[ln[1]] && cells[ln[0]] === cells[ln[2]]) return ln;
  }
  return [];
}

function score(w, l, t) {
  const g = w + l + t;
  if (!g) return 0;
  return (w + 0.5*t)/g*50 + (w/Math.max(l,1)/16)*30 + (g/19)*20;
}

function overallScore(p) {
  const cs = score(p.cw||0, p.cl||0, p.ct||0);
  const us = score(p.sw||0, p.sl||0, p.st||0);
  const ms = score(p.mw||0, p.ml||0, p.mt||0);
  const hc = (p.cw||0)+(p.cl||0)+(p.ct||0) > 0;
  const hu = (p.sw||0)+(p.sl||0)+(p.st||0) > 0;
  const hm = (p.mw||0)+(p.ml||0)+(p.mt||0) > 0;
  const tot = (hc?1:0)+(hu?3:0)+(hm?5:0);
  if (!tot) return 0;
  return ((hc?cs:0) + (hu?us*3:0) + (hm?ms*5:0)) / tot;
}

function totalGP(p) {
  return (p.cw||0)+(p.cl||0)+(p.ct||0)+(p.sw||0)+(p.sl||0)+(p.st||0)+(p.mw||0)+(p.ml||0)+(p.mt||0);
}

function h2hKey(a, b) { return [a,b].sort().join("__"); }

// ── Classic Game ─────────────────────────────────────────
function ClassicGame({ pX, pO, onEnd, onAbandon }) {
  const [cells, setCells] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [saved, setSaved] = useState(false);

  function play(i) {
    if (cells[i] || winner) return;
    const next = cells.map((c,j) => j===i ? turn : c);
    const w = checkWin(next);
    setCells(next);
    if (w) { setWinner(w); setWinLine(getWinLine(next)); }
    else setTurn(t => t==="X"?"O":"X");
  }

  function reset() { setCells(Array(9).fill(null)); setTurn("X"); setWinner(null); setWinLine([]); setSaved(false); }

  const curName = turn === "X" ? dn(pX) : dn(pO);
  const winName = winner === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:460, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>
          Turn: <strong style={{ color: turn==="X"?"var(--X)":"var(--O)" }}>{curName} ({turn})</strong>
        </div>
        <button className="smbtn" onClick={onAbandon}>Abandon</button>
      </div>
      <div style={{ position:"relative" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:18 }}>
          {cells.map((c,i) => (
            <div key={i}
              onClick={() => play(i)}
              style={{
                aspectRatio:"1", background:"var(--sf)", border:"1px solid "+(winLine.includes(i)?(c==="X"?"var(--X)":"var(--O)"):"var(--bd)"),
                display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(38px,9vw,68px)",
                cursor: c||winner ? "default" : "pointer",
                color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent",
                background: winLine.includes(i) ? (c==="X"?"rgba(232,255,71,0.08)":"rgba(71,200,255,0.08)") : "var(--sf)",
                transition:"all 0.12s"
              }}>
              {c}
            </div>
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
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {!saved && <button className="savebtn" onClick={() => { onEnd(winner); setSaved(true); }}>Save Results</button>}
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
function UltimateGame({ pX, pO, onEnd, onAbandon }) {
  const E = () => Array(9).fill(null);
  const [boards, setBoards] = useState(() => Array(9).fill(null).map(E));
  const [bWins, setBWins] = useState(E);
  const [active, setActive] = useState(null);
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [saved, setSaved] = useState(false);

  function play(bi, ci) {
    if (bWins[bi] || (active !== null && active !== bi) || boards[bi][ci] || winner) return;
    const nb = boards.map((b,i) => i===bi ? b.map((c,j) => j===ci ? turn : c) : b);
    const nw = bWins.map((w,i) => i===bi && !w ? checkWin(nb[i]) : w);
    const mw = checkWin(nw);
    setBoards(nb); setBWins(nw); setActive(nw[ci] ? null : ci);
    if (mw) setWinner(mw);
    else setTurn(t => t==="X"?"O":"X");
  }

  function reset() { setBoards(Array(9).fill(null).map(E)); setBWins(E()); setActive(null); setTurn("X"); setWinner(null); setSaved(false); }

  const winName = winner === "X" ? dn(pX) : dn(pO);
  const curName = turn === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>
          Turn: <strong style={{ color: turn==="X"?"var(--X)":"var(--O)" }}>{curName} ({turn})</strong>
        </div>
        <button className="smbtn" onClick={onAbandon}>Abandon</button>
      </div>
      <div style={{ textAlign:"center", marginBottom:14, fontSize:11, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase" }}>
        {!winner && (active===null
          ? <span>Play on <strong style={{ color:"var(--mega)" }}>any open board</strong></span>
          : <span>Must play on <strong style={{ color:"var(--mega)" }}>Board {active+1}</strong></span>
        )}
      </div>
      <div style={{ position:"relative" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
          {Array(9).fill(null).map((_,bi) => {
            const bw = bWins[bi];
            const isTarget = !winner && active !== null && active === bi && !bw;
            return (
              <div key={bi} style={{
                background:"var(--sf)", border:"2px solid "+(isTarget?"var(--mega)":bw==="X"?"var(--X)":bw==="O"?"var(--O)":"var(--bd)"),
                padding:5, position:"relative",
                background: bw==="X"?"rgba(232,255,71,0.06)":bw==="O"?"rgba(71,200,255,0.06)":bw==="T"?"var(--s2)":"var(--sf)"
              }}>
                {bw && (
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(32px,7vw,64px)", color:bw==="X"?"var(--X)":bw==="O"?"var(--O)":"var(--mu)", zIndex:5, pointerEvents:"none" }}>
                    {bw==="T"?"—":bw}
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3, opacity:bw?0.2:1 }}>
                  {boards[bi].map((c,ci) => (
                    <div key={ci}
                      onClick={() => play(bi,ci)}
                      style={{
                        aspectRatio:"1", background:"var(--s2)", border:"1px solid var(--s3)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(13px,2.5vw,22px)",
                        cursor: (c||bw||(active !== null && active !== bi)) ? "default" : "pointer",
                        color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent"
                      }}>
                      {c}
                    </div>
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
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {!saved && <button className="savebtn" onClick={() => { onEnd(winner); setSaved(true); }}>Save Results</button>}
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
function MegaGame({ pX, pO, onEnd, onAbandon }) {
  const E = () => Array(9).fill(null);
  const [cells, setCells] = useState(() => Array(9).fill(null).map(() => Array(9).fill(null).map(E)));
  const [smallW, setSmallW] = useState(() => Array(9).fill(null).map(E));
  const [midW, setMidW] = useState(E);
  const [metaW, setMetaW] = useState(null);
  const [aMid, setAMid] = useState(null);
  const [aSmall, setASmall] = useState(null);
  const [turn, setTurn] = useState("X");
  const [saved, setSaved] = useState(false);

  function canPlay(mi, si) {
    if (metaW || midW[mi] || smallW[mi][si]) return false;
    if (aMid !== null && aMid !== mi) return false;
    if (aMid === mi && aSmall !== null && aSmall !== si) return false;
    return true;
  }

  function play(mi, si, ci) {
    if (!canPlay(mi,si) || cells[mi][si][ci]) return;
    const nc = cells.map((m,m2) => m.map((s,s2) => (m2===mi&&s2===si) ? s.map((c,c2) => c2===ci?turn:c) : s));
    const nsw = smallW.map((m,m2) => m.map((w,s2) => (m2===mi&&s2===si&&!w) ? checkWin(nc[m2][s2]) : w));
    const nmw = midW.map((w,m2) => (m2===mi&&!w) ? checkWin(nsw[m2]) : w);
    const nm = checkWin(nmw);
    const nextMid = nmw[ci] ? null : ci;
    const nextSmall = nextMid===null ? null : (nsw[nextMid][ci] ? null : ci);
    setCells(nc); setSmallW(nsw); setMidW(nmw);
    if (nm) setMetaW(nm);
    else { setAMid(nextMid); setASmall(nextSmall); setTurn(t => t==="X"?"O":"X"); }
  }

  function reset() {
    setCells(Array(9).fill(null).map(() => Array(9).fill(null).map(E)));
    setSmallW(Array(9).fill(null).map(E)); setMidW(E());
    setMetaW(null); setAMid(null); setASmall(null); setTurn("X"); setSaved(false);
  }

  const curName = turn === "X" ? dn(pX) : dn(pO);
  const winName = metaW === "X" ? dn(pX) : dn(pO);

  return (
    <div style={{ maxWidth:760, margin:"0 auto" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:11, letterSpacing:2, textTransform:"uppercase", color:"var(--mu)" }}>
          Turn: <strong style={{ color: turn==="X"?"var(--X)":"var(--O)" }}>{curName} ({turn})</strong>
        </div>
        <button className="smbtn" onClick={onAbandon}>Abandon</button>
      </div>
      <div style={{ textAlign:"center", marginBottom:12, fontSize:10, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase", lineHeight:1.8 }}>
        {!metaW && (aMid===null
          ? <span>Play in <strong style={{ color:"var(--mega)" }}>any mid-board</strong></span>
          : aSmall===null
            ? <span>Mid <strong style={{ color:"var(--mega)" }}>{aMid+1}</strong> — <strong style={{ color:"var(--ac)" }}>any small board</strong></span>
            : <span>Mid <strong style={{ color:"var(--mega)" }}>{aMid+1}</strong> / Small <strong style={{ color:"var(--ac)" }}>{aSmall+1}</strong></span>
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
                  <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(20px,4vw,40px)", color:mw==="X"?"var(--X)":"var(--O)", zIndex:5, pointerEvents:"none" }}>
                    {mw}
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:3, opacity:mw?0.15:1 }}>
                  {Array(9).fill(null).map((_2,si) => {
                    const sw = smallW[mi][si];
                    const smTarget = !metaW && !mw && !sw && aMid === mi && aSmall !== null && aSmall === si;
                    return (
                      <div key={si} style={{
                        border:"1px solid "+(smTarget?"var(--ac)":"var(--s3)"),
                        padding:2, position:"relative",
                        background: sw==="X"?"rgba(232,255,71,0.08)":sw==="O"?"rgba(71,200,255,0.08)":"transparent",
                        opacity: sw==="T"?0.35:1
                      }}>
                        {sw && sw !== "T" && (
                          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(10px,2vw,18px)", color:sw==="X"?"var(--X)":"var(--O)", zIndex:4, pointerEvents:"none" }}>
                            {sw}
                          </div>
                        )}
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, opacity:sw?0.15:1 }}>
                          {cells[mi][si].map((c,ci) => (
                            <div key={ci}
                              onClick={() => play(mi,si,ci)}
                              style={{
                                aspectRatio:"1", background:"var(--s3)",
                                display:"flex", alignItems:"center", justifyContent:"center",
                                fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(7px,1.4vw,13px)",
                                cursor: (c||mw||sw||!canPlay(mi,si)) ? "default" : "pointer",
                                color: c==="X"?"var(--X)":c==="O"?"var(--O)":"transparent"
                              }}>
                              {c}
                            </div>
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
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", justifyContent:"center" }}>
              {!saved && <button className="savebtn" onClick={() => { onEnd(metaW); setSaved(true); }}>Save Results</button>}
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
function GameSetup({ players, mode, onStart }) {
  const [xId, setXId] = useState("");
  const [oId, setOId] = useState("");
  const pX = players.find(p => p.id === +xId);
  const pO = players.find(p => p.id === +oId);
  const ok = pX && pO && pX.id !== pO.id;
  const isMega = mode === "mega";
  const isUlt = mode === "ultimate";
  const accent = isMega ? "var(--mega)" : isUlt ? "var(--O)" : "var(--ac)";
  const title = isMega ? "MEGA Tic-Tac-Toe" : isUlt ? "Ultimate Tic-Tac-Toe" : "Classic Tic-Tac-Toe";
  const desc = isMega
    ? "Three layers deep. Win small boards to claim mid-board cells. Win mid-boards to win. Your play sends your opponent to the matching board at the next level."
    : isUlt
    ? "Nine boards in a 3x3 grid. Win 3 boards in a row to win. The cell you play in determines which board your opponent must play on next."
    : "Classic 3x3 Tic-Tac-Toe. First to get three in a row wins. Results save to league standings.";
  const sorted = [...players].sort((a,b) => dn(a).localeCompare(dn(b)));
  return (
    <div style={{ maxWidth:540, margin:"0 auto" }}>
      <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", borderTop:"3px solid "+accent, padding:30, marginBottom:18 }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:34, letterSpacing:2, color:accent, marginBottom:6 }}>{title}</div>
        <div style={{ fontSize:11, color:"var(--mu)", letterSpacing:"1.5px", marginBottom:22, lineHeight:1.9 }}>{desc}</div>
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
        <button
          disabled={!ok}
          onClick={() => onStart(pX, pO)}
          style={{ width:"100%", background:ok?accent:"var(--bd)", color:ok?"var(--bg)":"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:12, letterSpacing:4, textTransform:"uppercase", border:"none", padding:13, cursor:ok?"pointer":"not-allowed", fontWeight:500 }}>
          {ok ? "Start — " + dn(pX) + " vs " + dn(pO) : "Select Two Players to Begin"}
        </button>
      </div>
    </div>
  );
}

// ── Standings ─────────────────────────────────────────────
function Standings({ players, onEdit }) {
  const [tab, setTab] = useState("overall");
  const getStats = (p) => {
    if (tab === "classic")  return { w:p.cw||0, l:p.cl||0, t:p.ct||0 };
    if (tab === "ultimate") return { w:p.sw||0, l:p.sl||0, t:p.st||0 };
    if (tab === "mega")     return { w:p.mw||0, l:p.ml||0, t:p.mt||0 };
    return null;
  };
  const getScore = (p) => {
    const st = getStats(p);
    if (!st) return overallScore(p);
    return score(st.w, st.l, st.t);
  };
  const getGP = (p) => {
    const st = getStats(p);
    if (!st) return totalGP(p);
    return st.w + st.l + st.t;
  };
  const getWpct = (p) => {
    const st = getStats(p);
    const w = st ? st.w : (p.cw||0)+(p.sw||0)+(p.mw||0);
    const l = st ? st.l : (p.cl||0)+(p.sl||0)+(p.ml||0);
    const t = st ? st.t : (p.ct||0)+(p.st||0)+(p.mt||0);
    const g = w+l+t;
    return g > 0 ? ((w+0.5*t)/g*100).toFixed(1)+"%" : "—";
  };
  const quals = players.filter(p => getGP(p) >= 3).sort((a,b) => getScore(b)-getScore(a));
  const dnqs  = players.filter(p => getGP(p) < 3).sort((a,b) => dn(a).localeCompare(dn(b)));
  const maxSc = quals.length > 0 ? getScore(quals[0]) : 1;
  const ac = tab==="ultimate"?"var(--O)":tab==="mega"?"var(--mega)":tab==="classic"?"var(--X)":"var(--ac)";
  const tabs = [
    { id:"overall",  label:"Overall" },
    { id:"classic",  label:"Classic" },
    { id:"ultimate", label:"Ultimate" },
    { id:"mega",     label:"MEGA" },
  ];
  return (
    <div>
      <div style={{ display:"flex", gap:2, marginBottom:24, borderBottom:"1px solid var(--bd)", overflowX:"auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background:"none", border:"none", borderBottom:"2px solid "+(tab===t.id?ac:"transparent"),
            color: tab===t.id?ac:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"2.5px",
            textTransform:"uppercase", padding:"9px 16px", cursor:"pointer", marginBottom:-1, whiteSpace:"nowrap"
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ fontSize:9, letterSpacing:2, padding:"2px 7px", marginBottom:10, textTransform:"uppercase", display:"inline-block",
        background: tab==="ultimate"?"rgba(71,200,255,0.1)":tab==="mega"?"rgba(255,71,200,0.1)":"rgba(232,255,71,0.1)",
        color:ac, border:"1px solid "+ac.replace(")",",0.2)").replace("var(","rgba(").replace("--O","71,200,255").replace("--mega","255,71,200").replace("--X","232,255,71").replace("--ac","232,255,71") }}>
        {tab==="overall"?"Mega=5x · Ultimate=3x · Classic=1x":tab==="classic"?"Classic only":tab==="ultimate"?"Ultimate only":"MEGA only"}
      </div>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"2px solid var(--ac)" }}>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"left", width:40 }}>#</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"left" }}>Player</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>W</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>L</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>T</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>GP</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>Win%</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", minWidth:140 }}>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {quals.length === 0 && (
              <tr><td colSpan={9} style={{ textAlign:"center", color:"var(--mu)", padding:32, fontSize:12, letterSpacing:2 }}>No qualifying results yet</td></tr>
            )}
            {quals.map((p, i) => {
              const sc = getScore(p);
              const rc = i===0?"var(--go)":i===1?"var(--si)":i===2?"var(--br)":ac;
              const orig = players.find(x => x.id===p.id) || p;
              const st = getStats(p) || { w:(p.cw||0)+(p.sw||0)+(p.mw||0), l:(p.cl||0)+(p.sl||0)+(p.ml||0), t:(p.ct||0)+(p.st||0)+(p.mt||0) };
              return (
                <tr key={p.id} style={{ borderBottom:"1px solid var(--bd)" }}>
                  <td><div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:i<3?rc:"var(--mu)", textAlign:"center" }}>{i+1}</div></td>
                  <td style={{ padding:"12px 12px" }}><PlayerLabel p={orig} color={i<3?rc:undefined}/></td>
                  <td style={{ padding:"12px 12px", textAlign:"right", fontSize:12, color:"var(--mu)" }}>{st.w}</td>
                  <td style={{ padding:"12px 12px", textAlign:"right", fontSize:12, color:"var(--mu)" }}>{st.l}</td>
                  <td style={{ padding:"12px 12px", textAlign:"right", fontSize:12, color:"var(--mu)" }}>{st.t}</td>
                  <td style={{ padding:"12px 12px", textAlign:"right", fontSize:12, color:"var(--mu)" }}>{getGP(p)}</td>
                  <td style={{ padding:"12px 12px", textAlign:"right", fontSize:12 }}>{getWpct(p)}</td>
                  <td style={{ padding:"12px 12px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:120 }}>
                      <div style={{ flex:1, height:5, background:"var(--bd)", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:3, background:i<3?rc:ac, width:((sc/maxSc)*100)+"%" }}/>
                      </div>
                      <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:20, color:i<3?rc:ac, minWidth:40, textAlign:"right" }}>{sc.toFixed(1)}</span>
                    </div>
                  </td>
                  <td style={{ padding:"12px 4px" }}><button className="smbtn" onClick={() => onEdit({...orig})}>Edit</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dnqs.length > 0 && (
        <div>
          <div style={{ fontSize:10, letterSpacing:3, color:"var(--mu)", textTransform:"uppercase", margin:"30px 0 12px", display:"flex", alignItems:"center", gap:12 }}>
            Did Not Qualify — under 3 games{tab!=="overall"?" in "+tab.charAt(0).toUpperCase()+tab.slice(1):""}
            <span style={{ flex:1, height:1, background:"var(--bd)", display:"block" }}></span>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {dnqs.map(p => {
              const orig = players.find(x => x.id===p.id)||p;
              const st = getStats(p) || { w:(p.cw||0)+(p.sw||0)+(p.mw||0), l:(p.cl||0)+(p.sl||0)+(p.ml||0), t:(p.ct||0)+(p.st||0)+(p.mt||0) };
              return (
                <div key={p.id} style={{ background:"var(--sf)", border:"1px solid var(--bd)", padding:"7px 13px", fontSize:12, color:"var(--mu)", display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ color:"var(--rd)" }}>x</span>
                  <span style={{ color:"var(--tx)", fontWeight:500 }}>{dn(orig)}</span>
                  <span>{st.w}-{st.l}-{st.t} ({getGP(p)} GP)</span>
                  <button className="smbtn" onClick={() => onEdit({...orig})}>Edit</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Head to Head ──────────────────────────────────────────
function H2H({ players, h2hData, onDel, onAdd }) {
  const [pAid, setPAid] = useState("");
  const [pBid, setPBid] = useState("");
  const [res, setRes] = useState("W");
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [filter, setFilter] = useState("all");
  const sorted = [...players].sort((a,b) => dn(a).localeCompare(dn(b)));
  const pA = players.find(p => p.id === +pAid);
  const pB = players.find(p => p.id === +pBid);
  const key = pA && pB ? h2hKey(pA.id, pB.id) : null;
  const all = key ? (h2hData[key] || []) : [];
  const shown = filter === "all" ? all : all.filter(e => e.mode === filter);
  const aW = shown.filter(e => !e.tie && e.winner===pA?.id).length;
  const bW = shown.filter(e => !e.tie && e.winner===pB?.id).length;
  const ties = shown.filter(e => e.tie).length;
  const pAw = pA ? (pA.cw||0)+(pA.sw||0)+(pA.mw||0) : 0;
  const pAl = pA ? (pA.cl||0)+(pA.sl||0)+(pA.ml||0) : 0;
  const pAt = pA ? (pA.ct||0)+(pA.st||0)+(pA.mt||0) : 0;
  const pBw = pB ? (pB.cw||0)+(pB.sw||0)+(pB.mw||0) : 0;
  const pBl = pB ? (pB.cl||0)+(pB.sl||0)+(pB.ml||0) : 0;
  const pBt = pB ? (pB.ct||0)+(pB.st||0)+(pB.mt||0) : 0;
  const logMode = filter === "all" ? "ultimate" : filter;

  function doAdd() {
    if (!pA || !pB || pA.id === pB.id) return;
    const d = date || new Date().toLocaleDateString();
    const w = res === "T" ? null : res === "W" ? pA.id : pB.id;
    onAdd(h2hKey(pA.id,pB.id), { id:Date.now(), winner:w, tie:res==="T", note:note.trim()||logMode+" match", date:d, mode:logMode });
    setNote(""); setDate("");
  }

  const sel = { background:"var(--sf)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none", cursor:"pointer", minWidth:150, appearance:"none" };

  return (
    <div>
      <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap", marginBottom:26 }}>
        <select value={pAid} onChange={e=>setPAid(e.target.value)} style={sel}>
          <option value="">Player A</option>
          {sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}
        </select>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, color:"var(--a2)", letterSpacing:2 }}>VS</div>
        <select value={pBid} onChange={e=>setPBid(e.target.value)} style={sel}>
          <option value="">Player B</option>
          {sorted.map(p => <option key={p.id} value={p.id}>{dn(p)}</option>)}
        </select>
      </div>
      {pA && pB && pA.id !== pB.id ? (
        <div style={{ background:"var(--sf)", border:"1px solid var(--bd)", padding:26 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22, gap:12, flexWrap:"wrap" }}>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>{dn(pA)}</div>
              <div style={{ fontSize:11, color:"var(--mu)", letterSpacing:2, marginTop:3 }}>{pAw}-{pAl}-{pAt} overall</div>
            </div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:36, color:"var(--a2)" }}>VS</div>
            <div style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:24, letterSpacing:2 }}>{dn(pB)}</div>
              <div style={{ fontSize:11, color:"var(--mu)", letterSpacing:2, marginTop:3 }}>{pBw}-{pBl}-{pBt} overall</div>
            </div>
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
              <option value="all">All ({all.length})</option>
              <option value="classic">Classic ({all.filter(e=>e.mode==="classic").length})</option>
              <option value="ultimate">Ultimate ({all.filter(e=>e.mode==="ultimate").length})</option>
              <option value="mega">MEGA ({all.filter(e=>e.mode==="mega").length})</option>
            </select>
          </div>
          <div style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:10 }}>Match History ({shown.length})</div>
          {shown.length === 0
            ? <div style={{ color:"var(--mu)", fontSize:11, letterSpacing:2, textAlign:"center", padding:22, border:"1px dashed var(--bd)" }}>No matches recorded{filter!=="all"?" for this mode":""}</div>
            : shown.map(e => {
                const isAW = !e.tie && e.winner===pA.id;
                return (
                  <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid var(--bd)", fontSize:12 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:13, padding:"3px 10px", background:e.tie?"rgba(71,200,255,0.12)":isAW?"rgba(71,255,154,0.12)":"rgba(255,71,87,0.12)", color:e.tie?"var(--a3)":isAW?"var(--gn)":"var(--rd)" }}>
                      {e.tie ? "TIE" : isAW ? dn(pA).split(" ")[0]+" W" : dn(pB).split(" ")[0]+" W"}
                    </span>
                    <span style={{ flex:1, color:"var(--mu)", fontSize:11 }}>{e.note||"—"}</span>
                    <span style={{ fontSize:11, color:"var(--mu)" }}>{e.date}</span>
                    <button onClick={() => onDel(key,e.id)} style={{ background:"none", border:"none", color:"var(--bd)", cursor:"pointer", fontSize:13 }}>x</button>
                  </div>
                );
              })
          }
          <div style={{ display:"flex", gap:10, marginTop:14, flexWrap:"wrap", alignItems:"flex-end" }}>
            <select value={res} onChange={e=>setRes(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none" }}>
              <option value="W">{dn(pA)} Wins</option>
              <option value="L">{dn(pB)} Wins</option>
              <option value="T">Tie</option>
            </select>
            <select value={logMode} onChange={e=>setFilter(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none", minWidth:110 }}>
              <option value="classic">Classic</option>
              <option value="ultimate">Ultimate</option>
              <option value="mega">MEGA</option>
            </select>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Note (optional)" onKeyDown={e=>e.key==="Enter"&&doAdd()} style={{ flex:1, minWidth:110, background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none" }}/>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ background:"var(--s2)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:12, padding:"9px 12px", outline:"none", width:140 }}/>
            <button className="savebtn" onClick={doAdd}>+ Log Match</button>
          </div>
        </div>
      ) : <div style={{ color:"var(--mu)", fontSize:12, letterSpacing:2, textAlign:"center", padding:40 }}>Select two different players to view head-to-head</div>}
    </div>
  );
}

// ── Manage ────────────────────────────────────────────────
function Manage({ players, setPlayers, onEdit, onDel, onReset }) {
  const [tab, setTab] = useState("ultimate");
  const [fn, setFn] = useState(""); const [ln, setLn] = useState(""); const [nick, setNick] = useState("");
  const [w, setW] = useState(""); const [l, setL] = useState(""); const [t, setT] = useState(""); const [mode, setMode] = useState("ultimate");
  const modes = { classic:{wf:"cw",lf:"cl",tf:"ct",label:"Classic",ac:"var(--X)"}, ultimate:{wf:"sw",lf:"sl",tf:"st",label:"Ultimate",ac:"var(--O)"}, mega:{wf:"mw",lf:"ml",tf:"mt",label:"MEGA",ac:"var(--mega)"} };
  const mc = modes[tab];
  const sorted = [...players].sort((a,b) => dn(a).localeCompare(dn(b)));

  function addPlayer() {
    if (!fn.trim()) return;
    const isU=mode==="ultimate", isM=mode==="mega";
    setPlayers(ps => [...ps, { id:Date.now(), firstName:fn.trim(), lastName:ln.trim(), nickname:nick.trim(),
      cw:(!isU&&!isM)?(+w||0):0, cl:(!isU&&!isM)?(+l||0):0, ct:(!isU&&!isM)?(+t||0):0,
      sw:isU?(+w||0):0, sl:isU?(+l||0):0, st:isU?(+t||0):0,
      mw:isM?(+w||0):0, ml:isM?(+l||0):0, mt:isM?(+t||0):0 }]);
    setFn(""); setLn(""); setNick(""); setW(""); setL(""); setT("");
  }

  function adj(pid, field, delta) {
    setPlayers(ps => ps.map(p => p.id===pid ? {...p, [field]:Math.max(0,(p[field]||0)+delta)} : p));
  }

  const inp = { background:"var(--sf)", border:"1px solid var(--bd)", color:"var(--tx)", fontFamily:"'DM Mono',monospace", fontSize:13, padding:"10px 14px", outline:"none" };
  const modeBtn = (m, label) => (
    <button onClick={() => setMode(m)} style={{ background:"none", border:"1px solid "+(mode===m?modes[m].ac:"var(--bd)"), color:mode===m?modes[m].ac:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:9, letterSpacing:2, padding:"5px 10px", cursor:"pointer", textTransform:"uppercase", background:mode===m?("rgba("+{ultimate:"71,200,255",mega:"255,71,200",classic:"232,255,71"}[m]+",0.07)"):"none" }}>{label}</button>
  );

  return (
    <>
      <div style={{ fontSize:10, letterSpacing:3, color:"var(--mu)", textTransform:"uppercase", margin:"0 0 12px", display:"flex", alignItems:"center", gap:12 }}>
        Add New Player
        <span style={{ flex:1, height:1, background:"var(--bd)", display:"block" }}></span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <input style={{ ...inp, flex:2, minWidth:150 }} placeholder="First Name *" value={fn} onChange={e=>setFn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()}/>
          <input style={{ ...inp, flex:2, minWidth:150 }} placeholder="Last Name" value={ln} onChange={e=>setLn(e.target.value)}/>
          <input style={{ ...inp, flex:2, minWidth:150 }} placeholder="Nickname (shown if set)" value={nick} onChange={e=>setNick(e.target.value)}/>
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:9, letterSpacing:2, color:"var(--mu)", textTransform:"uppercase" }}>W/L/T for:</span>
          {modeBtn("classic","Classic")}
          {modeBtn("ultimate","Ultimate")}
          {modeBtn("mega","MEGA")}
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <input style={{ ...inp, width:66 }} type="number" placeholder="W" value={w} onChange={e=>setW(e.target.value)} min="0"/>
          <input style={{ ...inp, width:66 }} type="number" placeholder="L" value={l} onChange={e=>setL(e.target.value)} min="0"/>
          <input style={{ ...inp, width:66 }} type="number" placeholder="T" value={t} onChange={e=>setT(e.target.value)} min="0"/>
          <button className="savebtn" onClick={addPlayer}>+ Add Player</button>
        </div>
      </div>

      <div style={{ fontSize:10, letterSpacing:3, color:"var(--mu)", textTransform:"uppercase", margin:"32px 0 12px", display:"flex", alignItems:"center", gap:12 }}>
        All Players
        <span style={{ flex:1, height:1, background:"var(--bd)", display:"block" }}></span>
      </div>
      <div style={{ display:"flex", gap:2, marginBottom:16, borderBottom:"1px solid var(--bd)", overflowX:"auto" }}>
        {["classic","ultimate","mega"].map(m => (
          <button key={m} onClick={() => setTab(m)} style={{ background:"none", border:"none", borderBottom:"2px solid "+(tab===m?modes[m].ac:"transparent"), color:tab===m?modes[m].ac:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:"2.5px", textTransform:"uppercase", padding:"9px 16px", cursor:"pointer", marginBottom:-1, whiteSpace:"nowrap" }}>
            {modes[m].label}
          </button>
        ))}
      </div>

      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"2px solid var(--ac)" }}>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"left" }}>Name</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"left" }}>Nickname</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:mc.ac, padding:"10px 12px", textAlign:"right" }}>W</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:mc.ac, padding:"10px 12px", textAlign:"right" }}>L</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:mc.ac, padding:"10px 12px", textAlign:"right" }}>T</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>GP</th>
              <th style={{ fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", padding:"10px 12px", textAlign:"right" }}>Q?</th>
              <th></th><th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const mw=p[mc.wf]||0, ml=p[mc.lf]||0, mt=p[mc.tf]||0, mgp=mw+ml+mt, mq=mgp>=3;
              const stepStyle = { display:"inline-flex", alignItems:"center", gap:6, justifyContent:"flex-end" };
              const btnStyle = (up) => ({ background:"none", border:"1px solid var(--bd)", color:"var(--mu)", width:18, height:14, cursor:"pointer", fontSize:8, display:"flex", alignItems:"center", justifyContent:"center", padding:0 });
              return (
                <tr key={p.id} style={{ borderBottom:"1px solid var(--bd)" }}>
                  <td style={{ padding:"12px 12px", fontSize:13, fontWeight:500 }}>{dn(p)}</td>
                  <td style={{ padding:"12px 12px", fontSize:12, color:"var(--ac)" }}>{p.nickname||"—"}</td>
                  <td style={{ padding:"12px 12px", textAlign:"right" }}>
                    <div style={stepStyle}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:mc.ac, minWidth:22, textAlign:"center" }}>{mw}</span>
                      <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                        <button style={btnStyle(true)} onClick={()=>adj(p.id,mc.wf,1)}>+</button>
                        <button style={btnStyle(false)} onClick={()=>adj(p.id,mc.wf,-1)}>-</button>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"12px 12px", textAlign:"right" }}>
                    <div style={stepStyle}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:mc.ac, minWidth:22, textAlign:"center" }}>{ml}</span>
                      <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                        <button style={btnStyle(true)} onClick={()=>adj(p.id,mc.lf,1)}>+</button>
                        <button style={btnStyle(false)} onClick={()=>adj(p.id,mc.lf,-1)}>-</button>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding:"12px 12px", textAlign:"right" }}>
                    <div style={stepStyle}>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:mc.ac, minWidth:22, textAlign:"center" }}>{mt}</span>
                      <div style={{ display:"flex", flexDirection:"column", gap:1 }}>
                        <button style={btnStyle(true)} onClick={()=>adj(p.id,mc.tf,1)}>+</button>
                        <button style={btnStyle(false)} onClick={()=>adj(p.id,mc.tf,-1)}>-</button>
                      </div>
                    </div>
                  </td>
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
          <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>First Name</label><input style={inp} value={ep.firstName||""} onChange={e=>setEp(x=>({...x,firstName:e.target.value}))}/></div>
          <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Last Name</label><input style={inp} value={ep.lastName||""} onChange={e=>setEp(x=>({...x,lastName:e.target.value}))}/></div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>Nickname</label>
          <input style={inp} value={ep.nickname||""} placeholder="e.g. The Champ" onChange={e=>setEp(x=>({...x,nickname:e.target.value}))}/>
        </div>
        {[{label:"Classic TTT",color:"var(--X)",wf:"cw",lf:"cl",tf:"ct"},{label:"Ultimate TTT",color:"var(--O)",wf:"sw",lf:"sl",tf:"st"},{label:"MEGA TTT",color:"var(--mega)",wf:"mw",lf:"ml",tf:"mt"}].map(sec => (
          <div key={sec.wf}>
            <div style={{ fontSize:10, letterSpacing:3, color:sec.color, textTransform:"uppercase", margin:"18px 0 8px", borderTop:"1px solid var(--bd)", paddingTop:14 }}>{sec.label}</div>
            <div style={{ display:"flex", gap:10 }}>
              <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>W</label><input style={inp} type="number" min="0" value={ep[sec.wf]||0} onChange={e=>setEp(x=>({...x,[sec.wf]:e.target.value}))}/></div>
              <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>L</label><input style={inp} type="number" min="0" value={ep[sec.lf]||0} onChange={e=>setEp(x=>({...x,[sec.lf]:e.target.value}))}/></div>
              <div style={{ flex:1 }}><label style={{ display:"block", fontSize:10, letterSpacing:3, textTransform:"uppercase", color:"var(--mu)", marginBottom:6 }}>T</label><input style={inp} type="number" min="0" value={ep[sec.tf]||0} onChange={e=>setEp(x=>({...x,[sec.tf]:e.target.value}))}/></div>
            </div>
          </div>
        ))}
        <div style={{ display:"flex", gap:10, marginTop:22 }}>
          <button onClick={onClose} style={{ flex:1, background:"none", border:"1px solid var(--bd)", color:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:3, textTransform:"uppercase", padding:12, cursor:"pointer" }}>Cancel</button>
          <button onClick={()=>onDel(ep.id)} style={{ background:"none", border:"1px solid var(--rd)", color:"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", padding:"12px 16px", cursor:"pointer" }}>Delete</button>
          <button onClick={()=>onSave(ep)} style={{ flex:1, background:"var(--ac)", color:"var(--bg)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:3, textTransform:"uppercase", border:"none", padding:12, cursor:"pointer", fontWeight:500 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Modal ─────────────────────────────────────────
function Confirm({ title, msg, onConfirm, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", zIndex:300, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div style={{ background:"var(--sf)", border:"1px solid var(--rd)", borderTop:"3px solid var(--rd)", padding:28, width:"100%", maxWidth:380, textAlign:"center" }}>
        <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:2, color:"var(--rd)", marginBottom:10 }}>{title}</div>
        <div style={{ fontSize:11, color:"var(--mu)", letterSpacing:"1.5px", lineHeight:1.8, marginBottom:22 }}>{msg}</div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={onCancel} style={{ flex:1, background:"none", border:"1px solid var(--bd)", color:"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:3, textTransform:"uppercase", padding:12, cursor:"pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ background:"none", border:"1px solid var(--rd)", color:"var(--rd)", fontFamily:"'DM Mono',monospace", fontSize:11, letterSpacing:2, textTransform:"uppercase", padding:"12px 16px", cursor:"pointer" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────
const TABS = [
  { id:"profile",   label:"My Profile" },
  { id:"multiplayer", label:"Live Play" },
  { id:"leagues",   label:"Leagues" },
  { id:"standings", label:"Standings" },
  { id:"classic",   label:"Classic" },
  { id:"ultimate",  label:"Ultimate TTT" },
  { id:"mega",      label:"MEGA" },
  { id:"h2h",       label:"Head-to-Head" },
  { id:"manage",    label:"Manage" },
];

export default function App({ session }) {
  const load = (key, def) => { try { const s=localStorage.getItem(key); return s?JSON.parse(s):def; } catch { return def; } };
  const [players, setPlayers]   = useState(() => load("ttta_p", INITIAL_PLAYERS));
  const [h2hData, setH2hData]   = useState(() => load("ttta_h", {}));
  const [tab, setTab]           = useState("profile");
  const [gameState, setGameState] = useState(null); // { pX, pO, finished }
  const [editP, setEditP]       = useState(null);
  const [confirm, setConfirm]   = useState(null); // { title, msg, onConfirm }

  useEffect(() => { try { localStorage.setItem("ttta_p", JSON.stringify(players)); } catch {} }, [players]);
  useEffect(() => { try { localStorage.setItem("ttta_h", JSON.stringify(h2hData)); } catch {} }, [h2hData]);

  function startGame(pX, pO) { setGameState({ pX, pO, finished:false }); }

  function tryAbandon() {
    if (gameState && !gameState.finished) {
      setConfirm({ title:"Abandon Game?", msg:"The game is still in progress. Records have not been saved. Leaving will discard this match.", onConfirm:doAbandon });
    } else {
      doAbandon();
    }
  }

  function doAbandon() { setGameState(null); setConfirm(null); }

  function changeTab(t) { setTab(t); setGameState(null); setConfirm(null); }

  function handleEnd(result, mode) {
    if (!gameState) return;
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

  function saveEdit(ep) {
    setPlayers(ps => ps.map(p => p.id===ep.id ? {...ep, cw:+ep.cw||0,cl:+ep.cl||0,ct:+ep.ct||0,sw:+ep.sw||0,sl:+ep.sl||0,st:+ep.st||0,mw:+ep.mw||0,ml:+ep.ml||0,mt:+ep.mt||0} : p));
    setEditP(null);
  }

  function delPlayer(id) { setPlayers(ps => ps.filter(p => p.id !== id)); setEditP(null); }

  function addH2h(key, entry) { setH2hData(d => ({...d, [key]:[...(d[key]||[]),entry]})); }
  function delH2h(key, eid)   { setH2hData(d => ({...d, [key]:(d[key]||[]).filter(e=>e.id!==eid)})); }

  function resetAll() {
    localStorage.removeItem("ttta_p"); localStorage.removeItem("ttta_h");
    setPlayers(INITIAL_PLAYERS); setH2hData({}); setConfirm(null);
  }

  const acColor = tab==="ultimate"?"var(--O)":tab==="mega"?"var(--mega)":"var(--ac)";
  const isPlaying = gameState && !gameState.finished;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@300;400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        :root{
          --bg:#0a0a0f;--sf:#111118;--s2:#18181f;--s3:#1e1e28;
          --ac:#e8ff47;--a2:#ff4757;--a3:#47c8ff;
          --tx:#f0f0f5;--mu:#6b6b80;--bd:#2a2a3a;
          --go:#ffd700;--si:#c0c0c0;--br:#cd7f32;
          --gn:#47ff9a;--rd:#ff4757;
          --X:#e8ff47;--O:#47c8ff;--mega:#ff47c8;
        }
        body{background:var(--bg);color:var(--tx);font-family:'DM Mono',monospace;}
        .savebtn{background:var(--ac);color:var(--bg);font-family:'DM Mono',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;border:none;padding:11px 18px;cursor:pointer;font-weight:500;}
        .savebtn:hover{opacity:0.85;}
        .smbtn{background:none;border:1px solid var(--bd);color:var(--mu);font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;padding:6px 12px;cursor:pointer;text-transform:uppercase;}
        .smbtn:hover{border-color:var(--ac);color:var(--ac);}
        input[type=number]{-moz-appearance:textfield;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
      `}</style>
      <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, backgroundImage:"linear-gradient(var(--s3) 1px,transparent 1px),linear-gradient(90deg,var(--s3) 1px,transparent 1px)", backgroundSize:"40px 40px", opacity:0.3 }}/>
        <div style={{ position:"relative", zIndex:1, maxWidth:980, margin:"0 auto", padding:"30px 18px 80px" }}>
          <div style={{ textAlign:"center", marginBottom:30 }}>
            <div style={{ fontSize:10, letterSpacing:4, color:"var(--ac)", textTransform:"uppercase", marginBottom:8 }}>League Manager & Game Hub</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(44px,7vw,76px)", lineHeight:0.9, letterSpacing:3 }}>
              TTT<span style={{ color:"var(--ac)", display:"block" }}>ARENA</span>
            </div>
            <div style={{ marginTop:12, fontSize:10, color:"var(--mu)", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
              <span>{session?.user?.email}</span>
              <button onClick={() => supabase.auth.signOut()} className="smbtn">Log Out</button>
            </div>
          </div>

          <div style={{ display:"flex", gap:2, marginBottom:30, borderBottom:"2px solid var(--bd)", overflowX:"auto" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => changeTab(t.id)} style={{
                background:"none", border:"none", borderBottom:"2px solid "+(tab===t.id?"var(--ac)":"transparent"),
                color: tab===t.id?"var(--ac)":"var(--mu)", fontFamily:"'DM Mono',monospace", fontSize:10, letterSpacing:2,
                textTransform:"uppercase", padding:"10px 14px", cursor:"pointer", marginBottom:-2, whiteSpace:"nowrap"
              }}>{t.label}</button>
            ))}
          </div>

          {tab === "profile" && <ProfilePage session={session} />}
          {tab === "multiplayer" && <MultiplayerPage session={session} />}
          {tab === "leagues" && <LeaguesPage session={session} />}

          {tab === "standings" && <Standings players={players} onEdit={setEditP}/>}

          {tab === "classic" && (
            gameState
              ? <ClassicGame pX={gameState.pX} pO={gameState.pO} onEnd={r=>handleEnd(r,"classic")} onAbandon={tryAbandon}/>
              : <GameSetup players={players} mode="classic" onStart={startGame}/>
          )}

          {tab === "ultimate" && (
            gameState
              ? <UltimateGame pX={gameState.pX} pO={gameState.pO} onEnd={r=>handleEnd(r,"ultimate")} onAbandon={tryAbandon}/>
              : <GameSetup players={players} mode="ultimate" onStart={startGame}/>
          )}

          {tab === "mega" && (
            gameState
              ? <MegaGame pX={gameState.pX} pO={gameState.pO} onEnd={r=>handleEnd(r,"mega")} onAbandon={tryAbandon}/>
              : <GameSetup players={players} mode="mega" onStart={startGame}/>
          )}

          {tab === "h2h" && <H2H players={players} h2hData={h2hData} onAdd={addH2h} onDel={delH2h}/>}

          {tab === "manage" && (
            <Manage
              players={players}
              setPlayers={setPlayers}
              onEdit={setEditP}
              onDel={id => setConfirm({ title:"Delete Player?", msg:"This will permanently remove this player and all their records.", onConfirm:()=>delPlayer(id) })}
              onReset={() => setConfirm({ title:"Reset All Data?", msg:"This permanently deletes all records and resets to the original roster. Cannot be undone.", onConfirm:resetAll })}
            />
          )}
        </div>
      </div>

      {editP && <EditModal p={editP} onSave={saveEdit} onDel={id=>setConfirm({title:"Delete Player?",msg:"Permanently remove this player?",onConfirm:()=>delPlayer(id)})} onClose={()=>setEditP(null)}/>}
      {confirm && <Confirm title={confirm.title} msg={confirm.msg} onConfirm={confirm.onConfirm} onCancel={()=>setConfirm(null)}/>}
    </>
  );
}
