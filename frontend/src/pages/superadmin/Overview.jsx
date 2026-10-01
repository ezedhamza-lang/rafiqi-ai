import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { useI18n } from '../../i18n/index.jsx';
import { PointsCard, Spinner } from '../../components/ui/index.js';

/**
 * نظرة عامة — أول ما يراه مدير النظام عند دخول فضاءه:
 * أرقام فورية للمنصة (أولياء، تلاميذ، مدارس، تراخيص، طلبات معلّقة…).
 * بدون مدرسة لحساب مدير النظام ⇒ /admin/stats ترجع أرقام المنصة كلها.
 */
export default function Overview() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [schools, setSchools] = useState([]);
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      api.get('/admin/stats'),
      api.get('/superadmin/schools'),
      api.get('/superadmin/licenses')
    ])
      .then(([st, sc, li]) => {
        setStats(st);
        setSchools(Array.isArray(sc) ? sc : []);
        setLicenses(Array.isArray(li) ? li : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Spinner label={t('superadmin.overview.loading')} />;

  const activeSchools = schools.filter((s) => s.status === 'ACTIVE').length;
  const activeLicenses = licenses.filter((l) => l.status === 'ACTIVE').length;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('superadmin.overview.title')}</h3>
        <button className="btn btn-sm" onClick={load}>
          <span className="material-icons">refresh</span> {t('superadmin.overview.refresh')}
        </button>
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: '0.8rem' }}>
          {t('superadmin.overview.loadError')}: {error}
        </div>
      )}

      {stats && (
        <div className="stats-grid">
          <PointsCard icon="groups" label={t('superadmin.overview.parents')} value={stats.users} color="primary" />
          <PointsCard icon="face" label={t('superadmin.overview.students')} value={stats.students} color="accent" />
          <PointsCard
            icon="account_balance"
            label={t('superadmin.overview.schools')}
            value={schools.length}
            sub={t('superadmin.overview.schoolsActive', { n: activeSchools })}
            color="success"
          />
          <PointsCard
            icon="vpn_key"
            label={t('superadmin.overview.licenses')}
            value={activeLicenses}
            sub={t('superadmin.overview.licensesOf', { n: licenses.length })}
            color="gold"
          />
          <PointsCard
            icon="how_to_reg"
            label={t('superadmin.overview.pendingRegistrations')}
            value={stats.pendingRegs}
            sub={t('superadmin.overview.registrations', { n: stats.registrations })}
            color={stats.pendingRegs > 0 ? 'gold' : 'success'}
          />
          <PointsCard icon="support_agent" label={t('superadmin.overview.helpRequests')} value={stats.helpRequests} color="primary" />
          <PointsCard icon="mail" label={t('superadmin.overview.contactMessages')} value={stats.contactMessages} color="accent" />
        </div>
      )}
    </div>
  );
}
