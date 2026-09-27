import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault(); setErr('');
    try { await login(email, password); nav('/'); }
    catch (e) { setErr(e.message); }
  }
  return (
    <div className="container auth-wrap">
      <div className="card">
        <h1>Sign in</h1>
        <form onSubmit={submit}>
          <div className="field"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          {err && <p className="error">{err}</p>}
          <button className="btn" type="submit" style={{ width: '100%' }}>Sign in</button>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          <Link to="/forgot">Forgot password?</Link> · New here? <Link to="/signup">Create account</Link>
        </p>
      </div>
    </div>
  );
}
