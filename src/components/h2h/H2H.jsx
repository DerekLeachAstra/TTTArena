import { useState } from 'react';
import OnlineH2H from './OnlineH2H';
import LocalH2H from './LocalH2H';

export default function H2H({ players, h2hData, onDel, onAdd, user }) {
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
