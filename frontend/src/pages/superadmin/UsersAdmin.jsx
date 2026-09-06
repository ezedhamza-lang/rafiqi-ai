import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { ROLE_LABEL_KEYS } from '../../roles.js';

const ROLE_OPTIONS = [
  { value: 'STUDENT', labelKey: ROLE_LABEL_KEYS.STUDENT },
  { value: 'PARENT', labelKey: ROLE_LABEL_KEYS.PARENT },
  { value: 'TEACHER', labelKey: ROLE_LABEL_KEYS.TEACHER },
  { value: 'SCHOOL_DIRECTOR', labelKey: ROLE_LABEL_KEYS.SCHOOL_DIRECTOR },
  { value: 'ADMIN', labelKey: ROLE_LABEL_KEYS.ADMIN },
  { value: 'SUPER_ADMIN', labelKey: ROLE_LABEL_KEYS.SUPER_ADMIN }
];

export default function UsersAdmin() {
  const { t } = useI18n();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [resetInfo, setResetInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '' });
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback((q, r) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (r) params.set('role', r);
    api
      .get(`/superadmin/users?${params.toString()}`)
      .then(setUsers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query, role), 300);
    return () => clearTimeout(timer);
  }, [query, role, load]);

  const changeRole = async (id, newRole) => {
    await api.put(`/superadmin/users/${id}/role`, { role: newRole });
    load(query, role);
  };

  const resetPassword = async (u) => {
    const custom = window.prompt(
      t('usersAdmin.resetPrompt', { name: `${u.firstName} ${u.lastName}` }),
      ''
    );
    if (custom === null) return;
    try {
      const res = await api.put(`/superadmin/users/${u.id}/password`, custom.trim() ? { password: custom.trim() } : {});
      setResetInfo({ id: u.id, email: res.email, password: res.password });
      setCopied(false);
    } catch (e) {
      window.alert(e.message);
    }
  };

  const copyPassword = async () => {
    if (!resetInfo) return;
    try {
      await navigator.clipboard.writeText(resetInfo.password);
      setCopied(true);
    } catch {
      window.prompt(t('usersAdmin.copyManually'), resetInfo.password);
    }
  };

  const createTeacher = async (e) => {
    e.preventDefault();
    setAddErr('');
    if (!addForm.firstName.trim() || !addForm.lastName.trim() || !addForm.email.trim()) {
      setAddErr(t('usersAdmin.fillRequired'));
      return;
    }
    setAdding(true);
    try {
      const res = await api.post('/superadmin/users', {
        firstName: addForm.firstName.trim(),
        lastName: addForm.lastName.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || undefined,
        role: 'TEACHER',
        password: addForm.password.trim() || undefined
      });
      setResetInfo({ id: res.id, email: res.email, password: res.password, isNew: true });
      setCopied(false);
      setAddForm({ firstName: '', lastName: '', email: '', phone: '', password: '' });
      setShowAdd(false);
      load(query, role);
    } catch (ex) {
      setAddErr(ex.message);
    } finally {
      setAdding(false);
    }
  };

  const roleLabel = (r) => (ROLE_LABEL_KEYS[r] ? t(ROLE_LABEL_KEYS[r]) : r);

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('usersAdmin.title')}</h3>
        <div className="btn-group">
          <input
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('usersAdmin.searchPlaceholder')}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t('usersAdmin.allRoles')}</option>
            {ROLE_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
            ))}
          </select>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setShowAdd((v) => !v); setAddErr(''); }}>
            {t('usersAdmin.addTeacher')}
          </button>
        </div>
      </div>

      {showAdd && (
        <form onSubmit={createTeacher} style={{ background: 'var(--primary-soft, #eef2ff)', padding: '1rem', borderRadius: '12px', display: 'grid', gap: '0.6rem', marginBottom: '1rem' }}>
          <h4 style={{ margin: 0 }}>{t('usersAdmin.addTeacherTitle')}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
            <div className="form-group">
              <label>{t('usersAdmin.firstName')} *</label>
              <input type="text" value={addForm.firstName} onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('usersAdmin.lastName')} *</label>
              <input type="text" value={addForm.lastName} onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('usersAdmin.emailColumn')} *</label>
              <input type="email" dir="ltr" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>{t('usersAdmin.phone')}</label>
              <input type="text" dir="ltr" value={addForm.phone} onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>{t('usersAdmin.passwordOptional')}</label>
              <input type="text" dir="ltr" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder="••••••" />
            </div>
          </div>
          {addErr && <p className="form-error">{addErr}</p>}
          <div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
              {adding ? '...' : t('usersAdmin.create')}
            </button>
          </div>
        </form>
      )}

      {resetInfo && resetInfo.isNew && (
        <div className="reset-result" style={{ background: '#e7f6ec', border: '1px solid #bfe7d2', borderRadius: '10px', padding: '0.8rem', marginBottom: '1rem' }}>
          <div><strong>{t('usersAdmin.accountCreated')}</strong> {resetInfo.email}</div>
          <div><strong>{t('usersAdmin.newPassword')}:</strong> <code dir="ltr">{resetInfo.password}</code></div>
          <button type="button" className="btn btn-sm" onClick={copyPassword} style={{ marginTop: '0.4rem' }}>
            {copied ? t('usersAdmin.copied') : t('usersAdmin.copy')}
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('usersAdmin.nameColumn')}</th>
              <th>{t('usersAdmin.emailColumn')}</th>
              <th>{t('usersAdmin.roleColumn')}</th>
              <th>{t('usersAdmin.classColumn')}</th>
              <th>{t('usersAdmin.subscriptionColumn')}</th>
              <th>{t('usersAdmin.changeRoleColumn')}</th>
              <th>{t('usersAdmin.passwordColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.firstName} {u.lastName}</td>
                <td>{u.email}</td>
                <td>
                  <span className="badge">{roleLabel(u.role)}</span>
                </td>
                <td>{u.studentAccount?.class?.name || '—'}</td>
                <td>
                  {u.subscriptions?.length > 0 ? (
                    <span className={`badge ${u.subscriptions[0].status === 'ACTIVE' ? 'good' : 'bad'}`}>
                      {u.subscriptions[0].status}
                    </span>
                  ) : (
                    <span className="badge">{t('usersAdmin.none')}</span>
                  )}
                </td>
                <td>
                  <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value)}>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{t(r.labelKey)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <button type="button" className="btn btn-sm" onClick={() => resetPassword(u)}>
                    {t('usersAdmin.resetPassword')}
                  </button>
                  {resetInfo && resetInfo.id === u.id && (
                    <div className="reset-result" style={{ marginTop: '0.4rem', fontSize: '0.85rem' }}>
                      <div><strong>{t('usersAdmin.newPassword')}:</strong> <code dir="ltr">{resetInfo.password}</code></div>
                      <button type="button" className="btn btn-sm" onClick={copyPassword} style={{ marginTop: '0.25rem' }}>
                        {copied ? t('usersAdmin.copied') : t('usersAdmin.copy')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
