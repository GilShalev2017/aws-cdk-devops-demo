import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../api/client';

function UserModal({ user, onClose, onSave }) {
  const [form, setForm] = useState(user || { name: '', email: '', role: 'customer' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email) return;
    setSaving(true);
    try {
      if (user?.id) await usersApi.update(user.id, form);
      else          await usersApi.create(form);
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{user?.id ? 'Edit User' : 'Add User'}</h2>
        <div className="form-group">
          <label>Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Full name" />
        </div>
        <div className="form-group">
          <label>Email *</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="email@example.com" disabled={!!user?.id} />
        </div>
        <div className="form-group">
          <label>Role</label>
          <select value={form.role} onChange={e => set('role', e.target.value)}>
            <option value="customer">customer</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="modal-footer">
          <button className="btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save User'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [modal,   setModal]   = useState(null);
  const [toast,   setToast]   = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await usersApi.list();
      setUsers(res.items || []);
    } catch (e) { showToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await usersApi.delete(id);
      showToast('User deleted');
      load();
    } catch (e) { showToast(e.message, 'error'); }
  };

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>👥 Users</h1>
        <span className="count">{filtered.length}</span>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={() => setModal('create')}>
          + Add User
        </button>
      </div>

      <div className="toolbar">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" />
        <button className="btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /><p>Loading from DynamoDB…</p></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <span className="emoji">🙈</span>
          <h3>No users found</h3>
          <p>Add your first user to get started</p>
        </div>
      ) : (
        <div className="grid">
          {filtered.map(u => (
            <div key={u.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="card-title">{u.name}</div>
                  <div className="card-meta">{u.email}</div>
                </div>
                <span className={`tag ${u.role === 'admin' ? 'tag-red' : 'tag-blue'}`}>{u.role}</span>
              </div>
              <div className="card-meta" style={{ fontSize: 11, marginTop: 8 }}>
                Joined {new Date(u.createdAt).toLocaleDateString()}
              </div>
              <div className="card-actions">
                <button className="btn-sm" onClick={() => setModal(u)}>Edit</button>
                <button className="btn-danger" onClick={() => deleteUser(u.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); showToast('User saved ✓'); load(); }}
        />
      )}

      <div className="toast-container">
        {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
      </div>
    </div>
  );
}
