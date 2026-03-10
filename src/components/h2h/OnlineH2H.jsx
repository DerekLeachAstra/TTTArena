import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function OnlineH2H({ userId }) {
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
