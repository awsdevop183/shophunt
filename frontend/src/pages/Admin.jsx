import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

// Admin panel (hidden from normal nav unless role === admin).
export default function Admin() {
  const nav = useNavigate();
  const [tab, setTab] = useState('tickets');
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [ticket, setTicket] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const loadUsers = () => api.get('/api/admin/users').then(d => setUsers(d.users)).catch(handle);
  const loadTickets = () => api.get('/api/admin/tickets').then(d => setTickets(d.tickets)).catch(handle);
  function handle(e) { if (e.status === 401) nav('/login'); else if (e.status === 403) setErr('Admin access required.'); else setErr(e.message); }

  useEffect(() => { loadTickets(); loadUsers(); }, []);

  async function viewTicket(id) {
    try { const d = await api.get(`/api/admin/tickets/${id}`); setTicket(d.ticket); } catch (e) { handle(e); }
  }
  async function resetLab() {
    setMsg(''); setErr('');
    if (!confirm('Re-seed the database and clear uploads?')) return;
    try { const d = await api.post('/api/admin/reset-lab', {}); setMsg(d.message); loadTickets(); loadUsers(); }
    catch (e) { handle(e); }
  }

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Admin panel</h1>
        <button className="btn ghost" onClick={resetLab}>Reset Lab</button>
      </div>
      {err && <p className="error">{err}</p>}
      {msg && <p className="ok">{msg}</p>}
      <div className="toolbar">
        <button className={`btn ${tab === 'tickets' ? '' : 'secondary'}`} onClick={() => setTab('tickets')}>Tickets</button>
        <button className={`btn ${tab === 'users' ? '' : 'secondary'}`} onClick={() => setTab('users')}>Users</button>
      </div>

      {tab === 'tickets' && (
        <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <table className="card" style={{ flex: 1, minWidth: 300 }}>
            <thead><tr><th>#</th><th>Subject</th><th>From</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}><td>{t.id}</td><td>{t.subject}</td><td>{t.email || `user ${t.user_id}`}</td><td>{t.status}</td>
                  <td><button className="btn ghost" onClick={() => viewTicket(t.id)}>Open</button></td></tr>
              ))}
            </tbody>
          </table>
          {ticket && (
            <div className="card stack" style={{ width: 360 }}>
              <strong>{ticket.subject}</strong>
              <div className="muted">From: {ticket.email || `user ${ticket.user_id}`}</div>
              {/* Clean baseline: ticket body rendered as plain text. */}
              <div>{ticket.body}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <table className="card">
          <thead><tr><th>ID</th><th>Email</th><th>Name</th><th>Role</th><th>Joined</th></tr></thead>
          <tbody>
            {users.map(u => <tr key={u.id}><td>{u.id}</td><td>{u.email}</td><td>{u.name}</td><td>{u.role}</td><td>{new Date(u.created_at).toLocaleDateString()}</td></tr>)}
          </tbody>
        </table>
      )}
    </div>
  );
}
