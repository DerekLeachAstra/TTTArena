import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

function generateInviteCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── Create League Form ──────────────────────────────────
function CreateLeague({ userId, onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gameModes, setGameModes] = useState(["classic"]);
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(50);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const inp = { background: "var(--s2)", border: "1px solid var(--bd)", color: "var(--tx)", fontFamily: "'DM Mono',monospace", fontSize: 13, padding: "10px 12px", outline: "none", width: "100%" };

  function toggleMode(mode) {
    setGameModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]);
  }

  async function create() {
    if (!name.trim()) { setError("League name is required"); return; }
    if (!gameModes.length) { setError("Select at least one game mode"); return; }
    setSaving(true); setError(null);

    const inviteCode = generateInviteCode();
    const { data, error: err } = await supabase.from("ttt_leagues").insert({
      name: name.trim(),
      description: description.trim() || null,
      game_mode: gameModes[0],
      game_modes: gameModes,
      owner_id: userId,
      is_public: isPublic,
      invite_code: inviteCode,
      max_members: maxMembers,
    }).select().single();

    if (err) { setError(err.message); setSaving(false); return; }

    // Auto-join as owner
    await supabase.from("ttt_league_members").insert({
      league_id: data.id,
      user_id: userId,
      role: "owner",
    });

    setSaving(false);
    onCreated();
  }

  const modes = [
    { id: "classic", label: "Classic", color: "var(--X)" },
    { id: "ultimate", label: "Ultimate", color: "var(--O)" },
    { id: "mega", label: "MEGA", color: "var(--mega)" },
  ];

  return (
    <div style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: 28, maxWidth: 500 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 2, color: "var(--ac)", marginBottom: 20 }}>Create League</div>

      {error && <div style={{ fontSize: 11, color: "var(--rd)", background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.2)", padding: "8px 12px", marginBottom: 14, textAlign: "center" }}>{error}</div>}

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>League Name</label>
        <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Period 3 Champions" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>Description (optional)</label>
        <input style={inp} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>Game Modes</label>
        <div style={{ display: "flex", gap: 6 }}>
          {modes.map(m => (
            <button key={m.id} onClick={() => toggleMode(m.id)} style={{
              background: gameModes.includes(m.id) ? "rgba(232,255,71,0.1)" : "none",
              border: "1px solid " + (gameModes.includes(m.id) ? m.color : "var(--bd)"),
              color: gameModes.includes(m.id) ? m.color : "var(--mu)",
              fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, padding: "7px 14px",
              cursor: "pointer", textTransform: "uppercase"
            }}>{m.label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>Visibility</label>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setIsPublic(true)} style={{
              background: isPublic ? "rgba(232,255,71,0.1)" : "none",
              border: "1px solid " + (isPublic ? "var(--ac)" : "var(--bd)"),
              color: isPublic ? "var(--ac)" : "var(--mu)",
              fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, padding: "7px 14px", cursor: "pointer"
            }}>Public</button>
            <button onClick={() => setIsPublic(false)} style={{
              background: !isPublic ? "rgba(232,255,71,0.1)" : "none",
              border: "1px solid " + (!isPublic ? "var(--ac)" : "var(--bd)"),
              color: !isPublic ? "var(--ac)" : "var(--mu)",
              fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 2, padding: "7px 14px", cursor: "pointer"
            }}>Private</button>
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>Max Members</label>
          <input style={{ ...inp, width: 80 }} type="number" min="2" max="200" value={maxMembers} onChange={e => setMaxMembers(+e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={onCancel} className="smbtn" style={{ flex: 1 }}>Cancel</button>
        <button onClick={create} disabled={saving} className="savebtn" style={{ flex: 1, opacity: saving ? 0.6 : 1 }}>
          {saving ? "Creating..." : "Create League"}
        </button>
      </div>
    </div>
  );
}

// ── League Detail View ──────────────────────────────────
function LeagueDetail({ league, userId, onBack, onRefresh }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const isOwner = league.owner_id === userId;
  const isMember = members.some(m => m.user_id === userId);

  useEffect(() => {
    async function fetchMembers() {
      const { data } = await supabase
        .from("ttt_league_members")
        .select("*, ttt_profiles(display_name, nickname)")
        .eq("league_id", league.id)
        .eq("status", "active")
        .order("joined_at");
      setMembers(data || []);
      setLoading(false);
    }
    fetchMembers();
  }, [league.id]);

  async function joinLeague() {
    await supabase.from("ttt_league_members").insert({
      league_id: league.id,
      user_id: userId,
      role: "member",
    });
    onRefresh();
  }

  async function leaveLeague() {
    await supabase.from("ttt_league_members")
      .update({ status: "left" })
      .eq("league_id", league.id)
      .eq("user_id", userId);
    onRefresh();
  }

  async function removeMember(memberId) {
    await supabase.from("ttt_league_members")
      .update({ status: "removed" })
      .eq("league_id", league.id)
      .eq("user_id", memberId);
    setMembers(prev => prev.filter(m => m.user_id !== memberId));
  }

  async function promoteMember(memberId) {
    await supabase.from("ttt_league_members")
      .update({ role: "admin" })
      .eq("league_id", league.id)
      .eq("user_id", memberId);
    setMembers(prev => prev.map(m => m.user_id === memberId ? { ...m, role: "admin" } : m));
  }

  const displayName = (m) => {
    const p = m.ttt_profiles;
    if (!p) return "Unknown";
    if (p.nickname && p.nickname.trim()) return p.nickname;
    return p.display_name || "Unknown";
  };

  const modes = league.game_modes || [league.game_mode];
  const modeColor = (m) => m === "classic" ? "var(--X)" : m === "ultimate" ? "var(--O)" : m === "mega" ? "var(--mega)" : "var(--ac)";

  return (
    <div>
      <button className="smbtn" onClick={onBack} style={{ marginBottom: 20 }}>Back to Leagues</button>

      <div style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: 24, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, letterSpacing: 2, color: "var(--tx)" }}>{league.name}</div>
            {league.description && <div style={{ fontSize: 11, color: "var(--mu)", marginTop: 4, lineHeight: 1.6 }}>{league.description}</div>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {!isMember && <button className="savebtn" onClick={joinLeague}>Join League</button>}
            {isMember && !isOwner && <button className="smbtn" style={{ borderColor: "var(--rd)", color: "var(--rd)" }} onClick={leaveLeague}>Leave</button>}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
          {modes.filter(Boolean).map(m => (
            <span key={m} style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: "1px solid " + modeColor(m), color: modeColor(m) }}>{m}</span>
          ))}
          <span style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: "1px solid var(--bd)", color: "var(--mu)" }}>
            {league.is_public ? "Public" : "Private"} · Season {league.season}
          </span>
        </div>

        {isOwner && (
          <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
            <button className="smbtn" onClick={() => setShowInvite(!showInvite)} style={{ fontSize: 9 }}>
              {showInvite ? "Hide" : "Show"} Invite Code
            </button>
            {showInvite && (
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ac)", letterSpacing: 3, fontFamily: "'DM Mono',monospace" }}>
                {league.invite_code}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Members */}
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 2, color: "var(--ac)", marginBottom: 14 }}>
        Members ({members.length}{league.max_members ? "/" + league.max_members : ""})
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--mu)", padding: 30, fontSize: 12, letterSpacing: 2 }}>Loading members...</div>
      ) : members.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--mu)", padding: 30, fontSize: 12, letterSpacing: 2, border: "1px dashed var(--bd)" }}>No members yet</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {members.map((m, i) => {
            const roleColor = m.role === "owner" ? "var(--ac)" : m.role === "admin" ? "var(--O)" : "var(--mu)";
            return (
              <div key={m.id} style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: i < 3 ? (i === 0 ? "var(--go)" : i === 1 ? "var(--si)" : "var(--br)") : "var(--mu)", width: 28, textAlign: "center" }}>{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{displayName(m)}</span>
                  <span style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "2px 6px", border: "1px solid " + roleColor, color: roleColor }}>{m.role}</span>
                </div>
                {isOwner && m.user_id !== userId && (
                  <div style={{ display: "flex", gap: 6 }}>
                    {m.role === "member" && <button className="smbtn" style={{ fontSize: 9, padding: "4px 8px" }} onClick={() => promoteMember(m.user_id)}>Promote</button>}
                    <button className="smbtn" style={{ fontSize: 9, padding: "4px 8px", borderColor: "var(--rd)", color: "var(--rd)" }} onClick={() => removeMember(m.user_id)}>Remove</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Join by Code ────────────────────────────────────────
function JoinByCode({ userId, onJoined, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  const inp = { background: "var(--s2)", border: "1px solid var(--bd)", color: "var(--tx)", fontFamily: "'DM Mono',monospace", fontSize: 16, padding: "12px 14px", outline: "none", width: "100%", letterSpacing: 4, textTransform: "uppercase", textAlign: "center" };

  async function join() {
    if (!code.trim()) return;
    setJoining(true); setError(null);

    const { data: league } = await supabase
      .from("ttt_leagues")
      .select("id, name, max_members")
      .eq("invite_code", code.trim().toUpperCase())
      .eq("is_active", true)
      .single();

    if (!league) { setError("Invalid invite code"); setJoining(false); return; }

    // Check if already a member
    const { data: existing } = await supabase
      .from("ttt_league_members")
      .select("id")
      .eq("league_id", league.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .single();

    if (existing) { setError("You're already a member"); setJoining(false); return; }

    // Check member count
    const { count } = await supabase
      .from("ttt_league_members")
      .select("id", { count: "exact", head: true })
      .eq("league_id", league.id)
      .eq("status", "active");

    if (league.max_members && count >= league.max_members) {
      setError("League is full"); setJoining(false); return;
    }

    await supabase.from("ttt_league_members").insert({
      league_id: league.id,
      user_id: userId,
      role: "member",
    });

    setJoining(false);
    onJoined();
  }

  return (
    <div style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: 28, maxWidth: 400 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, letterSpacing: 2, color: "var(--ac)", marginBottom: 16 }}>Join with Code</div>

      {error && <div style={{ fontSize: 11, color: "var(--rd)", background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.2)", padding: "8px 12px", marginBottom: 14, textAlign: "center" }}>{error}</div>}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--mu)", marginBottom: 6 }}>Invite Code</label>
        <input style={inp} value={code} onChange={e => setCode(e.target.value)} placeholder="ABC123" maxLength={6} />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} className="smbtn" style={{ flex: 1 }}>Cancel</button>
        <button onClick={join} disabled={joining} className="savebtn" style={{ flex: 1, opacity: joining ? 0.6 : 1 }}>
          {joining ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  );
}

// ── Main Leagues Page ───────────────────────────────────
export default function LeaguesPage({ session }) {
  const [myLeagues, setMyLeagues] = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("list"); // list, create, join, detail
  const [selectedLeague, setSelectedLeague] = useState(null);
  const userId = session.user.id;

  async function fetchLeagues() {
    setLoading(true);
    // Get leagues I'm a member of
    const { data: memberships } = await supabase
      .from("ttt_league_members")
      .select("league_id, role, ttt_leagues(*)")
      .eq("user_id", userId)
      .eq("status", "active");

    const mine = (memberships || [])
      .filter(m => m.ttt_leagues?.is_active)
      .map(m => ({ ...m.ttt_leagues, myRole: m.role }));
    setMyLeagues(mine);

    // Get public leagues I'm NOT in
    const myIds = mine.map(l => l.id);
    const { data: pub } = await supabase
      .from("ttt_leagues")
      .select("*, ttt_league_members(count)")
      .eq("is_public", true)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    setPublicLeagues((pub || []).filter(l => !myIds.includes(l.id)));
    setLoading(false);
  }

  useEffect(() => { fetchLeagues(); }, []);

  function openLeague(league) {
    setSelectedLeague(league);
    setView("detail");
  }

  function refresh() {
    fetchLeagues();
    setView("list");
    setSelectedLeague(null);
  }

  const modeColor = (m) => m === "classic" ? "var(--X)" : m === "ultimate" ? "var(--O)" : m === "mega" ? "var(--mega)" : "var(--ac)";

  if (view === "create") return <CreateLeague userId={userId} onCreated={refresh} onCancel={() => setView("list")} />;
  if (view === "join") return <JoinByCode userId={userId} onJoined={refresh} onCancel={() => setView("list")} />;
  if (view === "detail" && selectedLeague) return <LeagueDetail league={selectedLeague} userId={userId} onBack={() => setView("list")} onRefresh={refresh} />;

  if (loading) return <div style={{ textAlign: "center", color: "var(--mu)", padding: 60, fontSize: 12, letterSpacing: 2 }}>Loading leagues...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 2, color: "var(--ac)" }}>Leagues</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="smbtn" onClick={() => setView("join")}>Join with Code</button>
          <button className="savebtn" onClick={() => setView("create")}>Create League</button>
        </div>
      </div>

      {/* My Leagues */}
      {myLeagues.length > 0 && (
        <div style={{ marginBottom: 30 }}>
          <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 12 }}>My Leagues</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {myLeagues.map(lg => {
              const modes = lg.game_modes || [lg.game_mode];
              return (
                <div key={lg.id} onClick={() => openLeague(lg)} style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: 20, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 1, color: "var(--tx)", marginBottom: 6 }}>{lg.name}</div>
                    <span style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "2px 6px", border: "1px solid " + (lg.myRole === "owner" ? "var(--ac)" : "var(--O)"), color: lg.myRole === "owner" ? "var(--ac)" : "var(--O)" }}>{lg.myRole}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {modes.filter(Boolean).map(m => (
                      <span key={m} style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: "1px solid " + modeColor(m), color: modeColor(m) }}>{m}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--mu)", letterSpacing: 2, marginTop: 10 }}>Season {lg.season}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Public Leagues */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "var(--mu)", marginBottom: 12 }}>Public Leagues</div>
        {publicLeagues.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--mu)", padding: 30, fontSize: 12, letterSpacing: 2, border: "1px dashed var(--bd)" }}>
            No public leagues available. Create one!
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {publicLeagues.map(lg => {
              const modes = lg.game_modes || [lg.game_mode];
              const memberCount = lg.ttt_league_members?.[0]?.count || 0;
              return (
                <div key={lg.id} onClick={() => openLeague(lg)} style={{ background: "var(--sf)", border: "1px solid var(--bd)", padding: 20, cursor: "pointer" }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 1, color: "var(--tx)", marginBottom: 6 }}>{lg.name}</div>
                  {lg.description && <div style={{ fontSize: 11, color: "var(--mu)", marginBottom: 8, lineHeight: 1.6 }}>{lg.description}</div>}
                  <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                    {modes.filter(Boolean).map(m => (
                      <span key={m} style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", padding: "3px 8px", border: "1px solid " + modeColor(m), color: modeColor(m) }}>{m}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--mu)", letterSpacing: 2 }}>
                    {memberCount} member{memberCount !== 1 ? "s" : ""} · Season {lg.season}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
