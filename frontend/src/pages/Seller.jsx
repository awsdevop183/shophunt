import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { money } from '../util';

export default function Seller() {
  const nav = useNavigate();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ title: '', price_cents: '', category: 'general', stock: '', description: '' });

  const load = () => {
    api.get('/api/seller/products').then(d => setProducts(d.products)).catch(e => { if (e.status === 401) nav('/login'); else if (e.status === 403) setErr('Seller access required.'); else setErr(e.message); });
    api.get('/api/seller/sales').then(d => setSales(d.sales)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  async function addProduct(e) {
    e.preventDefault(); setErr('');
    try {
      await api.post('/api/seller/products', { ...form, price_cents: Math.round(Number(form.price_cents) * 100), stock: Number(form.stock) });
      setForm({ title: '', price_cents: '', category: 'general', stock: '', description: '' });
      load();
    } catch (e) { setErr(e.message); }
  }

  return (
    <div className="container">
      <h1>Seller dashboard</h1>
      {err && <p className="error">{err}</p>}
      <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <h2>Your products</h2>
          <table className="card">
            <thead><tr><th>Title</th><th>Price</th><th>Stock</th><th>Rating</th></tr></thead>
            <tbody>
              {products.map(p => <tr key={p.id}><td>{p.title}</td><td>{money(p.price_cents)}</td><td>{p.stock}</td><td>{Number(p.rating_avg).toFixed(1)}</td></tr>)}
            </tbody>
          </table>
          <h2 style={{ marginTop: 20 }}>Sales</h2>
          <table className="card">
            <thead><tr><th>Product</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>
              {sales.map(s => <tr key={s.product_id}><td>{s.title}</td><td>{s.units_sold}</td><td>{money(s.revenue_cents)}</td></tr>)}
              {!sales.length && <tr><td colSpan={3} className="muted">No sales yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <form className="card stack" style={{ width: 320 }} onSubmit={addProduct}>
          <strong>Add a product</strong>
          <div className="field"><label>Title</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="field"><label>Price (USD)</label><input value={form.price_cents} onChange={e => setForm({ ...form, price_cents: e.target.value })} /></div>
          <div className="field"><label>Category</label><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} /></div>
          <div className="field"><label>Stock</label><input value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
          <div className="field"><label>Description</label><textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <button className="btn" type="submit">Add product</button>
        </form>
      </div>
    </div>
  );
}
