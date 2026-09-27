import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Support() {
  const { user } = useAuth();
  const [form, setForm] = useState({ subject: '', body: '', email: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setMsg(''); setErr('');
    try { const d = await api.post('/api/tickets', form); setMsg(d.message); setForm({ subject: '', body: '', email: '' }); }
    catch (e) { setErr(e.message); }
  }
  return (
    <div className="container auth-wrap">
      <div className="card">
        <h1>Contact support</h1>
        <p className="muted">Have a question about an order or product? Send us a ticket.</p>
        <form onSubmit={submit}>
          {!user && <div className="field"><label>Your email</label><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>}
          <div className="field"><label>Subject</label><input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
          <div className="field"><label>Message</label><textarea rows={5} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
          {msg && <p className="ok">{msg}</p>}
          {err && <p className="error">{err}</p>}
          <button className="btn" type="submit" style={{ width: '100%' }}>Submit ticket</button>
        </form>
      </div>
    </div>
  );
}
