import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { money, stars } from '../util';

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [err, setErr] = useState('');
  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || '';

  useEffect(() => { api.get('/api/products/categories').then(d => setCategories(d.categories)).catch(() => {}); }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (category) qs.set('category', category);
    if (sort) qs.set('sort', sort);
    setErr('');
    api.get(`/api/products?${qs.toString()}`)
      .then(d => setProducts(d.products))
      .catch(e => setErr(e.message));
  }, [search, category, sort]);

  const setParam = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p); };

  return (
    <div className="container">
      <div className="toolbar">
        <select value={category} onChange={e => setParam('category', e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={e => setParam('sort', e.target.value)}>
          <option value="">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="rating">Top rated</option>
        </select>
        {search && <span className="badge">Results for “{search}”</span>}
      </div>
      {err && <p className="error">{err}</p>}
      <div className="grid">
        {products.map(p => (
          <Link to={`/product/${p.id}`} key={p.id} className="card product-card stack">
            <img src={p.image_url || `https://picsum.photos/seed/sh${p.id}/400/300`} alt={p.title} />
            <div style={{ fontWeight: 600 }}>{p.title}</div>
            <div className="rating">{stars(p.rating_avg)} <span className="muted">({Number(p.rating_avg).toFixed(1)})</span></div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="price">{money(p.price_cents)}</span>
              <span className="badge">{p.category}</span>
            </div>
          </Link>
        ))}
      </div>
      {!products.length && !err && <p className="muted">No products found.</p>}
    </div>
  );
}
