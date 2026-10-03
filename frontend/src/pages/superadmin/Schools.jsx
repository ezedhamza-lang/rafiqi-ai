import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { statusLabel } from '../../utils/labels.js';

const L = {
  ar: {
    title: 'المدارس',
    code: 'الرمز',
    name: 'الاسم',
    address: 'العنوان',
    phone: 'الهاتف',
    email: 'البريد',
    users: 'المستخدمون',
    classes: 'الأقسام',
    status: 'الحالة',
    actions: 'إجراءات',
    create: 'إضافة مدرسة',
    suspend: 'تعطيل',
    activate: 'تفعيل',
    del: 'حذف',
    none: 'لا توجد مدارس بعد',
    confirmDel: 'حذف هذه المدرسة؟'
  },
  en: {
    title: 'Schools',
    code: 'Code',
    name: 'Name',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    users: 'Users',
    classes: 'Classes',
    status: 'Status',
    actions: 'Actions',
    create: 'Add school',
    suspend: 'Suspend',
    activate: 'Activate',
    del: 'Delete',
    none: 'No schools yet',
    confirmDel: 'Delete this school?'
  }
};

export default function Schools() {
  const { lang } = useI18n();
  const t = L[lang] || L.ar;
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({ code: '', name: '', address: '', phone: '', email: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/superadmin/schools').then(setSchools).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/superadmin/schools', form);
      setForm({ code: '', name: '', address: '', phone: '', email: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.patch(`/superadmin/schools/${id}`, { status });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm(t.confirmDel)) return;
    try {
      await api.del(`/superadmin/schools/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t.title}</h3>
      </div>
      {error && <div className="form-error">{error}</div>}

      <form className="card-form" onSubmit={create}>
        <div className="form-row">
          <div className="form-group">
            <label>{t.code}</label>
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="form-group grow">
            <label>{t.name}</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <button className="btn btn-primary" type="submit">{t.create}</button>
        </div>
      </form>

      {schools.length === 0 ? (
        <div className="empty">{t.none}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t.code}</th>
                <th>{t.name}</th>
                <th>{t.users}</th>
                <th>{t.classes}</th>
                <th>{t.status}</th>
                <th>{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id}>
                  <td><code>{s.code}</code></td>
                  <td>{s.name}</td>
                  <td>{s._count?.users ?? 0}</td>
                  <td>{s._count?.classes ?? 0}</td>
                  <td>
                    <span className={`badge ${s.status === 'ACTIVE' ? 'good' : 'bad'}`}>{statusLabel(s.status, lang)}</span>
                  </td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => setStatus(s.id, s.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE')}>
                      {s.status === 'ACTIVE' ? t.suspend : t.activate}
                    </button>{' '}
                    {s.code !== 'DEFAULT' && (
                      <button className="btn btn-sm btn-danger" onClick={() => remove(s.id)}>{t.del}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
