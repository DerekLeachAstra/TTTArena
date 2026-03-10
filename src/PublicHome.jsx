import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";
import { classicAI, ultimateAI, megaAI, classicWinProb, ultimateWinProb, megaWinProb } from "./ai.js";

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

function aiDelay() { return 400 + Math.random() * 400; }

// ── Win Probability Meter ────────────────────────────────
function WinProbMeter({ prob }) {
  if (!prob) return null;
  const xPct = Math.round(prob.x * 100);
  const oPct = Math.round(prob.o * 100);
  const dPct = 100 - xPct - oPct;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, color: "var(--mu)" }}>
        <span style={{ color: "var(--X)" }}>You {xPct}%</span>
        {dPct > 0 && <span>Draw {dPct}%</span>}
        <span style={{ color: "var(--O)" }}>AI {oPct}%</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--s2)" }}>
        <div style={{ width: xPct + "%", background: "var(--X)", transition: "width 0.4s ease" }} />
        <div style={{ width: dPct + "%", background: "var(--mu)", opacity: 0.4, transition: "width 0.4s ease" }} />
        <div style={{ width: oPct + "%", background: "var(--O)", transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

// ── AI Classic Game ──────────────────────────────────────
function AIClassicGame({ difficulty, onBack }) {
  const [cells, setCells] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [prob, setProb] = useState({ x: 0, o: 0, draw: 1 });
  const aiRef = useRef(null);

  useEffect(() => () => { if (aiRef.current) clearTimeout(aiRef.current); }, []);

  const doAIMove = useCallback((board) => {
    setThinking(true);
    aiRef.current = setTimeout(() => {
      const move = classicAI(board, difficulty);
      if (move < 0) { setThinking(false); return; }
      const next = board.map((c, j) => j === move ? "O" : c);
      const w = checkWin(next);
      setCells(next);
      setProb(classicWinProb(next));
      if (w) { setWinner(w); setWinLine(getWinLine(next)); }
      else setTurn("X");
      setThinking(false);
    }, aiDelay());
  }, [difficulty]);

  function play(i) {
    if (cells[i] || winner || turn !== "X" || thinking) return;
    const next = cells.map((c, j) => j === i ? "X" : c);
    const w = checkWin(next);
    setCells(next);
    setProb(classicWinProb(next));
    if (w) { setWinner(w); setWinLine(getWinLine(next)); }
    else { setTurn("O"); doAIMove(next); }
  }

  function reset() {
    if (aiRef.current) clearTimeout(aiRef.current);
    setCells(Array(9).fill(null)); setTurn("X"); setWinner(null); setWinLine([]); setThinking(false); setProb({ x: 0, o: 0, draw: 1 });
  }

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)" }}>
          {winner ? "" : thinking ? <span>AI is <strong style={{ color: "var(--O)" }}>thinking...</strong></span> :
            <span>Your turn <strong style={{ color: "var(--X)" }}>(X)</strong></span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="smbtn" onClick={reset}>New Game</button>
          <button className="smbtn" onClick={onBack}>Back</button>
        </div>
      </div>
      <WinProbMeter prob={prob} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 18 }}>
          {cells.map((c, i) => (
            <div key={i} onClick={() => play(i)} style={{
              aspectRatio: "1", border: "1px solid " + (winLine.includes(i) ? (c === "X" ? "var(--X)" : "var(--O)") : "var(--bd)"),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(38px,9vw,68px)",
              cursor: c || winner || turn !== "X" ? "default" : "pointer",
              color: c === "X" ? "var(--X)" : c === "O" ? "var(--O)" : "transparent",
              background: winLine.includes(i) ? (c === "X" ? "rgba(232,255,71,0.08)" : "rgba(71,200,255,0.08)") : "var(--sf)",
              transition: "all 0.12s"
            }}>{c}</div>
          ))}
        </div>
        {winner && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(8,8,14,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(28px,7vw,52px)", letterSpacing: 3, color: winner === "T" ? "var(--mu)" : winner === "X" ? "var(--X)" : "var(--O)" }}>
              {winner === "T" ? "Draw!" : winner === "X" ? "You Win!" : "AI Wins!"}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="savebtn" onClick={reset}>Play Again</button>
              <button className="smbtn" onClick={onBack}>Back</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 12, fontSize: 10, letterSpacing: 2, color: "var(--mu)" }}>
        <span style={{ color: "var(--X)" }}>X = You</span>
        <span style={{ color: "var(--O)" }}>O = AI ({difficulty})</span>
      </div>
    </div>
  );
}

