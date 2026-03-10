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

function calcEloChange(rating, oppRating, result) {
  const K = 32;
  const expected = 1 / (1 + Math.pow(10, (oppRating - rating) / 400));
  const actual = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  return Math.round(K * (actual - expected));
}

// AI "ELO" by difficulty
const AI_ELO = { easy: 600, medium: 1000, hard: 1400, unbeatable: 1800 };

// ── Win Prob Meter ──────────────────────────────────────
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

// ── Profile Editor ──────────────────────────────────────
function ProfileEditor({ profile, onSave }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [nickname, setNickname] = useState(profile?.nickname || "");
  const [saving, setSaving] = useState(false);

  const inp = { background: "var(--s2)", border: "1px solid var(--bd)", color: "var(--tx)", fontFamily: "'DM Mono',monospace", fontSize: 13, padding: "10px 12px", outline: "none", width: "100%" };

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("ttt_profiles").update({ display_name: displayName.trim(), nickname: nickname.trim() }).eq("id", profile.id);
    if (!error) onSave({ ...profile, display_name: displayName.trim(), nickname: nickname.trim() });
    setSaving(false);
  }

  return (
    <div style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: 24, marginBottom: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 16 }}>Edit Profile</div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>Display Name</label>
          <input style={inp} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>Nickname</label>
          <input style={inp} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Optional gamertag" />
        </div>
      </div>
      <button onClick={save} disabled={saving} className="savebtn" style={{ opacity: saving ? 0.6 : 1 }}>
        {saving ? "Saving..." : "Save Profile"}
      </button>
    </div>
  );
}

