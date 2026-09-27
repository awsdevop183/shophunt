import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault(); setErr('');
    try { await signup(form.email, form.password, form.name); nav('/'); }
    catch (e) { setErr(e.message); }
  }
  return (
    <div className="container auth-wrap">
      <div className="card">
        <h1>Create account</h1>
        <form onSubmit={submit}>
          <div className="field"><label>Name</label><input value={form.name} onChange={set('name')} /></div>
          <div className="field"><label>Email</label><input value={form.email} onChange={set('email')} /></div>
          <div className="field"><label>Password</label><input type="password" value={form.password} onChange={set('password')} /></div>
          {err && <p className="error">{err}</p>}
          <button className="btn" type="submit" style={{ width: '100%' }}>Sign up</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