// ── AI Ultimate Game ─────────────────────────────────────
function AIUltimateGame({ difficulty, onBack }) {
  const E = () => Array(9).fill(null);
  const [boards, setBoards] = useState(() => Array(9).fill(null).map(E));
  const [bWins, setBWins] = useState(E);
  const [active, setActive] = useState(null);
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [thinking, setThinking] = useState(false);
  const [prob, setProb] = useState({ x: 0, o: 0, draw: 1 });
  const aiRef = useRef(null);

  useEffect(() => () => { if (aiRef.current) clearTimeout(aiRef.current); }, []);

  function getValidMoves(bds, bws, act) {
    const moves = [];
    for (let bi = 0; bi < 9; bi++) {
      if (bws[bi]) continue;
      if (act !== null && act !== bi) continue;
      for (let ci = 0; ci < 9; ci++) {
        if (!bds[bi][ci]) moves.push([bi, ci]);
      }
    }
    return moves;
  }

  function applyMove(bds, bws, bi, ci, player) {
    const nb = bds.map((b, i) => i === bi ? b.map((c, j) => j === ci ? player : c) : b);
    const nw = bws.map((w, i) => i === bi && !w ? checkWin(nb[i]) : w);
    const mw = checkWin(nw);
    const nextActive = nw[ci] ? null : ci;
    return { nb, nw, mw, nextActive };
  }

  const doAIMove = useCallback((bds, bws, act) => {
    setThinking(true);
    aiRef.current = setTimeout(() => {
      const result = ultimateAI(bds, bws, act, difficulty);
      if (!result) { setThinking(false); return; }
      const [bi, ci] = result;
      const { nb, nw, mw, nextActive } = applyMove(bds, bws, bi, ci, "O");
      setBoards(nb); setBWins(nw); setActive(nextActive);
      setProb(ultimateWinProb(nb, nw));
      if (mw) setWinner(mw);
      else setTurn("X");
      setThinking(false);
    }, aiDelay());
  }, [difficulty]);

  function play(bi, ci) {
    if (bWins[bi] || (active !== null && active !== bi) || boards[bi][ci] || winner || turn !== "X" || thinking) return;
    const { nb, nw, mw, nextActive } = applyMove(boards, bWins, bi, ci, "X");
    setBoards(nb); setBWins(nw); setActive(nextActive);
    setProb(ultimateWinProb(nb, nw));
    if (mw) setWinner(mw);
    else { setTurn("O"); doAIMove(nb, nw, nextActive); }
  }

  function reset() {
    if (aiRef.current) clearTimeout(aiRef.current);
    setBoards(Array(9).fill(null).map(E)); setBWins(E()); setActive(null); setTurn("X"); setWinner(null); setThinking(false); setProb({ x: 0, o: 0, draw: 1 });
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)" }}>
          {winner ? "" : thinking ? <span>AI is <strong style={{ color: "var(--O)" }}>thinking...</strong></span> :
            <span>Your turn <strong style={{ color: "var(--X)" }}>(X)</strong></span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="smbtn" onClick={reset}>New Game</button>
          <button className="smbtn" onClick={onBack}>Back</button>
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 14, fontSize: 11, letterSpacing: 2, color: "var(--mu)", textTransform: "uppercase" }}>
        {!winner && (active === null
          ? <span>Play on <strong style={{ color: "var(--mega)" }}>any open board</strong></span>
          : <span>Must play on <strong style={{ color: "var(--mega)" }}>Board {active + 1}</strong></span>
        )}
      </div>
      <WinProbMeter prob={prob} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
          {Array(9).fill(null).map((_, bi) => {
            const bw = bWins[bi];
            const isTarget = !winner && active !== null && active === bi && !bw;
            return (
              <div key={bi} style={{
                border: "2px solid " + (isTarget ? "var(--mega)" : bw === "X" ? "var(--X)" : bw === "O" ? "var(--O)" : "var(--bd)"),
                padding: 5, position: "relative",
                background: bw === "X" ? "rgba(232,255,71,0.06)" : bw === "O" ? "rgba(71,200,255,0.06)" : bw === "T" ? "var(--s2)" : "var(--sf)"
              }}>
                {bw && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(32px,7vw,64px)", color: bw === "X" ? "var(--X)" : bw === "O" ? "var(--O)" : "var(--mu)", zIndex: 5, pointerEvents: "none" }}>
                    {bw === "T" ? "—" : bw}
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 3, opacity: bw ? 0.2 : 1 }}>
                  {boards[bi].map((c, ci) => (
                    <div key={ci} onClick={() => play(bi, ci)} style={{
                      aspectRatio: "1", background: "var(--s2)", border: "1px solid var(--s3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(13px,2.5vw,22px)",
                      cursor: (c || bw || (active !== null && active !== bi) || turn !== "X") ? "default" : "pointer",
                      color: c === "X" ? "var(--X)" : c === "O" ? "var(--O)" : "transparent"
                    }}>{c}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {winner && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(8,8,14,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, zIndex: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(28px,7vw,52px)", letterSpacing: 3, color: winner === "T" ? "var(--mu)" : winner === "X" ? "var(--X)" : "var(--O)" }}>
              {winner === "T" ? "Draw!" : winner === "X" ? "You Win!" : "AI Wins!"}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="savebtn" onClick={reset}>Play Again</button>
              <button className="smbtn" onClick={onBack}>Back</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 12, fontSize: 10, letterSpacing: 2, color: "var(--mu)" }}>
        <span style={{ color: "var(--X)" }}>X = You</span>
        <span style={{ color: "var(--O)" }}>O = AI ({difficulty})</span>
      </div>
    </div>
  );
}

// ── AI MEGA Game ─────────────────────────────────────────
function AIMegaGame({ difficulty, onBack }) {
  const E = () => Array(9).fill(null);
  const [cells, setCells] = useState(() => Array(9).fill(null).map(() => Array(9).fill(null).map(E)));
  const [smallW, setSmallW] = useState(() => Array(9).fill(null).map(E));
  const [midW, setMidW] = useState(E);
  const [metaW, setMetaW] = useState(null);
  const [aMid, setAMid] = useState(null);
  const [aSmall, setASmall] = useState(null);
  const [turn, setTurn] = useState("X");
  const [thinking, setThinking] = useState(false);
  const [prob, setProb] = useState({ x: 0, o: 0, draw: 1 });
  const aiRef = useRef(null);

  useEffect(() => () => { if (aiRef.current) clearTimeout(aiRef.current); }, []);

  function canPlay(mi, si, cMid, cSmall, cMidW, cSmallW, cMetaW) {
    if (cMetaW || cMidW[mi] || cSmallW[mi][si]) return false;
    if (cMid !== null && cMid !== mi) return false;
    if (cMid === mi && cSmall !== null && cSmall !== si) return false;
    return true;
  }

  function getValidMoves(cls, sw, mw, am, as, meta) {
    const moves = [];
    for (let mi = 0; mi < 9; mi++)
      for (let si = 0; si < 9; si++)
        if (canPlay(mi, si, am, as, mw, sw, meta))
          for (let ci = 0; ci < 9; ci++)
            if (!cls[mi][si][ci]) moves.push([mi, si, ci]);
    return moves;
  }

  function applyMegaMove(cls, sw, mw, mi, si, ci, player) {
    const nc = cls.map((m, m2) => m.map((s, s2) => (m2 === mi && s2 === si) ? s.map((c, c2) => c2 === ci ? player : c) : s));
    const nsw = sw.map((m, m2) => m.map((w, s2) => (m2 === mi && s2 === si && !w) ? checkWin(nc[m2][s2]) : w));
    const nmw = mw.map((w, m2) => (m2 === mi && !w) ? checkWin(nsw[m2]) : w);
    const nm = checkWin(nmw);
    const nextMid = nmw[ci] ? null : ci;
    const nextSmall = nextMid === null ? null : (nsw[nextMid][ci] ? null : ci);
    return { nc, nsw, nmw, nm, nextMid, nextSmall };
  }

  const doAIMove = useCallback((cls, sw, mw, am, as, meta) => {
    setThinking(true);
    aiRef.current = setTimeout(() => {
      const result = megaAI(cls, sw, mw, am, as, meta, difficulty);
      if (!result) { setThinking(false); return; }
      const [mi, si, ci] = result;
      const { nc, nsw, nmw, nm, nextMid, nextSmall } = applyMegaMove(cls, sw, mw, mi, si, ci, "O");
      setCells(nc); setSmallW(nsw); setMidW(nmw);
      setProb(megaWinProb(nsw, nmw));
      if (nm) setMetaW(nm);
      else { setAMid(nextMid); setASmall(nextSmall); setTurn("X"); }
      setThinking(false);
    }, aiDelay());
  }, [difficulty]);

  function play(mi, si, ci) {
    if (!canPlay(mi, si, aMid, aSmall, midW, smallW, metaW) || cells[mi][si][ci] || turn !== "X" || thinking) return;
    const { nc, nsw, nmw, nm, nextMid, nextSmall } = applyMegaMove(cells, smallW, midW, mi, si, ci, "X");
    setCells(nc); setSmallW(nsw); setMidW(nmw);
    setProb(megaWinProb(nsw, nmw));
    if (nm) setMetaW(nm);
    else { setAMid(nextMid); setASmall(nextSmall); setTurn("O"); doAIMove(nc, nsw, nmw, nextMid, nextSmall, nm); }
  }

  function reset() {
    if (aiRef.current) clearTimeout(aiRef.current);
    setCells(Array(9).fill(null).map(() => Array(9).fill(null).map(E)));
    setSmallW(Array(9).fill(null).map(E)); setMidW(E());
    setMetaW(null); setAMid(null); setASmall(null); setTurn("X"); setThinking(false); setProb({ x: 0, o: 0, draw: 1 });
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)" }}>
          {metaW ? "" : thinking ? <span>AI is <strong style={{ color: "var(--O)" }}>thinking...</strong></span> :
            <span>Your turn <strong style={{ color: "var(--X)" }}>(X)</strong></span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="smbtn" onClick={reset}>New Game</button>
          <button className="smbtn" onClick={onBack}>Back</button>
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 12, fontSize: 10, letterSpacing: 2, color: "var(--mu)", textTransform: "uppercase", lineHeight: 1.8 }}>
        {!metaW && (aMid === null
          ? <span>Play in <strong style={{ color: "var(--mega)" }}>any mid-board</strong></span>
          : aSmall === null
            ? <span>Mid <strong style={{ color: "var(--mega)" }}>{aMid + 1}</strong> — <strong style={{ color: "var(--ac)" }}>any small board</strong></span>
            : <span>Mid <strong style={{ color: "var(--mega)" }}>{aMid + 1}</strong> / Small <strong style={{ color: "var(--ac)" }}>{aSmall + 1}</strong></span>
        )}
      </div>
      <WinProbMeter prob={prob} />
      <div style={{ position: "relative", overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, minWidth: 300 }}>
          {Array(9).fill(null).map((_, mi) => {
            const mw = midW[mi];
            const midAct = !metaW && (aMid === null ? !mw : aMid === mi);
            return (
              <div key={mi} style={{
                border: "2px solid " + (midAct ? "var(--mega)" : mw === "X" ? "var(--X)" : mw === "O" ? "var(--O)" : "var(--bd)"),
                padding: 4, position: "relative",
                background: mw === "X" ? "rgba(232,255,71,0.05)" : mw === "O" ? "rgba(71,200,255,0.05)" : "transparent",
                opacity: mw === "T" ? 0.4 : 1
              }}>
                {mw && mw !== "T" && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(20px,4vw,40px)", color: mw === "X" ? "var(--X)" : "var(--O)", zIndex: 5, pointerEvents: "none" }}>{mw}</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 3, opacity: mw ? 0.15 : 1 }}>
                  {Array(9).fill(null).map((_, si) => {
                    const sw = smallW[mi][si];
                    const smTarget = !metaW && !mw && !sw && aMid === mi && aSmall !== null && aSmall === si;
                    return (
                      <div key={si} style={{
                        border: "1px solid " + (smTarget ? "var(--ac)" : "var(--s3)"),
                        padding: 2, position: "relative",
                        background: sw === "X" ? "rgba(232,255,71,0.08)" : sw === "O" ? "rgba(71,200,255,0.08)" : "transparent",
                        opacity: sw === "T" ? 0.35 : 1
                      }}>
                        {sw && sw !== "T" && (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(10px,2vw,18px)", color: sw === "X" ? "var(--X)" : "var(--O)", zIndex: 4, pointerEvents: "none" }}>{sw}</div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, opacity: sw ? 0.15 : 1 }}>
                          {cells[mi][si].map((c, ci) => (
                            <div key={ci} onClick={() => play(mi, si, ci)} style={{
                              aspectRatio: "1", background: "var(--s3)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(7px,1.4vw,13px)",
                              cursor: (c || mw || sw || turn !== "X" || !canPlay(mi, si, aMid, aSmall, midW, smallW, metaW)) ? "default" : "pointer",
                              color: c === "X" ? "var(--X)" : c === "O" ? "var(--O)" : "transparent"
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
          <div style={{ position: "absolute", inset: 0, background: "rgba(8,8,14,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, zIndex: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(28px,7vw,52px)", letterSpacing: 3, color: metaW === "T" ? "var(--mu)" : metaW === "X" ? "var(--X)" : "var(--O)" }}>
              {metaW === "T" ? "Draw!" : metaW === "X" ? "You Win!" : "AI Wins!"}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="savebtn" onClick={reset}>Play Again</button>
              <button className="smbtn" onClick={onBack}>Back</button>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 12, fontSize: 10, letterSpacing: 2, color: "var(--mu)" }}>
        <span style={{ color: "var(--X)" }}>X = You</span>
        <span style={{ color: "var(--O)" }}>O = AI ({difficulty})</span>
      </div>
    </div>
  );
}

// ── Global Standings ─────────────────────────────────────
function GlobalStandings() {
  const [tab, setTab] = useState("overall");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);
      const { data: stats } = await supabase
        .from("ttt_player_stats")
        .select("user_id, game_mode, elo_rating, wins, losses, draws, ttt_profiles(display_name, nickname, avatar_url)")
        .order("elo_rating", { ascending: false });
      setData(stats || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const displayName = (row) => {
    const p = row.ttt_profiles;
    if (!p) return "Unknown";
    if (p.nickname && p.nickname.trim()) return p.nickname;
    return p.display_name || "Unknown";
  };

  const filtered = tab === "overall" ? [] : data.filter(d => d.game_mode === tab);

  const overall = (() => {
    const map = {};
    data.forEach(d => {
      if (!map[d.user_id]) map[d.user_id] = { user_id: d.user_id, ttt_profiles: d.ttt_profiles, totalW: 0, totalL: 0, totalD: 0, avgElo: 0, modes: 0 };
      map[d.user_id].totalW += d.wins;
      map[d.user_id].totalL += d.losses;
      map[d.user_id].totalD += d.draws;
      map[d.user_id].avgElo += d.elo_rating;
      map[d.user_id].modes += 1;
    });
    return Object.values(map).map(p => ({ ...p, avgElo: Math.round(p.avgElo / (p.modes || 1)) }))
      .sort((a, b) => b.avgElo - a.avgElo);
  })();

  const rows = tab === "overall" ? overall : filtered;
  const ac = tab === "ultimate" ? "var(--O)" : tab === "mega" ? "var(--mega)" : tab === "classic" ? "var(--X)" : "var(--ac)";

  const tabs = [
    { id: "overall", label: "Overall" },
    { id: "classic", label: "Classic" },
    { id: "ultimate", label: "Ultimate" },
    { id: "mega", label: "MEGA" },
  ];

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: "var(--ac)", marginBottom: 16 }}>Global Standings</div>
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--bd)", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", borderBottom: "2px solid " + (tab === t.id ? ac : "transparent"),
            color: tab === t.id ? ac : "var(--mu)", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2.5px",
            textTransform: "uppercase", padding: "9px 16px", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap"
          }}>{t.label}</button>
        ))}
      </div>
      {loading ? (
        <div style={{ textAlign: "center", color: "var(--mu)", padding: 40, fontSize: 12, letterSpacing: 2 }}>Loading standings...</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--mu)", padding: 40, fontSize: 12, letterSpacing: 2, border: "1px dashed var(--bd)" }}>No ranked players yet</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid " + ac }}>
                <th style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", padding: "10px 12px", textAlign: "left", width: 40 }}>#</th>
                <th style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", padding: "10px 12px", textAlign: "left" }}>Player</th>
                <th style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", padding: "10px 12px", textAlign: "right" }}>W</th>
                <th style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", padding: "10px 12px", textAlign: "right" }}>L</th>
                <th style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", padding: "10px 12px", textAlign: "right" }}>D</th>
                <th style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", padding: "10px 12px", textAlign: "right" }}>ELO</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => {
                const isOverall = tab === "overall";
                const w = isOverall ? row.totalW : row.wins;
                const l = isOverall ? row.totalL : row.losses;
                const d = isOverall ? row.totalD : row.draws;
                const elo = isOverall ? row.avgElo : row.elo_rating;
                const rc = i === 0 ? "var(--go)" : i === 1 ? "var(--si)" : i === 2 ? "var(--br)" : "var(--tx)";
                return (
                  <tr key={row.user_id + (isOverall ? "" : row.game_mode)} style={{ borderBottom: "1px solid var(--bd)" }}>
                    <td style={{ padding: "12px 12px" }}><div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: i < 3 ? rc : "var(--mu)", textAlign: "center" }}>{i + 1}</div></td>
                    <td style={{ padding: "12px 12px", fontWeight: 500, color: i < 3 ? rc : "var(--tx)" }}>{displayName(row)}</td>
                    <td style={{ padding: "12px 12px", textAlign: "right", fontSize: 12, color: "var(--mu)" }}>{w}</td>
                    <td style={{ padding: "12px 12px", textAlign: "right", fontSize: 12, color: "var(--mu)" }}>{l}</td>
                    <td style={{ padding: "12px 12px", textAlign: "right", fontSize: 12, color: "var(--mu)" }}>{d}</td>
                    <td style={{ padding: "12px 12px", textAlign: "right" }}>
                      <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: ac }}>{elo}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Public Leagues ────────────────────────────────────────
function PublicLeagues() {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("ttt_leagues")
        .select("id, name, description, game_mode, game_modes, is_active, season, created_at, ttt_league_members(count)")
        .eq("is_public", true)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      setLeagues(data || []);
      setLoading(false);
    }
    fetch();
  }, []);

  const modeColor = (m) => m === "classic" ? "var(--X)" : m === "ultimate" ? "var(--O)" : m === "mega" ? "var(--mega)" : "var(--ac)";

  if (loading) return <div style={{ textAlign: "center", color: "var(--mu)", padding: 40, fontSize: 12, letterSpacing: 2 }}>Loading leagues...</div>;

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: "var(--ac)", marginBottom: 16 }}>Public Leagues</div>
      {leagues.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--mu)", padding: 40, fontSize: 12, letterSpacing: 2, border: "1px dashed var(--bd)" }}>No public leagues yet</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {leagues.map(lg => {
            const memberCount = lg.ttt_league_members?.[0]?.count || 0;
            const modes = lg.game_modes || [lg.game_mode];
            return (
              <div key={lg.id} style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: 20 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 1, color: "var(--tx)", marginBottom: 6 }}>{lg.name}</div>
                {lg.description && <div style={{ fontSize: 11, color: "var(--mu)", marginBottom: 10, lineHeight: 1.6 }}>{lg.description}</div>}
                <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                  {modes.filter(Boolean).map(m => (
                    <span key={m} style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: "1px solid " + modeColor(m), color: modeColor(m) }}>{m}</span>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "var(--mu)", letterSpacing: 2 }}>
                    {memberCount} member{memberCount !== 1 ? "s" : ""} · Season {lg.season}
                  </span>
                  <button className="smbtn" style={{ fontSize: 9 }}>View</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Play vs AI Section ───────────────────────────────────