// ── Stats Dashboard ─────────────────────────────────────
function StatsDashboard({ stats, recentMatches }) {
  const modes = [
    { id: "classic", label: "Classic", color: "var(--X)" },
    { id: "ultimate", label: "Ultimate", color: "var(--O)" },
    { id: "mega", label: "MEGA", color: "var(--mega)" },
  ];

  const modeStat = (mode) => stats.find(s => s.game_mode === mode) || { elo_rating: 1200, wins: 0, losses: 0, draws: 0 };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 30 }}>
        {modes.map(m => {
          const s = modeStat(m.id);
          const total = s.wins + s.losses + s.draws;
          const winRate = total ? Math.round(s.wins / total * 100) : 0;
          return (
            <div key={m.id} style={{ background: "var(--sf)", border: "1px solid var(--bd)", borderTop: "3px solid " + m.color, padding: 20 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: m.color, marginBottom: 10 }}>{m.label}</div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 42, letterSpacing: 2, color: "var(--ac)", lineHeight: 1 }}>{s.elo_rating}</div>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "var(--mu)", marginTop: 4 }}>ELO RATING</div>
              <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11 }}>
                <span style={{ color: "var(--gn)" }}>{s.wins}W</span>
                <span style={{ color: "var(--rd)" }}>{s.losses}L</span>
                <span style={{ color: "var(--mu)" }}>{s.draws}D</span>
              </div>
              {total > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", background: "var(--s2)" }}>
                    <div style={{ width: winRate + "%", background: "var(--gn)" }} />
                    <div style={{ width: (100 - winRate) + "%", background: "var(--rd)", opacity: 0.5 }} />
                  </div>
                  <div style={{ fontSize: 10, color: "var(--mu)", marginTop: 4, letterSpacing: 2 }}>{winRate}% WIN RATE ({total} games)</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {recentMatches.length > 0 && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 12 }}>Recent Matches</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recentMatches.slice(0, 10).map(m => {
              const isWin = m.result === "x_wins";
              const isDraw = m.is_draw;
              const color = isDraw ? "var(--mu)" : isWin ? "var(--gn)" : "var(--rd)";
              const label = isDraw ? "DRAW" : isWin ? "WIN" : "LOSS";
              const modeColor = m.game_mode === "classic" ? "var(--X)" : m.game_mode === "ultimate" ? "var(--O)" : "var(--mega)";
              return (
                <div key={m.id} style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "2px 6px", border: "1px solid " + modeColor, color: modeColor }}>{m.game_mode}</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color }}>
                      {label}
                    </span>
                    {m.ai_difficulty && <span style={{ fontSize: 10, color: "var(--mu)" }}>vs AI ({m.ai_difficulty})</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {m.elo_change_x !== 0 && (
                      <span style={{ fontSize: 11, color: m.elo_change_x > 0 ? "var(--gn)" : "var(--rd)" }}>
                        {m.elo_change_x > 0 ? "+" : ""}{m.elo_change_x}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: "var(--mu)" }}>
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ranked Classic Game ─────────────────────────────────
function RankedClassicGame({ difficulty, userId, onComplete, onBack }) {
  const [cells, setCells] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [prob, setProb] = useState({ x: 0, o: 0, draw: 1 });
  const [saved, setSaved] = useState(false);
  const aiRef = useRef(null);
  const startTime = useRef(Date.now());

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

  async function saveResult() {
    if (saved || !winner) return;
    setSaved(true);
    const duration = Math.round((Date.now() - startTime.current) / 1000);
    const result = winner === "T" ? "draw" : winner === "X" ? "x_wins" : "o_wins";
    const isWin = winner === "X";
    const isDraw = winner === "T";
    const eloResult = isWin ? "win" : isDraw ? "draw" : "loss";

    // Get current stats
    const { data: statData } = await supabase
      .from("ttt_player_stats")
      .select("*")
      .eq("user_id", userId)
      .eq("game_mode", "classic")
      .single();

    const currentElo = statData?.elo_rating || 1200;
    const eloChange = calcEloChange(currentElo, AI_ELO[difficulty], eloResult);

    // Update stats
    const newStats = {
      wins: (statData?.wins || 0) + (isWin ? 1 : 0),
      losses: (statData?.losses || 0) + (!isWin && !isDraw ? 1 : 0),
      draws: (statData?.draws || 0) + (isDraw ? 1 : 0),
      elo_rating: currentElo + eloChange,
    };

    await supabase.from("ttt_player_stats").upsert({
      user_id: userId,
      game_mode: "classic",
      ...newStats,
    }, { onConflict: "user_id,game_mode" });

    // Save match
    await supabase.from("ttt_matches").insert({
      game_mode: "classic",
      player_x_id: userId,
      result,
      is_draw: isDraw,
      winner_id: isWin ? userId : null,
      ai_difficulty: difficulty,
      elo_change_x: eloChange,
      duration_seconds: duration,
      match_type: "ranked_ai",
      completed_at: new Date().toISOString(),
    });

    onComplete();
  }

  // Auto-save when game ends
  useEffect(() => {
    if (winner && !saved) saveResult();
  }, [winner]);

  function reset() {
    if (aiRef.current) clearTimeout(aiRef.current);
    setCells(Array(9).fill(null)); setTurn("X"); setWinner(null); setWinLine([]); setThinking(false); setProb({ x: 0, o: 0, draw: 1 }); setSaved(false);
    startTime.current = Date.now();
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
      <div style={{ textAlign: "center", marginBottom: 8, fontSize: 9, letterSpacing: 3, color: "var(--gn)", textTransform: "uppercase" }}>
        Ranked Match · ELO Changes Apply
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
            <div style={{ fontSize: 10, color: "var(--mu)", letterSpacing: 2 }}>
              {saved ? "Result saved" : "Saving..."}
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

// ── Ranked AI Selector ──────────────────────────────────
function RankedAI({ userId, onComplete }) {
  const [mode, setMode] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");

  if (mode === "classic") {
    return <RankedClassicGame difficulty={difficulty} userId={userId} onComplete={onComplete} onBack={() => setMode(null)} />;
  }
  // For now, only Classic is ranked. Ultimate and MEGA can be added similarly.

  const diffs = [
    { id: "easy", label: "Easy", elo: AI_ELO.easy },
    { id: "medium", label: "Medium", elo: AI_ELO.medium },
    { id: "hard", label: "Hard", elo: AI_ELO.hard },
    { id: "unbeatable", label: "Unbeatable", elo: AI_ELO.unbeatable },
  ];

  const modes = [
    { id: "classic", label: "Classic", desc: "3x3 ranked match vs AI", color: "var(--X)", enabled: true },
    { id: "ultimate", label: "Ultimate", desc: "Coming soon", color: "var(--O)", enabled: false },
    { id: "mega", label: "MEGA", desc: "Coming soon", color: "var(--mega)", enabled: false },
  ];

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: "var(--ac)", marginBottom: 6 }}>Ranked AI Match</div>
      <div style={{ fontSize: 11, color: "var(--mu)", letterSpacing: "1.5px", marginBottom: 20 }}>Play ranked games against AI. Results affect your ELO rating.</div>

      <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 10 }}>Difficulty</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {diffs.map(d => (
          <button key={d.id} onClick={() => setDifficulty(d.id)} style={{
            background: difficulty === d.id ? "rgba(232,255,71,0.1)" : "none",
            border: "1px solid " + (difficulty === d.id ? "var(--ac)" : "var(--bd)"),
            color: difficulty === d.id ? "var(--ac)" : "var(--mu)",
            fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, padding: "7px 14px",
            cursor: "pointer", textTransform: "uppercase"
          }}>
            {d.label}
            <span style={{ display: "block", fontSize: 9, color: "var(--mu)", marginTop: 2 }}>ELO {d.elo}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {modes.map(m => (
          <button key={m.id} onClick={() => m.enabled && setMode(m.id)} disabled={!m.enabled} style={{
            background: "var(--sf)", border: "1px solid var(--bd)", borderTop: "3px solid " + m.color,
            padding: 24, cursor: m.enabled ? "pointer" : "not-allowed", textAlign: "left",
            opacity: m.enabled ? 1 : 0.4
          }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 2, color: m.color, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 11, color: "var(--mu)", letterSpacing: "1.5px", lineHeight: 1.7 }}>{m.desc}</div>
            {m.enabled && <div style={{ marginTop: 14, fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: m.color }}>Play Ranked</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Profile Page ───────────────────────────────────
export default function ProfilePage({ session }) {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const userId = session.user.id;

  async function fetchData() {
    setLoading(true);
    const [profileRes, statsRes, matchesRes] = await Promise.all([
      supabase.from("ttt_profiles").select("*").eq("id", userId).single(),
      supabase.from("ttt_player_stats").select("*").eq("user_id", userId),
      supabase.from("ttt_matches").select("*").eq("player_x_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    setProfile(profileRes.data);
    setStats(statsRes.data || []);
    setMatches(matchesRes.data || []);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "ranked", label: "Ranked AI" },
    { id: "profile", label: "Profile" },
  ];

  if (loading) {
    return <div style={{ textAlign: "center", color: "var(--mu)", padding: 60, fontSize: 12, letterSpacing: 2 }}>Loading profile...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 2, marginBottom: 24, borderBottom: "1px solid var(--bd)", overflowX: "auto" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", borderBottom: "2px solid " + (tab === t.id ? "var(--ac)" : "transparent"),
            color: tab === t.id ? "var(--ac)" : "var(--mu)", fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: "2.5px",
            textTransform: "uppercase", padding: "9px 16px", cursor: "pointer", marginBottom: -1, whiteSpace: "nowrap"
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "dashboard" && <StatsDashboard stats={stats} recentMatches={matches} />}
      {tab === "ranked" && <RankedAI userId={userId} onComplete={fetchData} />}
      {tab === "profile" && profile && <ProfileEditor profile={profile} onSave={p => setProfile(p)} />}
    </div>
  );
}
