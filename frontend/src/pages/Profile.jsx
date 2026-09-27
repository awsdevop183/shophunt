import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';

export default function Profile() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ name: '', bio: '', phone: '' });
  const [email, setEmail] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/api/users/me').then(({ user }) => {
      setMe(user); setForm({ name: user.name || '', bio: user.bio || '', phone: user.phone || '' }); setEmail(user.email || '');
    }).catch(e => { if (e.status === 401) nav('/login'); else setErr(e.message); });
  }, []);

  async function saveProfile(e) {
    e.preventDefault(); setMsg(''); setErr('');
    try { const { user } = await api.patch('/api/users/me', form); setMe(user); setMsg('Profile saved.'); refresh(); }
    catch (e) { setErr(e.message); }
  }
  async function changeEmail(e) {
    e.preventDefault(); setMsg(''); setErr('');
    try { await api.post('/api/users/me/email', { email }); setMsg('Email updated.'); refresh(); }
    catch (e) { setErr(e.message); }
  }
  async function uploadAvatar(e) {
    const file = e.target.files[0]; if (!file) return;
    setMsg(''); setErr('');
    const fd = new FormData(); fd.append('file', file);
    try { const d = await api.upload('/api/uploads/avatar', fd); setMe({ ...me, avatar_url: d.avatar_url }); setMsg('Avatar uploaded.'); }
    catch (e) { setErr(e.message); }
  }
  const [importResult, setImportResult] = useState(null);
  async function importAvatar(e) {
    e.preventDefault(); setMsg(''); setErr(''); setImportResult(null);
    try { const d = await api.post('/api/uploads/avatar/import', { url: importUrl }); setMe({ ...me, avatar_url: d.avatar_url }); setMsg('Avatar imported.'); }
    catch (e) {
      setErr(e.message);
      // Non-image responses come back with a body preview (SSRF result).
      if (e.data && (e.data.preview || e.data.content_type)) setImportResult(e.data);
    }
  }

  if (!me) return <div className="container"><p className="muted">Loading…</p></div>;
  const avatarSrc = me.avatar_url ? (me.avatar_url.startsWith('http') ? me.avatar_url : `${api.base}${me.avatar_url}`) : `https://picsum.photos/seed/u${me.id}/120/120`;

  return (
    <div className="container">
      <h1>Your profile</h1>
      {msg && <p className="ok">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div className="card stack" style={{ width: 280, alignItems: 'center' }}>
          <img src={avatarSrc} width={120} height={120} style={{ borderRadius: '50%', objectFit: 'cover' }} />
          <div className="field" style={{ width: '100%' }}>
            <label>Upload avatar</label>
            <input type="file" accept="image/*" onChange={uploadAvatar} />
          </div>
          <form onSubmit={importAvatar} style={{ width: '100%' }}>
            <div className="field">
              <label>Import avatar from URL</label>
              <input placeholder="https://example.com/me.png" value={importUrl} onChange={e => setImportUrl(e.target.value)} />
            </div>
            <button className="btn secondary" type="submit" style={{ width: '100%' }}>Import</button>
          </form>
          {importResult && (
            <div className="card" style={{ width: '100%', background: '#f7f7fb' }}>
              <div className="muted" style={{ fontSize: 12 }}>Fetch response ({importResult.content_type || 'unknown'}):</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, margin: 0, maxHeight: 220, overflow: 'auto' }}>{importResult.preview}</pre>
            </div>
          )}
          <span className="badge">{me.role}</span>
        </div>

        <form className="card stack" style={{ flex: 1, minWidth: 280 }} onSubmit={saveProfile}>
          <strong>Account details</strong>
          <div className="field"><label>Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Bio</label><textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} /></div>
          <div className="field"><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          <div><button className="btn" type="submit">Save profile</button></div>
        </form>
      </div>

      <form className="card stack" style={{ marginTop: 16, maxWidth: 420 }} onSubmit={changeEmail}>
        <strong>Change email</strong>
        <div className="field"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><button className="btn" type="submit">Update email</button></div>
      </form>
    </div>
  );
}
