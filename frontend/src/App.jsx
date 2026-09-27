import { useState } from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Catalog from './pages/Catalog.jsx';
import Product from './pages/Product.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Orders from './pages/Orders.jsx';
import Profile from './pages/Profile.jsx';
import Seller from './pages/Seller.jsx';
import Support from './pages/Support.jsx';
import Admin from './pages/Admin.jsx';
import Forgot from './pages/Forgot.jsx';

function SafetyBanner() {
  const [open, setOpen] = useState(sessionStorage.getItem('sh_banner_dismissed') !== '1');
  if (!open) return null;
  return (
    <div className="safety-banner">
      <span>⚠️ INTENTIONALLY VULNERABLE — isolated lab use only. Never expose on the public internet or run on a production server.</span>
      <button onClick={() => { sessionStorage.setItem('sh_banner_dismissed', '1'); setOpen(false); }}>Dismiss</button>
    </div>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  return (
    <div className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">Shop<span>Hunt</span></Link>
        <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/?search=${encodeURIComponent(q)}`); }}>
          <input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="spacer" />
        <Link to="/cart">Cart</Link>
        {user && <Link to="/orders">Orders</Link>}
        {user && (user.role === 'seller' || user.role === 'admin') && <Link to="/seller">Seller</Link>}
        {user && user.role === 'admin' && <Link to="/admin">Admin</Link>}
        <Link to="/support">Support</Link>
        {user ? (
          <>
            <Link to="/profile">{user.name}</Link>
            <button className="btn ghost" onClick={() => { logout(); nav('/'); }}>Logout</button>
          </>
        ) : (
          <Link to="/login">Sign in</Link>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <SafetyBanner />
      <Nav />
      <Routes>
        <Route path="/" element={<Catalog />} />
        <Route path="/product/:id" element={<Product />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot" element={<Forgot />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/seller" element={<Seller />} />
        <Route path="/support" element={<Support />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <footer className="site">ShopHunt — a training target by Madhukar Reddy (@awsandevops)</footer>
    </>
  );
}
