import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { REQUEST_STATUS_LABEL_KEYS, statusBadgeClass, isParent, getHomePath } from '../roles.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../i18n/index.jsx';
import { Button, Card, Badge, EmptyState, PointsCard, Spinner } from '../components/ui/index.js';

export default function Dashboard() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [helpRequests, setHelpRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // هذه الصفحة لوحة الولي حصراً — لا نطلب شيئاً لبقية الأدوار
    if (user && !isParent(user)) { setLoading(false); return; }
    Promise.all([api.get('/students'), api.get('/subscription-requests/mine'), api.get('/help-requests/mine')])
      .then(([s, r, h]) => {
        setStudents(s);
        setRequests(r);
        setHelpRequests(h);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  // بقية الأدوار تُحوَّل لفضائها الرئيسي
  if (user && !isParent(user)) {
    return <Navigate to={getHomePath(user)} replace />;
  }

  if (loading) {
    return <Spinner label={t('dashboard.loading')} />;
  }

  const pending = requests.filter((r) => r.status === 'PENDING_APPROVAL').length;

  return (
    <>
      <h2>{t('dashboard.title')}</h2>
      <div className="stats-grid">
        <PointsCard icon="groups" label={t('dashboard.myChildren')} value={students.length} color="primary" />
        <PointsCard icon="how_to_reg" label={t('dashboard.registrationRequests')} value={requests.length} color="accent" />
        <PointsCard icon="hourglass_top" label={t('dashboard.pendingApproval')} value={pending} color="gold" />
        <PointsCard icon="support_agent" label={t('dashboard.helpRequests')} value={helpRequests.length} color="success" />
      </div>

      <Card title={t('dashboard.myChildren')} icon="groups">
        {students.length === 0 ? (
          <EmptyState
            icon="groups"
            title={t('dashboard.emptyChildren')}
            action={
              <Link to="/registration">
                <Button size="sm" variant="accent" icon="person_add">{t('dashboard.requestStudent')}</Button>
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('dashboard.firstName')}</th>
                  <th>{t('dashboard.lastName')}</th>
                  <th>{t('dashboard.level')}</th>
                  <th>{t('dashboard.schoolYear')}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>{s.firstName}</td>
                    <td>{s.lastName}</td>
                    <td>{s.level}</td>
                    <td>{s.schoolYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ marginTop: '1.5rem' }}>
        <Card title={t('dashboard.latestRequests')} icon="how_to_reg">
          {requests.length === 0 ? (
            <EmptyState
              icon="how_to_reg"
              title={t('dashboard.emptyRequests')}
              action={
                <Link to="/registration">
                  <Button size="sm" variant="accent" icon="person_add">{t('dashboard.registerNow')}</Button>
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('dashboard.student')}</th>
                    <th>{t('dashboard.level')}</th>
                    <th>{t('dashboard.year')}</th>
                    <th>{t('dashboard.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td>{r.firstName} {r.lastName}</td>
                      <td>{r.level}</td>
                      <td>{r.schoolYear}</td>
                      <td>
                        <Badge variant={statusBadgeClass(r.status) === 'rejected' ? 'danger' : statusBadgeClass(r.status) === 'approved' ? 'success' : statusBadgeClass(r.status) === 'warn' ? 'warning' : 'info'}>
                          {REQUEST_STATUS_LABEL_KEYS[r.status] ? t(REQUEST_STATUS_LABEL_KEYS[r.status]) : r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
