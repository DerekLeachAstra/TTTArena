import { useState } from 'react';
import { dn } from '../../lib/playerUtils';

export default function Manage({ players, setPlayers, onEdit, onDel, onReset }) {
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
