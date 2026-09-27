import { useState } from 'react';
import { api } from '../api';

export default function Forgot() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState('request');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function requestOtp(e) {
    e.preventDefault(); setErr(''); setMsg('');
    try { const d = await api.post('/api/auth/forgot-password', { email }); setMsg(d.message); setStage('reset'); }
    catch (e) { setErr(e.message); }
  }
  async function reset(e) {
    e.preventDefault(); setErr(''); setMsg('');
    try { const d = await api.post('/api/auth/reset-password', { email, otp, password }); setMsg(d.message); setStage('done'); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="container auth-wrap">
      <div className="card">
        <h1>Reset password</h1>
        {stage === 'request' && (
          <form onSubmit={requestOtp}>
            <div className="field"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)} /></div>
            <button className="btn" type="submit" style={{ width: '100%' }}>Send reset code</button>
          </form>
        )}
        {stage === 'reset' && (
          <form onSubmit={reset}>
            <div className="field"><label>Reset code (OTP)</label><input value={otp} onChange={e => setOtp(e.target.value)} /></div>
            <div className="field"><label>New password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
            <button className="btn" type="submit" style={{ width: '100%' }}>Set new password</button>
          </form>
        )}
        {msg && <p className="ok">{msg}</p>}
        {err && <p className="error">{err}</p>}
      </div>
    </div>
  );
}
