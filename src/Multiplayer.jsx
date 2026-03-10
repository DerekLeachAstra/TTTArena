import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";

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

// ── Live Classic Game ───────────────────────────────────
function LiveClassicGame({ game, userId, onLeave }) {
  const [cells, setCells] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState("X");
  const [winner, setWinner] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [opponentName, setOpponentName] = useState("Opponent");
  const channelRef = useRef(null);

  const myRole = game.player_x_id === userId ? "X" : "O";
  const isMyTurn = turn === myRole && !winner;

  // Load initial board state
  useEffect(() => {
    const bs = game.board_state;
    if (bs && bs.cells) {
      setCells(bs.cells);
      const w = checkWin(bs.cells);
      if (w) { setWinner(w); setWinLine(getWinLine(bs.cells)); }
    }
    setTurn(game.current_turn || "X");

    // Fetch opponent name
    const oppId = myRole === "X" ? game.player_o_id : game.player_x_id;
    if (oppId) {
      supabase.from("ttt_profiles").select("display_name, nickname").eq("id", oppId).single()
        .then(({ data }) => {
          if (data) setOpponentName(data.nickname?.trim() || data.display_name || "Opponent");
        });
    }
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase.channel("live_game_" + game.id)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "ttt_live_games",
        filter: "id=eq." + game.id,
      }, (payload) => {
        const g = payload.new;
        if (g.board_state?.cells) {
          setCells(g.board_state.cells);
          const w = checkWin(g.board_state.cells);
          if (w) { setWinner(w); setWinLine(getWinLine(g.board_state.cells)); }
        }
        setTurn(g.current_turn || "X");
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [game.id]);

  async function play(i) {
    if (!isMyTurn || cells[i] || winner) return;
    const next = cells.map((c, j) => j === i ? myRole : c);
    const w = checkWin(next);
    const nextTurn = myRole === "X" ? "O" : "X";

    setCells(next);
    if (w) { setWinner(w); setWinLine(getWinLine(next)); }
    else setTurn(nextTurn);

    const updateData = {
      board_state: { cells: next },
      current_turn: w ? turn : nextTurn,
      last_move_at: new Date().toISOString(),
    };

    if (w && w !== "T") {
      updateData.status = "finished";
      updateData.result = w === "X" ? "x_wins" : "o_wins";
      updateData.winner_id = w === myRole ? userId : (myRole === "X" ? game.player_o_id : game.player_x_id);
    } else if (w === "T") {
      updateData.status = "finished";
      updateData.result = "draw";
    }

    await supabase.from("ttt_live_games").update(updateData).eq("id", game.id);
  }

  const winnerLabel = winner === "T" ? "Draw!" : winner === myRole ? "You Win!" : `${opponentName} Wins!`;

  return (
    <div style={{ maxWidth: 460, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)" }}>
          {winner ? "" : isMyTurn ?
            <span>Your turn <strong style={{ color: myRole === "X" ? "var(--X)" : "var(--O)" }}>({myRole})</strong></span> :
            <span>Waiting for <strong style={{ color: "var(--O)" }}>{opponentName}</strong></span>
          }
        </div>
        <button className="smbtn" onClick={onLeave}>Leave</button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 10, letterSpacing: 2, color: "var(--mu)" }}>
        <span style={{ color: "var(--X)" }}>X = {myRole === "X" ? "You" : opponentName}</span>
        <span style={{ color: "var(--O)" }}>O = {myRole === "O" ? "You" : opponentName}</span>
      </div>

      <div style={{ position: "relative" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
          {cells.map((c, i) => (
            <div key={i} onClick={() => play(i)} style={{
              aspectRatio: "1", border: "1px solid " + (winLine.includes(i) ? (c === "X" ? "var(--X)" : "var(--O)") : "var(--bd)"),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(38px,9vw,68px)",
              cursor: isMyTurn && !c && !winner ? "pointer" : "default",
              color: c === "X" ? "var(--X)" : c === "O" ? "var(--O)" : "transparent",
              background: winLine.includes(i) ? (c === "X" ? "rgba(232,255,71,0.08)" : "rgba(71,200,255,0.08)") : "var(--sf)",
              transition: "all 0.12s"
            }}>{c}</div>
          ))}
        </div>
        {winner && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(8,8,14,0.92)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: "clamp(28px,7vw,52px)", letterSpacing: 3, color: winner === "T" ? "var(--mu)" : winner === myRole ? "var(--gn)" : "var(--rd)" }}>
              {winnerLabel}
            </div>
            <button className="smbtn" onClick={onLeave}>Back to Lobby</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Game Lobby ──────────────────────────────────────────
function GameLobby({ game, userId, onStart, onCancel }) {
  const [playerCount, setPlayerCount] = useState(game.player_o_id ? 2 : 1);
  const channelRef = useRef(null);

  useEffect(() => {
    const channel = supabase.channel("lobby_" + game.id)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "ttt_live_games",
        filter: "id=eq." + game.id,
      }, (payload) => {
        const g = payload.new;
        if (g.status === "playing" && g.player_o_id) {
          onStart(g);
        }
        setPlayerCount(g.player_o_id ? 2 : 1);
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [game.id]);

  return (
    <div style={{ textAlign: "center", padding: 40 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2, color: "var(--ac)", marginBottom: 12 }}>Waiting for Opponent</div>
      <div style={{ fontSize: 12, color: "var(--mu)", letterSpacing: 2, marginBottom: 24 }}>
        Share this game code with another player:
      </div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 42, letterSpacing: 6, color: "var(--X)", marginBottom: 24 }}>
        {game.id.substring(0, 6).toUpperCase()}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--gn)" }} />
        <span style={{ fontSize: 11, color: "var(--mu)", letterSpacing: 2 }}>{playerCount}/2 players</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--mu)", letterSpacing: "1.5px", lineHeight: 1.8, marginBottom: 20 }}>
        The game will start automatically when another player joins.
      </div>
      <button className="smbtn" onClick={onCancel} style={{ borderColor: "var(--rd)", color: "var(--rd)" }}>Cancel Game</button>
    </div>
  );
}