function PlayVsAI() {
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState("easy");

  if (mode) {
    const GameComponent = mode === "classic" ? AIClassicGame : mode === "ultimate" ? AIUltimateGame : AIMegaGame;
    return <GameComponent difficulty={difficulty} onBack={() => setMode(null)} />;
  }

  const modes = [
    { id: "classic", label: "Classic", desc: "3x3 board. Get three in a row.", color: "var(--X)" },
    { id: "ultimate", label: "Ultimate", desc: "9 boards in a 3x3 grid. Win boards to win.", color: "var(--O)" },
    { id: "mega", label: "MEGA", desc: "Three layers deep. 81 boards total.", color: "var(--mega)" },
  ];

  const diffs = ["easy", "medium", "hard", "unbeatable"];

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: "var(--ac)", marginBottom: 6 }}>Play vs AI</div>
      <div style={{ fontSize: 11, color: "var(--mu)", letterSpacing: "1.5px", marginBottom: 20 }}>No account needed. Pick a mode and difficulty.</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {diffs.map(d => (
          <button key={d} onClick={() => setDifficulty(d)} style={{
            background: difficulty === d ? "rgba(232,255,71,0.1)" : "none",
            border: "1px solid " + (difficulty === d ? "var(--ac)" : "var(--bd)"),
            color: difficulty === d ? "var(--ac)" : "var(--mu)",
            fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, padding: "7px 14px",
            cursor: "pointer", textTransform: "uppercase"
          }}>{d}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)} style={{
            background: "var(--sf)", border: "1px solid var(--bd)", borderTop: "3px solid " + m.color,
            padding: 24, cursor: "pointer", textAlign: "left"
          }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 2, color: m.color, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: "var(--mu)", letterSpacing: "1.5px", lineHeight: 1.7 }}>{m.desc}</div>
            <div style={{ marginTop: 14, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: m.color }}>Play Now</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Public Homepage ─────────────────────────────────
