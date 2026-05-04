import { useState, useEffect, useCallback } from 'react';
import { productsApi } from '../api/client';

const CATEGORIES = ['general', 'electronics', 'clothing', 'food', 'books', 'sports'];

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState(product || { name: '', description: '', price: '', category: 'general', stock: 0 });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      if (product?.id) await productsApi.update(product.id, form);
      else             await productsApi.create(form);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{product?.id ? 'Edit Product' : 'Add Product'}</h2>
        <div className="form-group">
          <label>Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Product name" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label>Price ($) *</label>
            <input type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
          </div>
          <div className="form-group">
            <label>Stock</label>
            <input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products,  setProducts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [modal,     setModal]     = useState(null); // null | 'create' | product object
  const [toast,     setToast]     = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsApi.list(catFilter);
      setProducts(res.items || []);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [catFilter]);

  useEffect(() => { load(); }, [load]);

  const deleteProduct = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productsApi.delete(id);
      showToast('Product deleted');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const filtered = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>🛍️ Products</h1>
        <span className="count">{filtered.length}</span>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal('create')}>
          + Add Product
        </button>
      </div>

      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Loading from DynamoDB…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <span className="emoji">📦</span>
          <h3>No products yet</h3>
          <p>Click "Add Product" to create your first one</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map(p => (
            <div key={p.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="card-title">{p.name}</div>
                  <div className="card-meta">{p.description || 'No description'}</div>
                </div>
                <span className="tag tag-blue">{p.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
                <span className="price">${Number(p.price).toFixed(2)}</span>
                <span className={`tag ${p.stock > 0 ? 'tag-green' : 'tag-red'}`}>
                  {p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
                </span>
              </div>
              <div className="card-meta" style={{ fontSize: 11 }}>ID: {p.id.slice(0, 8)}…</div>
              <div className="card-actions">
                <button className="btn-sm" onClick={() => setModal(p)}>Edit</button>
                <button className="btn-danger" onClick={() => deleteProduct(p.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ProductModal
          product={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); showToast('Product saved ✓'); load(); }}
        />
      )}

      <div className="toast-container">
        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  );
}
