import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import { money, stars } from '../util';

export default function Product() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');

  const load = () => api.get(`/api/products/${id}`).then(setData).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  async function addToCart() {
    try { await api.post('/api/cart/items', { product_id: Number(id), quantity: 1 }); setMsg('Added to cart.'); }
    catch (e) { if (e.status === 401) nav('/login'); else setErr(e.message); }
  }
  async function submitReview(e) {
    e.preventDefault();
    try { const d = await api.post(`/api/products/${id}/reviews`, { rating, body }); setData(prev => ({ ...prev, reviews: d.reviews })); setBody(''); setMsg('Review posted.'); }
    catch (e) { if (e.status === 401) nav('/login'); else setErr(e.message); }
  }

  if (err) return <div className="container"><p className="error">{err}</p></div>;
  if (!data) return <div className="container"><p className="muted">Loading…</p></div>;
  const { product, reviews } = data;

  return (
    <div className="container">
      <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <img style={{ width: 380, borderRadius: 12 }} src={product.image_url || `https://picsum.photos/seed/sh${product.id}/600/450`} alt={product.title} />
        <div className="stack" style={{ flex: 1, minWidth: 280 }}>
          <h1 style={{ margin: '0 0 4px' }}>{product.title}</h1>
          <div className="rating">{stars(product.rating_avg)} <span className="muted">({Number(product.rating_avg).toFixed(1)})</span></div>
          <p className="muted">Sold by {product.seller_name} · {product.category}</p>
          <p>{product.description}</p>
          <div className="price" style={{ fontSize: 24 }}>{money(product.price_cents)}</div>
          <div className="muted">{product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</div>
          <div><button className="btn" onClick={addToCart}>Add to cart</button></div>
          {msg && <p className="ok">{msg}</p>}
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>Reviews</h2>
      <div className="stack">
        {reviews.map(r => (
          <div key={r.id} className="card">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{r.author_name}</strong>
              <span className="rating">{stars(r.rating)}</span>
            </div>
            {/* Clean baseline: reviews rendered as plain text. */}
            <div>{r.body}</div>
          </div>
        ))}
        {!reviews.length && <p className="muted">No reviews yet.</p>}
      </div>

      {user && (
        <form className="card stack" style={{ marginTop: 16 }} onSubmit={submitReview}>
          <strong>Write a review</strong>
          <div className="field">
            <label>Rating</label>
            <select value={rating} onChange={e => setRating(Number(e.target.value))}>
              {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Your review</label>
            <textarea rows={3} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div><button className="btn" type="submit">Post review</button></div>
        </form>
      )}
    </div>
  );
}
