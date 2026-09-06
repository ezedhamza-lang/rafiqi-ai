import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { ACCOUNT_STATUS_LABEL_KEYS, statusBadgeClass, canManageFinance } from '../../roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { Navigate } from 'react-router-dom';

export default function AdminSubscriptions() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [payForm, setPayForm] = useState(null);
  const [amount, setAmount] = useState('');
  const [method] = useState('OFFLINE');

  const [dcForm, setDcForm] = useState(null);
  const [dc, setDc] = useState({ code: '', type: 'PERCENTAGE', value: '', usageLimit: '', expiresAt: '', description: '' });

  const load = useCallback(() => {
    api
      .get('/admin/subscriptions')
      .then(setData)
      .catch((e) => setErr(e.message));
    api.get('/payments/admin/invoices').then(setInvoices).catch(() => {});
    api.get('/payments/admin/discounts').then(setDiscounts).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (user && !canManageFinance(user)) {
    return <Navigate to="/director" replace />;
  }

  const pay = async (sub) => {
    try {
      await api.post(`/admin/subscriptions/${sub.id}/pay`, {
        amount: amount ? Number(amount) : undefined,
        method
      });
      setPayForm(null);
      setAmount('');
      setMsg(t('adminSubscriptions.payRecorded', { name: `${sub.user.firstName} ${sub.user.lastName}` }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const suspend = async (sub) => {
    if (!window.confirm(t('adminSubscriptions.suspendConfirm', { name: `${sub.user.firstName} ${sub.user.lastName}` }))) return;
    try {
      await api.post(`/admin/subscriptions/${sub.id}/suspend`);
      setMsg(t('adminSubscriptions.suspendedMsg'));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const reactivate = async (sub) => {
    try {
      await api.post(`/admin/subscriptions/${sub.id}/reactivate`);
      setMsg(t('adminSubscriptions.reactivateMsg', { name: `${sub.user.firstName} ${sub.user.lastName}` }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const renew = async (sub) => {
    try {
      await api.post(`/admin/subscriptions/${sub.id}/renew`);
      setMsg(t('adminSubscriptions.renewMsg', { name: `${sub.user.firstName} ${sub.user.lastName}` }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const remind = async (sub) => {
    try {
      await api.post(`/admin/subscriptions/${sub.id}/remind`);
      setMsg(t('adminSubscriptions.remindMsg', { name: `${sub.user.firstName} ${sub.user.lastName}` }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const runRenewalSweep = async () => {
    try {
      const r = await api.post('/payments/admin/jobs/run-renewal', {});
      setMsg(t('adminSubscriptions.sweepMsg', { n: r.created }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const createDiscount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/payments/admin/discounts', {
        code: dc.code,
        type: dc.type,
        value: Number(dc.value),
        usageLimit: dc.usageLimit ? Number(dc.usageLimit) : undefined,
        expiresAt: dc.expiresAt || undefined,
        description: dc.description || undefined
      });
      setDcForm(null);
      setDc({ code: '', type: 'PERCENTAGE', value: '', usageLimit: '', expiresAt: '', description: '' });
      setMsg(t('adminSubscriptions.discountCreated'));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const deactivateDiscount = async (d) => {
    if (!window.confirm(t('adminSubscriptions.deactivateConfirm', { code: d.code }))) return;
    try {
      await api.post(`/payments/admin/discounts/${d.id}/deactivate`, {});
      setMsg(t('adminSubscriptions.deactivatedMsg', { code: d.code }));
      load();
    } catch (e) {
      setErr(e.message);
    }
  };

  const downloadInvoice = async (inv) => {
    try {
      await api.download(`/payments/invoices/${inv.id}/pdf`, `${inv.invoiceNumber || 'invoice'}.pdf`);
    } catch (e) {
      setErr(e.message);
    }
  };

  if (!data) {
    return (
      <div className="loading-wrap">
        <span className="spinner" />
      </div>
    );
  }

  const s = data.summary;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('adminSubscriptions.title')}</h3>
        <p className="muted">{t('adminSubscriptions.subtitle')}</p>
      </div>

      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}
      {err && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{err}</div>}

      <div className="stat-grid" style={{ marginBottom: '1.4rem' }}>
        <div className="card-item stat-card">
          <span className="material-icons">verified_user</span>
          <div className="stat-value">{s.activeCount}</div>
          <div className="stat-label">{t('adminSubscriptions.activeCount')}</div>
        </div>
        <div className="card-item stat-card">
          <span className="material-icons">hourglass_top</span>
          <div className="stat-value">{s.pendingCount}</div>
          <div className="stat-label">{t('adminSubscriptions.pendingCount')}</div>
        </div>
        <div className="card-item stat-card">
          <span className="material-icons">block</span>
          <div className="stat-value">{s.suspendedCount}</div>
          <div className="stat-label">{t('adminSubscriptions.suspendedCount')}</div>
        </div>
        <div className="card-item stat-card">
          <span className="material-icons">schedule</span>
          <div className="stat-value">{s.expiredCount}</div>
          <div className="stat-label">{t('adminSubscriptions.expiredCount')}</div>
        </div>
        <div className="card-item stat-card">
          <span className="material-icons">payments</span>
          <div className="stat-value">{t('paymentCenter.currency', { n: s.totalRevenue })}</div>
          <div className="stat-label">{t('adminSubscriptions.totalRevenue')}</div>
        </div>
        <div className="card-item stat-card">
          <span className="material-icons">account_balance_wallet</span>
          <div className="stat-value">{t('paymentCenter.currency', { n: s.monthRevenue })}</div>
          <div className="stat-label">{t('adminSubscriptions.monthRevenue')}</div>
        </div>
      </div>

      {(data.revenueByMonth?.length > 0 || s.expiringSoonCount > 0) && (
        <div className="sub-grid" style={{ marginBottom: '1.4rem' }}>
          {data.revenueByMonth?.length > 0 && (
            <div className="card-item">
              <h4>{t('adminSubscriptions.monthlyRevenue')}</h4>
              <div className="trend-bars" style={{ height: '120px' }}>
                {data.revenueByMonth.map((r) => (
                  <div key={r.month} className="trend-col" title={`${r.month}: ${t('paymentCenter.currency', { n: r.amount })}`}>
                    <div className="trend-bar" style={{ height: `${(r.amount / Math.max(1, ...data.revenueByMonth.map((x) => x.amount))) * 100}%` }} />
                    <span className="trend-label">{r.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {s.expiringSoonCount > 0 && (
            <div className="card-item">
              <h4>{t('adminSubscriptions.expiringAlert', { n: s.expiringSoonCount })}</h4>
              <p className="muted">{t('adminSubscriptions.expiringSubtitle')}</p>
              <div className="alert-list">
                {data.expiringSoon.slice(0, 5).map((sub) => (
                  <li key={sub.id}>
                    {sub.user.firstName} {sub.user.lastName} — {t('adminSubscriptions.expiresIn', { date: new Date(sub.endDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB') })}
                    <button className="btn btn-sm" style={{ marginInlineStart: '0.4rem' }} onClick={() => remind(sub)}>
                      {t('adminSubscriptions.remind')}
                    </button>
                  </li>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <h4 style={{ marginBottom: '0.7rem' }}>{t('adminSubscriptions.subscriptionsTitle')}</h4>
      {data.subscriptions.length === 0 ? (
        <div className="empty">{t('adminSubscriptions.noSubscriptions')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('adminSubscriptions.userColumn')}</th>
                <th>{t('adminSubscriptions.planColumn')}</th>
                <th>{t('adminSubscriptions.schoolYearColumn')}</th>
                <th>{t('adminSubscriptions.durationColumn')}</th>
                <th>{t('adminSubscriptions.amountColumn')}</th>
                <th>{t('adminSubscriptions.statusColumn')}</th>
                <th>{t('adminSubscriptions.renewalColumn')}</th>
                <th>{t('adminSubscriptions.paymentsColumn')}</th>
                <th>{t('adminSubscriptions.actionsColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {data.subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.user.firstName} {sub.user.lastName} ({sub.user.email})</td>
                  <td>{sub.plan}</td>
                  <td>{sub.schoolYear}</td>
                  <td>
                    {new Date(sub.startDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')} ←{' '}
                    {new Date(sub.endDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}
                  </td>
                  <td>{sub.amount != null ? t('paymentCenter.currency', { n: sub.amount }) : '—'}</td>
                  <td>
                    <span className={`badge badge-${statusBadgeClass(sub.status)}`}>
                      {ACCOUNT_STATUS_LABEL_KEYS[sub.status] ? t(ACCOUNT_STATUS_LABEL_KEYS[sub.status]) : sub.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${sub.renewalEnabled ? 'approved' : 'warn'}`}>
                      {sub.renewalEnabled ? t('adminSubscriptions.renewalAuto') : t('adminSubscriptions.renewalCancelled')}
                    </span>
                  </td>
                  <td>{sub.payments.length ? t('adminSubscriptions.paymentCount', { n: sub.payments.length }) : '—'}</td>
                  <td className="actions">
                    {(sub.status === 'PENDING_PAYMENT' || sub.status === 'SUSPENDED') && (
                      <>
                        {payForm === sub.id ? (
                          <span className="inline-form">
                            <input
                              type="number"
                              placeholder={t('adminSubscriptions.amountPlaceholder')}
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              style={{ width: '70px', padding: '0.3rem', borderRadius: '6px', border: '1.5px solid var(--border)' }}
                            />
                            <button className="btn btn-sm" onClick={() => pay(sub)}>{t('adminSubscriptions.confirmPayment')}</button>
                            <button className="btn btn-sm" onClick={() => setPayForm(null)}>{t('adminSubscriptions.cancel')}</button>
                          </span>
                        ) : (
                          <button className="btn btn-sm" onClick={() => { setPayForm(sub.id); setAmount(''); }}>
                            {t('adminSubscriptions.recordPayment')}
                          </button>
                        )}
                      </>
                    )}
                    {sub.status === 'ACTIVE' && (
                      <button className="btn btn-danger btn-sm" onClick={() => suspend(sub)}>{t('adminSubscriptions.suspend')}</button>
                    )}
                    {sub.status === 'SUSPENDED' && (
                      <button className="btn btn-sm" onClick={() => reactivate(sub)}>{t('adminSubscriptions.reactivate')}</button>
                    )}
                    {sub.status === 'EXPIRED' && (
                      <button className="btn btn-sm" onClick={() => renew(sub)}>{t('adminSubscriptions.renew')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel-head" style={{ marginTop: '1.6rem' }}>
        <h4>{t('adminSubscriptions.autoRenewalTitle')}</h4>
        <button className="btn btn-sm" onClick={runRenewalSweep}>
          {t('adminSubscriptions.runSweep')}
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        {t('adminSubscriptions.autoRenewalNote')}
      </p>

      <h4 style={{ marginTop: '1.6rem', marginBottom: '0.7rem' }}>{t('adminSubscriptions.discountsTitle')}</h4>
      {!dcForm ? (
        <button className="btn btn-primary btn-sm" style={{ marginBottom: '0.8rem' }} onClick={() => setDcForm(true)}>
          {t('adminSubscriptions.createDiscount')}
        </button>
      ) : (
        <form className="inline-form" style={{ marginBottom: '0.8rem', flexWrap: 'wrap' }} onSubmit={createDiscount}>
          <input placeholder={t('adminSubscriptions.codePlaceholder')} value={dc.code} onChange={(e) => setDc({ ...dc, code: e.target.value })} required style={{ padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }} />
          <select value={dc.type} onChange={(e) => setDc({ ...dc, type: e.target.value })} style={{ padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }}>
            <option value="PERCENTAGE">{t('adminSubscriptions.percentageType')}</option>
            <option value="AMOUNT">{t('adminSubscriptions.amountType')}</option>
          </select>
          <input type="number" min="0" placeholder={dc.type === 'PERCENTAGE' ? t('adminSubscriptions.valuePlaceholderPercent') : t('adminSubscriptions.valuePlaceholderAmount')} value={dc.value} onChange={(e) => setDc({ ...dc, value: e.target.value })} required style={{ width: '80px', padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }} />
          <input type="number" min="1" placeholder={t('adminSubscriptions.usageLimitPlaceholder')} value={dc.usageLimit} onChange={(e) => setDc({ ...dc, usageLimit: e.target.value })} style={{ width: '90px', padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }} />
          <input type="date" value={dc.expiresAt} onChange={(e) => setDc({ ...dc, expiresAt: e.target.value })} style={{ padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }} />
          <input placeholder={t('adminSubscriptions.descriptionPlaceholder')} value={dc.description} onChange={(e) => setDc({ ...dc, description: e.target.value })} style={{ padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }} />
          <button className="btn btn-primary btn-sm" type="submit">{t('adminSubscriptions.create')}</button>
          <button className="btn btn-sm" type="button" onClick={() => setDcForm(null)}>{t('adminSubscriptions.cancel')}</button>
        </form>
      )}
      {discounts.length === 0 ? (
        <div className="empty">{t('adminSubscriptions.noDiscounts')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('adminSubscriptions.codeColumn')}</th>
                <th>{t('adminSubscriptions.typeColumn')}</th>
                <th>{t('adminSubscriptions.valueColumn')}</th>
                <th>{t('adminSubscriptions.usageColumn')}</th>
                <th>{t('adminSubscriptions.validityColumn')}</th>
                <th>{t('adminSubscriptions.statusColumn2')}</th>
                <th>{t('adminSubscriptions.actionColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.code}</strong></td>
                  <td>{d.type === 'PERCENTAGE' ? t('adminSubscriptions.percentage') : t('adminSubscriptions.amount')}</td>
                  <td>{d.type === 'PERCENTAGE' ? `${d.value}%` : t('paymentCenter.currency', { n: d.value })}</td>
                  <td>{d.usedCount}{d.usageLimit != null ? ` / ${d.usageLimit}` : ''}</td>
                  <td>{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB') : t('adminSubscriptions.permanent')}</td>
                  <td>
                    <span className={`badge badge-${d.active ? 'approved' : 'rejected'}`}>
                      {d.active ? t('adminSubscriptions.active') : t('adminSubscriptions.disabled')}
                    </span>
                  </td>
                  <td>
                    {d.active && (
                      <button className="btn btn-danger btn-sm" onClick={() => deactivateDiscount(d)}>{t('adminSubscriptions.deactivate')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ marginTop: '1.6rem', marginBottom: '0.7rem' }}>{t('adminSubscriptions.invoicesTitle')}</h4>
      {invoices.length === 0 ? (
        <div className="empty">{t('adminSubscriptions.noInvoices')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('adminSubscriptions.invoiceColumn')}</th>
                <th>{t('adminSubscriptions.beneficiaryColumn')}</th>
                <th>{t('adminSubscriptions.planColumn2')}</th>
                <th>{t('adminSubscriptions.dateColumn')}</th>
                <th>{t('adminSubscriptions.amountColumn2')}</th>
                <th>{t('adminSubscriptions.discountColumn')}</th>
                <th>{t('adminSubscriptions.totalColumn')}</th>
                <th>{t('adminSubscriptions.actionColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNumber || `#${inv.id}`}</td>
                  <td>
                    {inv.subscription?.user?.firstName} {inv.subscription?.user?.lastName}
                    <div className="muted" style={{ fontSize: '0.78rem' }}>
                      {inv.subscription?.user?.email}
                    </div>
                  </td>
                  <td>{inv.subscription?.plan} ({inv.subscription?.schoolYear})</td>
                  <td className="date-value">{new Date(inv.issuedAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{t('paymentCenter.currency', { n: inv.amount })}</td>
                  <td>{inv.discountAmount > 0 ? `-${t('paymentCenter.currency', { n: inv.discountAmount })}` : '—'}</td>
                  <td><strong>{t('paymentCenter.currency', { n: inv.total })}</strong></td>
                  <td>
                    <button className="btn btn-sm" onClick={() => downloadInvoice(inv)}>{t('adminSubscriptions.downloadPdf')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 style={{ marginTop: '1.6rem', marginBottom: '0.7rem' }}>{t('adminSubscriptions.paymentsLogTitle')}</h4>
      {data.payments.length === 0 ? (
        <div className="empty">{t('adminSubscriptions.noPayments')}</div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('adminSubscriptions.dateColumn')}</th>
                <th>{t('adminSubscriptions.amountColumn')}</th>
                <th>{t('adminSubscriptions.methodColumn')}</th>
                <th>{t('adminSubscriptions.recordedByColumn')}</th>
                <th>{t('adminSubscriptions.subscriptionColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.paidAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                  <td>{t('paymentCenter.currency', { n: p.amount })}</td>
                  <td>{p.method}</td>
                  <td>{p.paidBy.firstName} {p.paidBy.lastName}</td>
                  <td>{p.subscription.plan} ({p.subscription.schoolYear})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
