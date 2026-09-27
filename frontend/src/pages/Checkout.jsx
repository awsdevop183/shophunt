import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../util';

export default function Checkout() {
  const nav = useNavigate();
  const [cart, setCart] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [couponInfo, setCouponInfo] = useState(null);
  const [ship, setShip] = useState({ ship_name: '', ship_address: '' });
  const [err, setErr] = useState('');

  useEffect(() => { api.get('/api/cart').then(setCart).catch(e => { if (e.status === 401) nav('/login'); else setErr(e.message); }); }, []);

  async function applyCoupon() {
    setErr(''); setCouponInfo(null);
    if (!coupon) return;
    try { const d = await api.get(`/api/coupons/${encodeURIComponent(coupon)}`); setCouponInfo(d.coupon); }
    catch (e) { setErr('Invalid coupon'); }
  }

  const discount = (() => {
    if (!cart || !couponInfo) return 0;
    return couponInfo.kind === 'percent'
      ? Math.floor(cart.subtotal_cents * couponInfo.value / 100)
      : Math.min(cart.subtotal_cents, couponInfo.value);
  })();

  async function placeOrder() {
    setErr('');
    try {
      const d = await api.post('/api/orders/checkout', { coupon_code: couponInfo ? coupon : null, ...ship });
      nav(`/orders`);
    } catch (e) { setErr(e.message); }
  }

  if (!cart) return <div className="container"><p className="muted">Loading…</p></div>;
  if (!cart.items.length) return <div className="container"><p className="muted">Your cart is empty.</p></div>;

  return (
    <div className="container">
      <h1>Checkout</h1>
      {err && <p className="error">{err}</p>}
      <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div className="card stack" style={{ flex: 1, minWidth: 280 }}>
          <strong>Shipping</strong>
          <div className="field"><label>Full name</label><input value={ship.ship_name} onChange={e => setShip({ ...ship, ship_name: e.target.value })} /></div>
          <div className="field"><label>Address</label><input value={ship.ship_address} onChange={e => setShip({ ...ship, ship_address: e.target.value })} /></div>
        </div>
        <div className="card stack" style={{ width: 320 }}>
          <strong>Order summary</strong>
          {cart.items.map(it => (
            <div className="row" key={it.id} style={{ justifyContent: 'space-between' }}>
              <span>{it.title} × {it.quantity}</span><span>{money(it.price_cents * it.quantity)}</span>
            </div>
          ))}
          <div className="row" style={{ gap: 6 }}>
            <input placeholder="Coupon code" value={coupon} onChange={e => setCoupon(e.target.value)} />
            <button className="btn secondary" onClick={applyCoupon}>Apply</button>
          </div>
          {couponInfo && <div className="ok">Coupon “{coupon}” applied (−{money(discount)})</div>}
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Subtotal</span><span>{money(cart.subtotal_cents)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between' }}><span>Discount</span><span>−{money(discount)}</span></div>
          <div className="row" style={{ justifyContent: 'space-between' }}><strong>Total</strong><strong className="price">{money(cart.subtotal_cents - discount)}</strong></div>
          <button className="btn" onClick={placeOrder}>Place order</button>
        </div>
      </div>
    </div>
  );
}