// ── Main Multiplayer Page ───────────────────────────────
export default function MultiplayerPage({ session }) {
  const [view, setView] = useState("menu"); // menu, lobby, game
  const [currentGame, setCurrentGame] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [openGames, setOpenGames] = useState([]);
  const userId = session.user.id;

  const inp = { background: "var(--s2)", border: "1px solid var(--bd)", color: "var(--tx)", fontFamily: "'DM Mono',monospace", fontSize: 16, padding: "12px 14px", outline: "none", width: "100%", letterSpacing: 4, textTransform: "uppercase", textAlign: "center" };

  // Fetch open games
  useEffect(() => {
    async function fetchOpen() {
      const { data } = await supabase
        .from("ttt_live_games")
        .select("id, game_mode, player_x_id, created_at, ttt_profiles:player_x_id(display_name, nickname)")
        .eq("status", "waiting")
        .neq("player_x_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      setOpenGames(data || []);
    }
    fetchOpen();
    const interval = setInterval(fetchOpen, 5000);
    return () => clearInterval(interval);
  }, []);

  async function createGame(mode) {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase.from("ttt_live_games").insert({
      game_mode: mode,
      player_x_id: userId,
      board_state: { cells: Array(9).fill(null) },
      current_turn: "X",
      status: "waiting",
    }).select().single();

    if (err) { setError(err.message); setLoading(false); return; }
    setCurrentGame(data);
    setView("lobby");
    setLoading(false);
  }

  async function joinGame(gameId) {
    setLoading(true); setError(null);

    const { data: game } = await supabase
      .from("ttt_live_games")
      .select("*")
      .eq("id", gameId)
      .eq("status", "waiting")
      .single();

    if (!game) { setError("Game not found or already started"); setLoading(false); return; }
    if (game.player_x_id === userId) { setError("You can't join your own game"); setLoading(false); return; }

    const { data: updated, error: err } = await supabase
      .from("ttt_live_games")
      .update({ player_o_id: userId, status: "playing" })
      .eq("id", gameId)
      .eq("status", "waiting")
      .select()
      .single();

    if (err) { setError(err.message); setLoading(false); return; }
    setCurrentGame(updated);
    setView("game");
    setLoading(false);
  }

  async function joinByCode() {
    if (!joinCode.trim()) return;
    // Find games matching the code prefix
    const { data } = await supabase
      .from("ttt_live_games")
      .select("*")
      .eq("status", "waiting")
      .neq("player_x_id", userId);

    const match = (data || []).find(g => g.id.substring(0, 6).toUpperCase() === joinCode.trim().toUpperCase());
    if (!match) { setError("No game found with that code"); return; }
    joinGame(match.id);
  }

  async function cancelGame() {
    if (currentGame) {
      await supabase.from("ttt_live_games").update({ status: "cancelled" }).eq("id", currentGame.id);
    }
    setCurrentGame(null);
    setView("menu");
  }

  function leaveGame() {
    setCurrentGame(null);
    setView("menu");
  }

  if (view === "lobby" && currentGame) {
    return <GameLobby game={currentGame} userId={userId} onStart={(g) => { setCurrentGame(g); setView("game"); }} onCancel={cancelGame} />;
  }

  if (view === "game" && currentGame) {
    return <LiveClassicGame game={currentGame} userId={userId} onLeave={leaveGame} />;
  }

  const hostName = (g) => {
    const p = g.ttt_profiles;
    if (!p) return "Unknown";
    if (p.nickname?.trim()) return p.nickname;
    return p.display_name || "Unknown";
  };

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: "var(--ac)", marginBottom: 6 }}>Live Multiplayer</div>
      <div style={{ fontSize: 11, color: "var(--mu)", letterSpacing: "1.5px", marginBottom: 24 }}>
        Create a game or join another player's game. Real-time gameplay via Supabase.
      </div>

      {error && <div style={{ fontSize: 11, color: "var(--rd)", background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.2)", padding: "8px 12px", marginBottom: 14, textAlign: "center" }}>{error}</div>}

      {/* Create Game */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 12 }}>Create a Game</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {[
            { id: "classic", label: "Classic", color: "var(--X)" },
          ].map(m => (
            <button key={m.id} onClick={() => createGame(m.id)} disabled={loading} style={{
              background: "var(--sf)", border: "1px solid var(--bd)", borderTop: "3px solid " + m.color,
              padding: 20, cursor: loading ? "wait" : "pointer", textAlign: "left"
            }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 2, color: m.color }}>{m.label}</div>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: m.color, marginTop: 8 }}>Host Game</div>
            </button>
          ))}
        </div>
      </div>

      {/* Join by Code */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 12 }}>Join by Code</div>
        <div style={{ display: "flex", gap: 8, maxWidth: 340 }}>
          <input style={inp} value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="ABC123" maxLength={6} />
          <button className="savebtn" onClick={joinByCode} disabled={loading} style={{ whiteSpace: "nowrap" }}>Join</button>
        </div>
      </div>

      {/* Open Games */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 12 }}>Open Games</div>
        {openGames.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--mu)", padding: 30, fontSize: 12, letterSpacing: 2, border: "1px dashed var(--bd)" }}>
            No open games right now. Create one!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {openGames.map(g => (
              <div key={g.id} style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "2px 6px", border: "1px solid var(--X)", color: "var(--X)" }}>{g.game_mode}</span>
                  <span style={{ fontSize: 12 }}>hosted by <strong style={{ color: "var(--ac)" }}>{hostName(g)}</strong></span>
                </div>
                <button className="savebtn" style={{ fontSize: 10, padding: "6px 14px" }} onClick={() => joinGame(g.id)}>Join</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