export default function PublicHome({ onSignIn }) {
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
      `}</style>
      <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, backgroundImage: "linear-gradient(var(--s3) 1px,transparent 1px),linear-gradient(90deg,var(--s3) 1px,transparent 1px)", backgroundSize: "40px 40px", opacity: 0.3 }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 980, margin: "0 auto", padding: "30px 18px 80px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 10, letterSpacing: 4, color: "var(--ac)", textTransform: "uppercase", marginBottom: 8 }}>Competitive Tic-Tac-Toe Platform</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(44px,7vw,76px)", lineHeight: 0.9, letterSpacing: 3 }}>
              TTT<span style={{ color: "var(--ac)", display: "block" }}>ARENA</span>
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 10 }}>
              <button className="savebtn" onClick={onSignIn}>Sign In</button>
              <button className="smbtn" style={{ borderColor: "var(--ac)", color: "var(--ac)" }} onClick={onSignIn}>Sign Up</button>
            </div>
          </div>

          {/* Play vs AI */}
          <div style={{ marginBottom: 50 }}>
            <PlayVsAI />
          </div>

          {/* Global Standings */}
          <div style={{ marginBottom: 50 }}>
            <GlobalStandings />
          </div>

          {/* Public Leagues */}
          <div style={{ marginBottom: 50 }}>
            <PublicLeagues />
          </div>

          {/* Footer CTA */}
          <div style={{ textAlign: "center", padding: "40px 20px", borderTop: "1px solid var(--bd)" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2, marginBottom: 10 }}>
              Ready to <span style={{ color: "var(--ac)" }}>Compete</span>?
            </div>
            <div style={{ fontSize: 11, color: "var(--mu)", letterSpacing: "1.5px", marginBottom: 20, lineHeight: 1.8 }}>
              Create an account to track your stats, join leagues, and challenge other players.
            </div>
            <button className="savebtn" onClick={onSignIn} style={{ padding: "14px 32px", fontSize: 12 }}>Create Free Account</button>
          </div>
        </div>
      </div>
    </>
  );
}
