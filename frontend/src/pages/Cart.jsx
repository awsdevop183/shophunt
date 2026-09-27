import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../util';

export default function Cart() {
  const nav = useNavigate();
  const [cart, setCart] = useState(null);
  const [err, setErr] = useState('');

  const load = () => api.get('/api/cart').then(setCart).catch(e => { if (e.status === 401) nav('/login'); else setErr(e.message); });
  useEffect(() => { load(); }, []);

  async function setQty(itemId, quantity) {
    try { const d = await api.patch(`/api/cart/items/${itemId}`, { quantity }); setCart(d); }
    catch (e) { setErr(e.message); }
  }
  async function remove(itemId) {
    try { const d = await api.del(`/api/cart/items/${itemId}`); setCart(d); } catch (e) { setErr(e.message); }
  }

  if (!cart) return <div className="container"><p className="muted">Loading…</p></div>;
  return (
    <div className="container">
      <h1>Your cart</h1>
      {err && <p className="error">{err}</p>}
      {!cart.items.length ? <p className="muted">Your cart is empty. <Link to="/">Browse products</Link></p> : (
        <div className="stack">
          {cart.items.map(it => (
            <div className="card row" key={it.id} style={{ justifyContent: 'space-between' }}>
              <div className="row">
                <img src={it.image_url || `https://picsum.photos/seed/sh${it.product_id}/80/80`} width={64} height={64} style={{ borderRadius: 8, objectFit: 'cover' }} />
                <div><div style={{ fontWeight: 600 }}>{it.title}</div><div className="muted">{money(it.price_cents)}</div></div>
              </div>
              <div className="row">
                <input type="number" min="1" value={it.quantity} style={{ width: 70 }}
                  onChange={e => setQty(it.id, Number(e.target.value))} />
                <span className="price">{money(it.price_cents * it.quantity)}</span>
                <button className="btn ghost" onClick={() => remove(it.id)}>Remove</button>
              </div>
            </div>
          ))}
          <div className="card row" style={{ justifyContent: 'space-between' }}>
            <strong>Subtotal</strong>
            <strong className="price">{money(cart.subtotal_cents)}</strong>
          </div>
          <div><button className="btn" onClick={() => nav('/checkout')}>Proceed to checkout</button></div>
        </div>
      )}
    </div>
  );
}
