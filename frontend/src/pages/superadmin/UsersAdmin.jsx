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
        </div>
      </div>

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
