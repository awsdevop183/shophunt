import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../util';

export default function Orders() {
  const nav = useNavigate();
  const [orders, setOrders] = useState([]);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);

  useEffect(() => {
    api.get('/api/orders').then(d => setOrders(d.orders)).catch(e => { if (e.status === 401) nav('/login'); else setErr(e.message); });
  }, []);

  async function view(id) {
    try { const d = await api.get(`/api/orders/${id}`); setOpen(d); } catch (e) { setErr(e.message); }
  }

  return (
    <div className="container">
      <h1>Order history</h1>
      {err && <p className="error">{err}</p>}
      {!orders.length ? <p className="muted">No orders yet.</p> : (
        <table className="card">
          <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td>#{o.id}</td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td><span className="badge">{o.status}</span></td>
                <td>{money(o.total_cents)}</td>
                <td><button className="btn ghost" onClick={() => view(o.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open && (
        <div className="card stack" style={{ marginTop: 16 }}>
          <strong>Order #{open.order.id}</strong>
          {open.items.map(it => (
            <div className="row" key={it.id} style={{ justifyContent: 'space-between' }}>
              <span>{it.title} × {it.quantity}</span><span>{money(it.unit_price_cents * it.quantity)}</span>
            </div>
          ))}
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>Total</strong><strong>{money(open.order.total_cents)}</strong></div>
          {open.order.ship_address && <div className="muted">Ship to: {open.order.ship_name}, {open.order.ship_address}</div>}
        </div>
      )}
    </div>
  );
}
