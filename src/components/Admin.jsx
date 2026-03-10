import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { logError } from '../lib/logger';

const ADMIN_EMAIL = 'contact@derekleach.com';
const REFRESH_INTERVAL = 15000; // 15 seconds

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bd)',
      padding: '18px 20px', borderRadius: 4, minWidth: 140,
    }}>
      <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: 2, color: color || 'var(--hl)' }}>
        {value ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--mu)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MiniTable({ title, columns, rows }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--ac)', marginBottom: 8, fontWeight: 600 }}>
        {title}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--mu)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '6px 10px', color: j === 0 ? 'var(--fg)' : 'var(--mu)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length} style={{ padding: '12px 10px', color: 'var(--mu)', fontStyle: 'italic' }}>No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SparkBar({ data, maxVal, color = 'var(--ac)' }) {
  if (!data || data.length === 0) return null;
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
      {data.map((d, i) => (
        <div key={i} title={`${d.label}: ${d.value}`} style={{
          flex: 1, minWidth: 4, maxWidth: 14,
          height: Math.max(2, (d.value / max) * 40),
          background: color, borderRadius: '2px 2px 0 0', opacity: 0.8,
        }} />
      ))}
    </div>
  );
}

function DailyReport({ report, onBack }) {
  const d = report.data;
  const printReport = () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>TTT Arena — Daily Report ${report.report_date}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
      h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #555; border-bottom: 2px solid #e0e0e0; padding-bottom: 6px; margin: 28px 0 14px; }
      .subtitle { font-size: 11px; color: #888; margin-bottom: 24px; }
      .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
      .stat { background: #f8f8fa; border: 1px solid #e8e8ee; padding: 14px; border-radius: 4px; }
      .stat-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 4px; }
      .stat-value { font-size: 24px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
      th { text-align: left; padding: 6px 10px; border-bottom: 2px solid #e0e0e0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
      td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
      .footer { margin-top: 40px; font-size: 10px; color: #aaa; text-align: center; }
      @media print { body { padding: 20px; } }
    </style></head><body>
    <h1>TTT ARENA — DAILY REPORT</h1>
    <div class="subtitle">${report.report_date} &middot; Generated ${new Date(d.generated_at).toLocaleString()}</div>

    <h2>Users</h2>
    <div class="grid">
      <div class="stat"><div class="stat-label">Total Accounts</div><div class="stat-value">${d.accounts?.total ?? 0}</div></div>
      <div class="stat"><div class="stat-label">New Signups</div><div class="stat-value">${d.accounts?.new_signups ?? 0}</div></div>
      <div class="stat"><div class="stat-label">Daily Active Users</div><div class="stat-value">${d.active_users?.daily_active ?? 0}</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
    </div>

    <h2>Matches</h2>
    <div class="grid">
      <div class="stat"><div class="stat-label">Total Played</div><div class="stat-value">${d.matches?.total_played ?? 0}</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
    </div>
    ${(d.matches?.by_mode || []).length > 0 ? `
    <table><thead><tr><th>Mode</th><th>Games</th><th>Decisive</th><th>Draws</th><th>Avg Duration</th></tr></thead><tbody>
    ${(d.matches?.by_mode || []).map(m => `<tr><td>${m.game_mode}</td><td>${m.games}</td><td>${m.decisive}</td><td>${m.draws}</td><td>${m.avg_duration_sec || '—'}s</td></tr>`).join('')}
    </tbody></table>` : ''}

    <h2>Leagues</h2>
    <div class="grid">
      <div class="stat"><div class="stat-label">Active Leagues</div><div class="stat-value">${d.leagues?.total_active ?? 0}</div></div>
      <div class="stat"><div class="stat-label">New Created</div><div class="stat-value">${d.leagues?.new_created ?? 0}</div></div>
      <div class="stat"><div class="stat-label">Total Members</div><div class="stat-value">${d.leagues?.total_members ?? 0}</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
    </div>

    <h2>Rivals</h2>
    <div class="grid">
      <div class="stat"><div class="stat-label">New Rivalries</div><div class="stat-value">${d.rivals?.new_rivalries ?? 0}</div></div>
      <div class="stat"><div class="stat-label">Challenges Sent</div><div class="stat-value">${d.rivals?.challenges_sent ?? 0}</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
    </div>

    <h2>Tournaments</h2>
    <div class="grid">
      <div class="stat"><div class="stat-label">Total</div><div class="stat-value">${d.tournaments?.total ?? 0}</div></div>
      <div class="stat"><div class="stat-label">New Created</div><div class="stat-value">${d.tournaments?.new_created ?? 0}</div></div>
      <div class="stat"><div class="stat-label">Active</div><div class="stat-value">${d.tournaments?.active ?? 0}</div></div>
      <div class="stat"><div class="stat-label">—</div><div class="stat-value">&nbsp;</div></div>
    </div>

    ${(d.top_elo_changes || []).length > 0 ? `
    <h2>Top Rating Changes</h2>
    <table><thead><tr><th>Player</th><th>Mode</th><th>Rating Change</th></tr></thead><tbody>
    ${(d.top_elo_changes || []).map(e => `<tr><td>${e.display_name}</td><td>${e.game_mode}</td><td>${e.elo_change > 0 ? '+' : ''}${e.elo_change}</td></tr>`).join('')}
    </tbody></table>` : ''}

    <div class="footer">TTT Arena &middot; Automated Daily Report &middot; ${report.report_date}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="smbtn" onClick={onBack}>&larr; Back to Dashboard</button>
        <button className="savebtn" style={{ padding: '8px 18px', fontSize: 10 }} onClick={printReport}>
          Print / Save as PDF
        </button>
      </div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, letterSpacing: 4, color: 'var(--hl)', margin: 0 }}>
        DAILY REPORT — {report.report_date}
      </h2>
      <div style={{ fontSize: 9, color: 'var(--mu)', marginBottom: 20 }}>
        Generated {new Date(d.generated_at).toLocaleString()}
      </div>

      <SectionTitle title="Users" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Total Accounts" value={d.accounts?.total} color="var(--hl)" />
        <StatCard label="New Signups" value={d.accounts?.new_signups} color="var(--go)" />
        <StatCard label="Daily Active" value={d.active_users?.daily_active} color="var(--ac)" />
      </div>

      <SectionTitle title="Matches" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Total Played" value={d.matches?.total_played} color="var(--hl)" />
      </div>
      {(d.matches?.by_mode || []).length > 0 && (
        <MiniTable title="By Game Mode" columns={['Mode', 'Games', 'Decisive', 'Draws', 'Avg Duration']}
          rows={(d.matches?.by_mode || []).map(m => [m.game_mode, m.games, m.decisive, m.draws, `${m.avg_duration_sec || '—'}s`])} />
      )}

      <SectionTitle title="Leagues" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Active" value={d.leagues?.total_active} color="var(--ac)" />
        <StatCard label="New Created" value={d.leagues?.new_created} color="var(--go)" />
        <StatCard label="Total Members" value={d.leagues?.total_members} color="var(--hl)" />
      </div>

      <SectionTitle title="Rivals" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="New Rivalries" value={d.rivals?.new_rivalries} color="var(--ac)" />
        <StatCard label="Challenges Sent" value={d.rivals?.challenges_sent} color="var(--go)" />
      </div>

      <SectionTitle title="Tournaments" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Total" value={d.tournaments?.total} color="var(--ac)" />
        <StatCard label="New" value={d.tournaments?.new_created} color="var(--go)" />
        <StatCard label="Active" value={d.tournaments?.active} color="var(--hl)" />
      </div>

      {(d.top_elo_changes || []).length > 0 && (
        <>
          <SectionTitle title="Top Rating Changes" />
          <MiniTable title="" columns={['Player', 'Mode', 'Rating Change']}
            rows={(d.top_elo_changes || []).map(e => [e.display_name, e.game_mode, `${e.elo_change > 0 ? '+' : ''}${e.elo_change}`])} />
        </>
      )}
    </div>
  );
}

// --- Admin Management Components ---

function UserManager({ onBack }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // user detail view
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusModal, setStatusModal] = useState(null); // { userId, action }
  const [reason, setReason] = useState('');
  const [editModal, setEditModal] = useState(null); // user to edit
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const PAGE_SIZE = 20;

  const search = useCallback(async (q = query, p = page) => {
    setLoading(true);
    try {
      const { data: result, error: err } = await supabase.rpc('admin_search_users', {
        p_query: q, p_limit: PAGE_SIZE, p_offset: p * PAGE_SIZE
      });
      if (err) throw err;
      setUsers(result.users || []);
      setTotal(result.total || 0);
    } catch (err) {
      logError('admin_search_users:', err);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => { search(); }, [search]);

  const fetchDetail = async (userId) => {
    setDetailLoading(true);
    try {
      const { data: result, error: err } = await supabase.rpc('admin_get_user_details', { p_user_id: userId });
      if (err) throw err;
      setDetail(result);
    } catch (err) {
      logError('admin_get_user_details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSetStatus = async (userId, status) => {
    setActionLoading(true);
    try {
      const { error: err } = await supabase.rpc('admin_set_user_status', {
        p_user_id: userId, p_status: status, p_reason: reason || null
      });
      if (err) throw err;
      setStatusModal(null);
      setReason('');
      search();
      if (selected === userId) fetchDetail(userId);
    } catch (err) {
      logError('admin_set_user_status:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    setActionLoading(true);
    try {
      const { error: err } = await supabase.rpc('admin_delete_user', {
        p_user_id: userId, p_reason: reason || 'Deleted by admin'
      });
      if (err) throw err;
      setStatusModal(null);
      setReason('');
      setSelected(null);
      setDetail(null);
      search();
    } catch (err) {
      logError('admin_delete_user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditUser = async () => {
    setActionLoading(true);
    try {
      const { error: err } = await supabase.rpc('admin_update_user', {
        p_user_id: editModal.id,
        p_display_name: editName || null,
        p_username: editUsername || null,
      });
      if (err) throw err;
      setEditModal(null);
      search();
      if (selected === editModal.id) fetchDetail(editModal.id);
    } catch (err) {
      logError('admin_update_user:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const statusColor = (s) => {
    if (s === 'active') return 'var(--go)';
    if (s === 'suspended') return '#ffa500';
    if (s === 'blocked') return 'var(--rd)';
    if (s === 'deleted') return 'var(--mu)';
    return 'var(--fg)';
  };

  // Detail view
  if (selected && detail) {
    const p = detail.profile;
    return (
      <div>
        <button className="smbtn" onClick={() => { setSelected(null); setDetail(null); }}>&larr; Back to Users</button>
        <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 3, color: 'var(--hl)', margin: '16px 0 8px' }}>
          {p.display_name || 'Unknown'}
        </h3>
        <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 4 }}>@{p.username || '—'} &middot; {p.email}</div>
        <div style={{ fontSize: 11, marginBottom: 16 }}>
          Status: <span style={{ color: statusColor(p.status), fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{p.status}</span>
          {p.suspend_reason && <span style={{ color: 'var(--mu)', marginLeft: 8 }}>— {p.suspend_reason}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          <StatCard label="Joined" value={new Date(p.auth_created_at).toLocaleDateString()} color="var(--ac)" />
          <StatCard label="Last Sign In" value={p.last_sign_in_at ? new Date(p.last_sign_in_at).toLocaleDateString() : '—'} color="var(--ac)" />
          <StatCard label="Last Seen" value={p.last_seen_at ? new Date(p.last_seen_at).toLocaleDateString() : '—'} color="var(--go)" />
          <StatCard label="Matches" value={detail.match_count} color="var(--hl)" />
          <StatCard label="Rivalries" value={detail.rival_count} color="var(--ac)" />
          <StatCard label="Leagues" value={(detail.leagues || []).length} color="var(--ac)" />
        </div>
        {(detail.stats || []).length > 0 && (
          <MiniTable title="Player Stats" columns={['Mode', 'Rating', 'W', 'L', 'D']}
            rows={detail.stats.map(s => [s.game_mode, s.elo_rating, s.wins, s.losses, s.draws])} />
        )}
        {(detail.leagues || []).length > 0 && (
          <MiniTable title="League Memberships" columns={['League', 'Role']}
            rows={detail.leagues.map(l => [l.league_name, l.role])} />
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
          <button className="smbtn" onClick={() => { setEditModal(p); setEditName(p.display_name || ''); setEditUsername(p.username || ''); }}>
            Edit Profile
          </button>
          {p.status === 'active' && (
            <button className="smbtn" style={{ color: '#ffa500', borderColor: '#ffa500' }}
              onClick={() => setStatusModal({ userId: p.id, action: 'suspend' })}>
              Suspend
            </button>
          )}
          {p.status === 'active' && (
            <button className="smbtn" style={{ color: 'var(--rd)', borderColor: 'var(--rd)' }}
              onClick={() => setStatusModal({ userId: p.id, action: 'block' })}>
              Block
            </button>
          )}
          {(p.status === 'suspended' || p.status === 'blocked') && (
            <button className="smbtn" style={{ color: 'var(--go)', borderColor: 'var(--go)' }}
              onClick={() => handleSetStatus(p.id, 'active')}>
              Reactivate
            </button>
          )}
          {p.status !== 'deleted' && (
            <button className="smbtn" style={{ color: 'var(--rd)', borderColor: 'var(--rd)' }}
              onClick={() => setStatusModal({ userId: p.id, action: 'delete' })}>
              Delete
            </button>
          )}
        </div>
        {/* Status Action Modal */}
        {statusModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
            onClick={() => setStatusModal(null)}>
            <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: 28, maxWidth: 400, width: '90%' }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: statusModal.action === 'delete' ? 'var(--rd)' : '#ffa500', margin: '0 0 12px' }}>
                {statusModal.action === 'suspend' ? 'Suspend User' : statusModal.action === 'block' ? 'Block User' : 'Delete User'}
              </h3>
              <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 12 }}>
                {statusModal.action === 'delete' ? 'This will anonymize the user and ban their auth account. This cannot be undone.' :
                  statusModal.action === 'block' ? 'This will block the user from logging in.' :
                  'This will temporarily suspend the user.'}
              </div>
              <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Reason (optional)</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Enter reason..."
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12, marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="smbtn" onClick={() => { setStatusModal(null); setReason(''); }}>Cancel</button>
                <button className="savebtn" disabled={actionLoading}
                  style={{ padding: '8px 16px', fontSize: 10, background: statusModal.action === 'delete' ? 'var(--rd)' : undefined }}
                  onClick={() => {
                    if (statusModal.action === 'delete') handleDeleteUser(statusModal.userId);
                    else if (statusModal.action === 'suspend') handleSetStatus(statusModal.userId, 'suspended');
                    else handleSetStatus(statusModal.userId, 'blocked');
                  }}>
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Edit Modal */}
        {editModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
            onClick={() => setEditModal(null)}>
            <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: 28, maxWidth: 400, width: '90%' }}
              onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: 'var(--hl)', margin: '0 0 16px' }}>Edit User</h3>
              <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Display Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12, marginBottom: 12 }} />
              <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Username</label>
              <input value={editUsername} onChange={e => setEditUsername(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12, marginBottom: 16 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="smbtn" onClick={() => setEditModal(null)}>Cancel</button>
                <button className="savebtn" disabled={actionLoading} style={{ padding: '8px 16px', fontSize: 10 }} onClick={handleEditUser}>
                  {actionLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Loading detail
  if (selected && detailLoading) {
    return (
      <div>
        <button className="smbtn" onClick={() => { setSelected(null); setDetail(null); }}>&larr; Back to Users</button>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--mu)', fontSize: 11 }}>Loading user details...</div>
      </div>
    );
  }

  // User list view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="smbtn" onClick={onBack}>&larr; Back to Dashboard</button>
        <div style={{ fontSize: 10, color: 'var(--mu)' }}>{total} total users</div>
      </div>
      <SectionTitle title="User Management" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}
          placeholder="Search by name, username, or email..."
          style={{ flex: 1, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12 }}
        />
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--mu)', fontSize: 11 }}>Searching...</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['User', 'Email', 'Status', 'Joined', 'Last Seen'].map(c => (
                  <th key={c} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--mu)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
                  onClick={() => { setSelected(u.id); fetchDetail(u.id); }}>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 500 }}>{u.display_name || 'Unknown'}</div>
                    {u.username && <div style={{ fontSize: 9, color: 'var(--mu)' }}>@{u.username}</div>}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--mu)', fontSize: 10 }}>{u.email || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: statusColor(u.status), fontWeight: 600 }}>
                      {u.status || 'active'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--mu)', fontSize: 10 }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--mu)', fontSize: 10 }}>
                    {u.last_seen_at ? new Date(u.last_seen_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '20px 10px', color: 'var(--mu)', fontStyle: 'italic', textAlign: 'center' }}>No users found</td></tr>
              )}
            </tbody>
          </table>
          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="smbtn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span style={{ fontSize: 10, color: 'var(--mu)', lineHeight: '30px' }}>
                Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button className="smbtn" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeagueManager({ onBack }) {
  const [leagues, setLeagues] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [editModal, setEditModal] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [editMaxMembers, setEditMaxMembers] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const PAGE_SIZE = 20;

  const search = useCallback(async (q = query, p = page) => {
    setLoading(true);
    try {
      const { data: result, error: err } = await supabase.rpc('admin_search_leagues', {
        p_query: q, p_limit: PAGE_SIZE, p_offset: p * PAGE_SIZE
      });
      if (err) throw err;
      setLeagues(result.leagues || []);
      setTotal(result.total || 0);
    } catch (err) {
      logError('admin_search_leagues:', err);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => { search(); }, [search]);

  const handleEdit = async () => {
    setActionLoading(true);
    try {
      const { error: err } = await supabase.rpc('admin_update_league', {
        p_league_id: editModal.id,
        p_name: editName || null,
        p_description: editDesc || null,
        p_is_public: editPublic,
        p_max_members: editMaxMembers ? parseInt(editMaxMembers, 10) : null,
      });
      if (err) throw err;
      setEditModal(null);
      search();
    } catch (err) {
      logError('admin_update_league:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (leagueId) => {
    setActionLoading(true);
    try {
      const { error: err } = await supabase.rpc('admin_delete_league', { p_league_id: leagueId });
      if (err) throw err;
      setDeleteConfirm(null);
      search();
    } catch (err) {
      logError('admin_delete_league:', err);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button className="smbtn" onClick={onBack}>&larr; Back to Dashboard</button>
        <div style={{ fontSize: 10, color: 'var(--mu)' }}>{total} total leagues</div>
      </div>
      <SectionTitle title="League Management" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={query} onChange={e => { setQuery(e.target.value); setPage(0); }}
          placeholder="Search by name or invite code..."
          style={{ flex: 1, padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12 }}
        />
      </div>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: 'var(--mu)', fontSize: 11 }}>Searching...</div>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr>
                {['League', 'Owner', 'Members', 'Public', 'Active', 'Created', 'Actions'].map(c => (
                  <th key={c} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--bd)', color: 'var(--mu)', fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leagues.map(lg => (
                <tr key={lg.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontWeight: 500 }}>{lg.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--mu)' }}>{lg.invite_code}</div>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--mu)', fontSize: 10 }}>{lg.owner_name || '—'}</td>
                  <td style={{ padding: '8px 10px', color: 'var(--mu)' }}>{lg.member_count}</td>
                  <td style={{ padding: '8px 10px', fontSize: 10 }}>
                    <span style={{ color: lg.is_public ? 'var(--go)' : 'var(--mu)' }}>{lg.is_public ? 'Yes' : 'No'}</span>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 10 }}>
                    <span style={{ color: lg.is_active ? 'var(--go)' : 'var(--rd)' }}>{lg.is_active ? 'Yes' : 'No'}</span>
                  </td>
                  <td style={{ padding: '8px 10px', color: 'var(--mu)', fontSize: 10 }}>
                    {new Date(lg.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="smbtn" style={{ fontSize: 9, padding: '3px 8px' }}
                        onClick={() => { setEditModal(lg); setEditName(lg.name); setEditDesc(lg.description || ''); setEditPublic(lg.is_public); setEditMaxMembers(lg.max_members?.toString() || ''); }}>
                        Edit
                      </button>
                      <button className="smbtn" style={{ fontSize: 9, padding: '3px 8px', color: 'var(--rd)', borderColor: 'var(--rd)' }}
                        onClick={() => setDeleteConfirm(lg)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leagues.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '20px 10px', color: 'var(--mu)', fontStyle: 'italic', textAlign: 'center' }}>No leagues found</td></tr>
              )}
            </tbody>
          </table>
          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="smbtn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
              <span style={{ fontSize: 10, color: 'var(--mu)', lineHeight: '30px' }}>
                Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
              </span>
              <button className="smbtn" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
      {/* Edit League Modal */}
      {editModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setEditModal(null)}>
          <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: 28, maxWidth: 420, width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: 'var(--hl)', margin: '0 0 16px' }}>Edit League</h3>
            <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12, marginBottom: 12 }} />
            <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12, marginBottom: 12, resize: 'vertical' }} />
            <label style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--mu)', display: 'block', marginBottom: 4 }}>Max Members</label>
            <input type="number" min={2} value={editMaxMembers} onChange={e => setEditMaxMembers(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--bd)', color: 'var(--fg)', fontFamily: 'inherit', fontSize: 12, marginBottom: 12 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
              <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)} />
              <span style={{ fontSize: 11, color: 'var(--fg)' }}>Public league</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="smbtn" onClick={() => setEditModal(null)}>Cancel</button>
              <button className="savebtn" disabled={actionLoading} style={{ padding: '8px 16px', fontSize: 10 }} onClick={handleEdit}>
                {actionLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
          onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: 'var(--sf)', border: '1px solid var(--bd)', padding: 28, maxWidth: 380, width: '90%' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3, color: 'var(--rd)', margin: '0 0 12px' }}>Delete League</h3>
            <div style={{ fontSize: 11, color: 'var(--mu)', marginBottom: 16 }}>
              Permanently delete <strong style={{ color: 'var(--fg)' }}>{deleteConfirm.name}</strong>? This removes the league and all memberships. This cannot be undone.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="smbtn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="savebtn" disabled={actionLoading}
                style={{ padding: '8px 16px', fontSize: 10, background: 'var(--rd)' }}
                onClick={() => handleDelete(deleteConfirm.id)}>
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'report' | 'users' | 'leagues'
  const intervalRef = useRef(null);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const fetchAnalytics = useCallback(async () => {
    try {
      const { data: result, error: rpcErr } = await supabase.rpc('admin_get_analytics');
      if (rpcErr) throw rpcErr;
      setData(result);
      setError('');
      setLastRefresh(new Date());
    } catch (err) {
      logError('admin_get_analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchAnalytics();
    intervalRef.current = setInterval(fetchAnalytics, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [isAdmin, fetchAnalytics]);

  // Fetch daily reports
  const fetchReports = useCallback(async () => {
    try {
      const { data: reps } = await supabase
        .from('ttt_daily_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(30);
      setReports(reps || []);
    } catch (err) {
      logError('fetchReports:', err);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetchReports();
  }, [isAdmin, fetchReports]);

  // Realtime subscriptions for truly live game counts
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel('admin-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ttt_live_games' }, () => {
        fetchAnalytics();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ttt_profiles' }, () => {
        fetchAnalytics();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, fetchAnalytics]);

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>403</div>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Access Denied</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--mu)' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>Loading Analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ color: 'var(--rd)', fontSize: 12 }}>{error}</div>
        <button className="smbtn" style={{ marginTop: 16 }} onClick={fetchAnalytics}>Retry</button>
      </div>
    );
  }

  if (view === 'report' && selectedReport) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <DailyReport report={selectedReport} onBack={() => { setView('dashboard'); setSelectedReport(null); }} />
      </div>
    );
  }

  if (view === 'users') {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <UserManager onBack={() => setView('dashboard')} />
      </div>
    );
  }

  if (view === 'leagues') {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <LeagueManager onBack={() => setView('dashboard')} />
      </div>
    );
  }

  const { accounts, active_users, leagues, lobby, matches, rivals, tournaments, top_players, live_games } = data || {};

  const signupSparkData = (accounts?.signups_by_day || []).map(d => ({
    label: d.day, value: d.signups,
  }));

  const matchesByMode = (matches?.by_mode || []);
  const lobbyByMode = (lobby?.by_mode || []);
  const liveGamesList = (live_games || []);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, letterSpacing: 4, color: 'var(--hl)', margin: 0 }}>
            ADMIN DASHBOARD
          </h2>
          <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--mu)', textTransform: 'uppercase', marginTop: 2 }}>
            Site Owner Analytics
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, color: 'var(--mu)', letterSpacing: 1 }}>
            Auto-refresh: {REFRESH_INTERVAL / 1000}s
          </div>
          {lastRefresh && (
            <div style={{ fontSize: 9, color: 'var(--mu)' }}>
              Last: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
          <button className="smbtn" style={{ marginTop: 4, fontSize: 9 }} onClick={fetchAnalytics}>
            Refresh Now
          </button>
        </div>
      </div>

      {/* Management Quick Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="savebtn" style={{ padding: '8px 18px', fontSize: 10 }} onClick={() => setView('users')}>
          Manage Users
        </button>
        <button className="savebtn" style={{ padding: '8px 18px', fontSize: 10 }} onClick={() => setView('leagues')}>
          Manage Leagues
        </button>
      </div>

      {/* Live Pulse Indicator */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        padding: '8px 14px', background: 'rgba(46,213,115,0.08)', border: '1px solid rgba(46,213,115,0.2)', borderRadius: 4,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--go)',
          animation: 'pulse 2s infinite',
        }} />
        <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--go)' }}>
          Live — {active_users?.last_5min || 0} active now
        </span>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>

      {/* Section: Users */}
      <SectionTitle title="Users" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Accounts" value={accounts?.total} color="var(--hl)" />
        <StatCard label="New (24h)" value={accounts?.last_24h} color="var(--go)" />
        <StatCard label="New (7d)" value={accounts?.last_7d} color="var(--ac)" />
        <StatCard label="New (30d)" value={accounts?.last_30d} color="var(--ac)" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Online (5m)" value={active_users?.last_5min} color="var(--go)" sub="Currently active" />
        <StatCard label="Active (1h)" value={active_users?.last_1h} color="var(--go)" />
        <StatCard label="Active (24h)" value={active_users?.last_24h} color="var(--ac)" />
        <StatCard label="Active (7d)" value={active_users?.last_7d} color="var(--mu)" />
      </div>
      {signupSparkData.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--mu)', marginBottom: 6 }}>
            Signups (30 days)
          </div>
          <SparkBar data={signupSparkData} color="var(--ac)" />
        </div>
      )}

      {/* Section: Live Activity */}
      <SectionTitle title="Live Activity" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="In Lobby" value={lobby?.waiting || 0} color="var(--ac)" sub="Waiting for opponent" />
        <StatCard label="Playing Now" value={lobby?.playing || 0} color="var(--go)" sub="Active games" />
      </div>
      {lobbyByMode.length > 0 && (
        <MiniTable
          title="Lobby by Game Mode"
          columns={['Mode', 'Waiting']}
          rows={lobbyByMode.map(l => [l.game_mode, l.waiting])}
        />
      )}
      {liveGamesList.length > 0 && (
        <MiniTable
          title="All Live Games"
          columns={['Mode', 'Status', 'Count']}
          rows={liveGamesList.map(g => [g.game_mode, g.status, g.count])}
        />
      )}

      {/* Section: Matches */}
      <SectionTitle title="Matches" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total Matches" value={matches?.total} color="var(--hl)" />
        <StatCard label="Last 24h" value={matches?.last_24h} color="var(--go)" />
        <StatCard label="Last 7d" value={matches?.last_7d} color="var(--ac)" />
      </div>
      {matchesByMode.length > 0 && (
        <MiniTable
          title="Matches by Game Mode"
          columns={['Mode', 'Total', 'Last 24h']}
          rows={matchesByMode.map(m => [m.game_mode, m.total, m.last_24h])}
        />
      )}

      {/* Section: Leagues */}
      <SectionTitle title="Leagues" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Active Leagues" value={leagues?.total} color="var(--ac)" />
        <StatCard label="Total Members" value={leagues?.total_members} color="var(--hl)" />
        <StatCard label="New (7d)" value={leagues?.created_last_7d} color="var(--go)" />
      </div>

      {/* Section: Rivals */}
      <SectionTitle title="Rivals" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Active Rivalries" value={rivals?.total_rivalries} color="var(--ac)" />
        <StatCard label="Pending Challenges" value={rivals?.pending_challenges} color="var(--go)" />
        <StatCard label="Active Games" value={rivals?.active_games} color="var(--hl)" />
      </div>

      {/* Section: Tournaments */}
      <SectionTitle title="Tournaments" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total" value={tournaments?.total} color="var(--ac)" />
        <StatCard label="In Progress" value={tournaments?.active} color="var(--go)" />
        <StatCard label="Participants" value={tournaments?.total_participants} color="var(--hl)" />
      </div>

      {/* Section: Top Players */}
      {top_players && top_players.length > 0 && (
        <>
          <SectionTitle title="Top Players by Rating" />
          <MiniTable
            title=""
            columns={['Player', 'Mode', 'Rating', 'Games']}
            rows={top_players.map(p => [p.display_name, p.game_mode, p.elo_rating, p.total_games])}
          />
        </>
      )}

      {/* Section: Daily Reports */}
      <SectionTitle title="Daily Reports" />
      <div style={{ fontSize: 10, color: 'var(--mu)', marginBottom: 12 }}>
        Auto-generated at midnight UTC. Click to view, then Print/Save as PDF.
      </div>
      {reports.length === 0 ? (
        <div style={{ padding: '16px 0', color: 'var(--mu)', fontSize: 11, fontStyle: 'italic' }}>
          No reports yet. First report generates tonight at midnight.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {reports.map(r => (
            <button key={r.id} onClick={() => { setSelectedReport(r); setView('report'); }}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.03)', border: '1px solid var(--bd)',
                padding: '10px 16px', borderRadius: 4, cursor: 'pointer',
                color: 'var(--fg)', fontFamily: 'inherit', fontSize: 11, textAlign: 'left',
              }}>
              <span style={{ letterSpacing: 1 }}>{r.report_date}</span>
              <span style={{ fontSize: 9, color: 'var(--mu)' }}>
                {r.data?.matches?.total_played ?? 0} matches &middot; {r.data?.accounts?.new_signups ?? 0} signups
              </span>
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}

function SectionTitle({ title }) {
  return (
    <div style={{
      fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--ac)',
      fontWeight: 700, borderBottom: '1px solid var(--bd)', paddingBottom: 6,
      marginBottom: 16, marginTop: 28,
    }}>
      {title}
    </div>
  );
}
