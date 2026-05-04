import { useState, useEffect, useCallback } from 'react';
import { ordersApi } from '../api/client';

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function OrdersPage() {
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);
  const [filter,  setFilter]  = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ordersApi.list();
      setOrders(res.items || []);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (order, status) => {
    try {
      await ordersApi.update(order.id, status);
      showToast(`Order status → ${status}`);
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const deleteOrder = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      await ordersApi.delete(id);
      showToast('Order cancelled');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const filtered = filter ? orders.filter(o => o.status === filter) : orders;

  return (
    <div>
      <div className="page-header">
        <h1>📋 Orders</h1>
        <span className="count">{filtered.length}</span>
      </div>

      <div className="toolbar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-sm" onClick={load}>↻ Refresh</button>
        <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12 }}>
          Create orders via the API — POST /api/orders
        </span>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Loading from DynamoDB…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <span className="emoji">🛒</span>
          <h3>No orders yet</h3>
          <p>Orders placed via the API will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(o => (
            <div key={o.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div className="card-title">Order #{o.id.slice(0, 8).toUpperCase()}</div>
                  <div className="card-meta">User: {o.userId} · {new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span className={`status status-${o.status}`}>{o.status}</span>
                  <span className="price">${Number(o.total || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Line items */}
              {o.items?.length > 0 && (
                <div style={{ margin: '12px 0', padding: '12px', background: 'var(--bg)', borderRadius: 8 }}>
                  {o.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                      <span>{item.name} × {item.quantity}</span>
                      <span style={{ color: 'var(--muted)' }}>${(item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="card-actions" style={{ flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>Update:</span>
                {STATUSES.filter(s => s !== o.status).map(s => (
                  <button key={s} className="btn-sm" style={{ fontSize: 11 }} onClick={() => updateStatus(o, s)}>
                    → {s}
                  </button>
                ))}
                <button className="btn-danger" style={{ marginLeft: 'auto' }} onClick={() => deleteOrder(o.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="toast-container">
        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  );
}
