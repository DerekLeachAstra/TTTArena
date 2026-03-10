import { useState } from 'react';
import { dn, PlayerLabel } from '../../lib/playerUtils';

export default function GameSetup({ players, mode, onStart, onStartAI, isAuthenticated }) {
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
