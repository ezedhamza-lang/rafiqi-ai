import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { canManageFinance } from '../../roles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { Navigate } from 'react-router-dom';

function severityBadge(sev) {
  if (sev === 'CRITICAL' || sev === 'HIGH') return 'rejected';
  if (sev === 'MEDIUM') return 'warn';
  return 'pending';
}

export default function FinanceDashboard() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [overview, setOverview] = useState(null);
  const [recon, setRecon] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [anomalyFilter, setAnomalyFilter] = useState('OPEN');
  const [intents, setIntents] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [refunds, setRefunds] = useState([]);

  const [period, setPeriod] = useState({ from: '', to: '', schoolYear: '' });
  const [reportData, setReportData] = useState(null);

  const loadOverview = useCallback((p = period) => {
    const q = new URLSearchParams();
    if (p.from) q.set('from', p.from);
    if (p.to) q.set('to', p.to);
    if (p.schoolYear) q.set('schoolYear', p.schoolYear);
    const qs = q.toString();
    api
      .get(`/admin/finance/overview${qs ? `?${qs}` : ''}`)
      .then(setOverview)
      .catch((e) => setErr(e.message));
  }, [period]);

  const loadRecon = useCallback(() => {
    api
      .get('/admin/finance/reconciliation')
      .then(setRecon)
      .catch((e) => setErr(e.message));
  }, []);

  const loadAnomalies = useCallback((status = anomalyFilter) => {
    api
      .get(`/admin/finance/anomalies?status=${status}`)
      .then(setAnomalies)
      .catch((e) => setErr(e.message));
  }, [anomalyFilter]);

  const loadLists = useCallback(() => {
    api.get('/payments/admin/intents').then(setIntents).catch(() => {});
    api.get('/payments/admin/invoices').then(setInvoices).catch(() => {});
    api.get('/admin/finance/refunds').then(setRefunds).catch(() => {});
  }, []);

  const loadReport = useCallback((p = period) => {
    const q = new URLSearchParams();
    if (p.from) q.set('from', p.from);
    if (p.to) q.set('to', p.to);
    if (p.schoolYear) q.set('schoolYear', p.schoolYear);
    const qs = q.toString();
    api
      .get(`/admin/finance/reports${qs ? `?${qs}` : ''}`)
      .then(setReportData)
      .catch((e) => setErr(e.message));
  }, [period]);

  useEffect(() => {
    loadOverview();
    loadRecon();
    loadAnomalies();
    loadLists();
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user && !canManageFinance(user)) {
    return <Navigate to="/director" replace />;
  }

  const runDetection = async () => {
    try {
      const r = await api.post('/admin/finance/anomalies/detect', {});
      setMsg(t('finance.detectionMsg', { n: r.created }));
      loadAnomalies();
    } catch (e) {
      setErr(e.message);
    }
  };

  const resolveAnomaly = async (a, status) => {
    try {
      await api.post(`/admin/finance/anomalies/${a.id}/resolve`, {
        status,
        resolution: status === 'RESOLVED' ? t('finance.resolutionResolved') : t('finance.resolutionIgnored')
      });
      setMsg(t('finance.resolveMsg', { status: status === 'RESOLVED' ? t('finance.resolvedAction') : t('finance.ignoredAction'), title: a.title }));
      loadAnomalies();
    } catch (e) {
      setErr(e.message);
    }
  };

  const refundInvoice = async (inv) => {
    const reason = window.prompt(
      t('finance.refundPrompt', {
        invoice: inv.invoiceNumber || `#${inv.id}`,
        total: money(inv.total)
      }),
      ''
    );
    if (reason === null) return;
    try {
      await api.post(`/admin/finance/invoices/${inv.id}/refund`, { reason: reason || t('finance.refundAdminReason') });
      setMsg(t('finance.refundMsg', { invoice: inv.invoiceNumber || `#${inv.id}` }));
      loadLists();
      loadReport();
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

  const exportReport = async (format) => {
    const q = new URLSearchParams();
    if (period.from) q.set('from', period.from);
    if (period.to) q.set('to', period.to);
    if (period.schoolYear) q.set('schoolYear', period.schoolYear);
    const qs = q.toString();
    try {
      await api.download(
        `/admin/finance/reports/${format}${qs ? `?${qs}` : ''}`,
        `financial-report-${period.schoolYear || `${period.from || 'all'}_${period.to || ''}`}.${format}`
      );
      setMsg(t('finance.exportMsg', { format: format.toUpperCase() }));
    } catch (e) {
      setErr(e.message);
    }
  };

  function fmtDate(value) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB');
  }

  function money(value) {
    const n = Number(value || 0).toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return t('paymentCenter.currency', { n });
  }

  const TABS = [
    { key: 'overview', icon: 'insights', labelKey: 'finance.tabs.overview' },
    { key: 'operations', icon: 'receipt_long', labelKey: 'finance.tabs.operations' },
    { key: 'reconciliation', icon: 'balance', labelKey: 'finance.tabs.reconciliation' },
    { key: 'anomalies', icon: 'gpp_maybe', labelKey: 'finance.tabs.anomalies' },
    { key: 'reports', icon: 'description', labelKey: 'finance.tabs.reports' }
  ];

  const s = overview?.summary;

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>{t('finance.title')}</h3>
        <p className="muted">{t('finance.subtitle')}</p>
      </div>

      {msg && <div className="form-success" style={{ marginBottom: '0.8rem' }}>{msg}</div>}
      {err && <div className="form-error" style={{ marginBottom: '0.8rem' }}>{err}</div>}

      <div className="sub-grid" style={{ marginBottom: '1.2rem' }}>
        <input
          type="date"
          value={period.from}
          onChange={(e) => setPeriod({ ...period, from: e.target.value })}
          style={{ padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }}
        />
        <input
          type="date"
          value={period.to}
          onChange={(e) => setPeriod({ ...period, to: e.target.value })}
          style={{ padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)' }}
        />
        <input
          type="text"
          placeholder={t('finance.schoolYearPlaceholder')}
          value={period.schoolYear}
          onChange={(e) => setPeriod({ ...period, schoolYear: e.target.value })}
          style={{ padding: '0.35rem', borderRadius: '6px', border: '1.5px solid var(--border)', minWidth: '150px' }}
        />
        <button className="btn btn-sm" onClick={() => { loadOverview(); loadReport(); }}>
          {t('finance.applyPeriod')}
        </button>
      </div>

      <nav className="teacher-tabs" style={{ marginBottom: '1rem' }}>
        {TABS.map((tb) => (
          <button key={tb.key} className={tab === tb.key ? 'active' : ''} onClick={() => setTab(tb.key)}>
            <span className="material-icons">{tb.icon}</span>
            {t(tb.labelKey)}
            {tb.key === 'anomalies' && anomalies?.total > 0 && (
              <span className="badge warn" style={{ marginInlineStart: '0.3rem' }}>{anomalies.total}</span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div>
          {!overview ? (
            <div className="loading-wrap"><span className="spinner" /></div>
          ) : (
            <>
              <div className="stat-grid" style={{ marginBottom: '1.4rem' }}>
                <div className="card-item stat-card">
                  <span className="material-icons">payments</span>
                  <div className="stat-value">{money(s.periodRevenue)}</div>
                  <div className="stat-label">{t('finance.periodRevenue', { n: s.periodRevenueCount })}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">account_balance_wallet</span>
                  <div className="stat-value">{money(s.monthRevenue)}</div>
                  <div className="stat-label">{t('finance.monthRevenue')}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">verified_user</span>
                  <div className="stat-value">{s.activeSubscriptions}</div>
                  <div className="stat-label">{t('finance.activeSubscriptions')}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">percent</span>
                  <div className="stat-value">{s.successRate != null ? `${s.successRate}%` : '—'}</div>
                  <div className="stat-label">{t('finance.successRate')}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">replay</span>
                  <div className="stat-value">{money(s.refundAmount)}</div>
                  <div className="stat-label">{t('finance.refundsLabel', { n: s.refundCount })}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">local_offer</span>
                  <div className="stat-value">{money(s.discountAmount)}</div>
                  <div className="stat-label">{t('finance.discountsGranted')}</div>
                </div>
              </div>

              <div className="sub-grid" style={{ marginBottom: '1.4rem' }}>
                <div className="card-item">
                  <h4>{t('finance.monthlyRevenue')}</h4>
                  {overview.revenueByMonth.length === 0 ? (
                    <div className="empty">{t('finance.noData')}</div>
                  ) : (
                    <div className="trend-bars" style={{ height: '120px' }}>
                      {overview.revenueByMonth.map((r) => (
                        <div key={r.month} className="trend-col" title={`${r.month}: ${money(r.amount)}`}>
                          <div
                            className="trend-bar"
                            style={{ height: `${(r.amount / Math.max(1, ...overview.revenueByMonth.map((x) => x.amount))) * 100}%` }}
                          />
                          <span className="trend-label">{r.month.slice(5)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="card-item">
                  <h4>{t('finance.byPlan')}</h4>
                  {overview.byPlan.length === 0 ? (
                    <div className="empty">{t('finance.noDataShort')}</div>
                  ) : (
                    <div className="alert-list">
                      {overview.byPlan.map((p) => (
                        <li key={p.plan}>
                          <strong>{p.plan}</strong> — {p.count} · {money(p.amount)}
                        </li>
                      ))}
                    </div>
                  )}
                  <h4 style={{ marginTop: '0.8rem' }}>{t('finance.byMethod')}</h4>
                  {overview.byMethod.length === 0 ? (
                    <div className="empty">{t('finance.noDataShort')}</div>
                  ) : (
                    <div className="alert-list">
                      {overview.byMethod.map((m) => (
                        <li key={m.method}>
                          <strong>{m.method}</strong> — {m.count} · {money(m.amount)}
                        </li>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="sub-grid">
                <div className="card-item">
                  <h4>{t('finance.recentPayments')}</h4>
                  {overview.recentPayments.length === 0 ? (
                    <div className="empty">{t('finance.noOperations')}</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr><th>{t('finance.dateColumn')}</th><th>{t('finance.amountColumn')}</th><th>{t('finance.methodColumn')}</th><th>{t('finance.beneficiaryColumn')}</th></tr>
                        </thead>
                        <tbody>
                          {overview.recentPayments.map((p) => (
                            <tr key={p.id}>
                              <td className="date-value">{fmtDate(p.paidAt)}</td>
                              <td>{money(p.amount)}</td>
                              <td>{p.method}</td>
                              <td>{p.subscription?.user?.firstName} {p.subscription?.user?.lastName}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="card-item">
                  <h4>{t('finance.recentIntents')}</h4>
                  {overview.recentIntents.length === 0 ? (
                    <div className="empty">{t('finance.noOperations')}</div>
                  ) : (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr><th>{t('finance.dateColumn')}</th><th>{t('finance.amountColumn')}</th><th>{t('finance.providerColumn')}</th><th>{t('finance.statusColumn')}</th></tr>
                        </thead>
                        <tbody>
                          {overview.recentIntents.map((it) => (
                            <tr key={it.id}>
                              <td className="date-value">{fmtDate(it.createdAt)}</td>
                              <td>{money(it.amount)}</td>
                              <td>{t(`paymentCenter.providerLabels.${it.provider}`)}</td>
                              <td>
                                <span className={`badge badge-${it.status === 'SUCCEEDED' ? 'approved' : it.status === 'FAILED' || it.status === 'CANCELED' || it.status === 'EXPIRED' ? 'rejected' : 'pending'}`}>
                                  {t(`paymentCenter.intentStatusLabels.${it.status}`)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'operations' && (
        <div>
          <h4 style={{ marginBottom: '0.7rem' }}>{t('finance.intentsTitle')}</h4>
          {intents.length === 0 ? (
            <div className="empty">{t('finance.noIntents')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('finance.idColumn')}</th>
                    <th>{t('finance.dateColumn')}</th>
                    <th>{t('finance.beneficiaryColumn')}</th>
                    <th>{t('finance.planColumn')}</th>
                    <th>{t('finance.providerColumn')}</th>
                    <th>{t('finance.amountColumn')}</th>
                    <th>{t('finance.typeColumn')}</th>
                    <th>{t('finance.statusColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {intents.map((it) => (
                    <tr key={it.id}>
                      <td>#{it.id}</td>
                      <td className="date-value">{fmtDate(it.createdAt)}</td>
                      <td>{it.user?.firstName} {it.user?.lastName}</td>
                      <td>{it.subscription?.plan} ({it.subscription?.schoolYear})</td>
                      <td>{t(`paymentCenter.providerLabels.${it.provider}`)}</td>
                      <td>{money(it.amount)}</td>
                      <td>{it.metadata?.kind === 'RENEWAL' ? t('finance.kindRenewal') : t('finance.kindInitial')}</td>
                      <td>
                        <span className={`badge badge-${it.status === 'SUCCEEDED' ? 'approved' : it.status === 'FAILED' || it.status === 'CANCELED' || it.status === 'EXPIRED' ? 'rejected' : 'pending'}`}>
                          {t(`paymentCenter.intentStatusLabels.${it.status}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 style={{ marginTop: '1.6rem', marginBottom: '0.7rem' }}>{t('finance.invoicesTitle')}</h4>
          {invoices.length === 0 ? (
            <div className="empty">{t('finance.noInvoices')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('finance.invoiceColumn')}</th>
                    <th>{t('finance.beneficiaryColumn')}</th>
                    <th>{t('finance.dateColumn')}</th>
                    <th>{t('finance.amountColumn')}</th>
                    <th>{t('finance.discountColumn')}</th>
                    <th>{t('finance.totalColumn')}</th>
                    <th>{t('finance.statusColumn')}</th>
                    <th>{t('finance.actionColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id}>
                      <td>{inv.invoiceNumber || `#${inv.id}`}</td>
                      <td>
                        {inv.subscription?.user?.firstName} {inv.subscription?.user?.lastName}
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{inv.subscription?.user?.email}</div>
                      </td>
                      <td className="date-value">{fmtDate(inv.issuedAt)}</td>
                      <td>{money(inv.amount)}</td>
                      <td>{inv.discountAmount > 0 ? `-${money(inv.discountAmount)}` : '—'}</td>
                      <td><strong>{money(inv.total)}</strong></td>
                      <td>
                        <span className={`badge badge-${inv.status === 'PAID' ? 'approved' : 'rejected'}`}>
                          {inv.status === 'PAID' ? t('finance.invoicePaid') : inv.status === 'REFUNDED' ? t('finance.invoiceRefunded') : t('finance.invoiceCancelled')}
                        </span>
                      </td>
                      <td className="actions">
                        <button className="btn btn-sm" onClick={() => downloadInvoice(inv)}>{t('finance.downloadPdf')}</button>
                        {inv.status === 'PAID' && (
                          <button className="btn btn-danger btn-sm" style={{ marginInlineStart: '0.3rem' }} onClick={() => refundInvoice(inv)}>
                            {t('finance.refund')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h4 style={{ marginTop: '1.6rem', marginBottom: '0.7rem' }}>{t('finance.refundsTitle')}</h4>
          {refunds.length === 0 ? (
            <div className="empty">{t('finance.noRefunds')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('finance.dateColumn')}</th>
                    <th>{t('finance.invoiceRefColumn')}</th>
                    <th>{t('finance.planColumn')}</th>
                    <th>{t('finance.amountColumn')}</th>
                    <th>{t('finance.reasonColumn')}</th>
                    <th>{t('finance.recordedByColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map((r) => (
                    <tr key={r.id}>
                      <td className="date-value">{fmtDate(r.refundedAt)}</td>
                      <td>{r.invoice?.invoiceNumber || `#${r.invoiceId}`}</td>
                      <td>{r.subscription?.plan} ({r.subscription?.schoolYear})</td>
                      <td>{money(r.amount)}</td>
                      <td>{r.reason || '—'}</td>
                      <td>{r.refundedByUser?.firstName} {r.refundedByUser?.lastName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'reconciliation' && (
        <div>
          {!recon ? (
            <div className="loading-wrap"><span className="spinner" /></div>
          ) : (
            <>
              <div className="stat-grid" style={{ marginBottom: '1.4rem' }}>
                <div className="card-item stat-card">
                  <span className="material-icons">payments</span>
                  <div className="stat-value">{money(recon.totals.payments)}</div>
                  <div className="stat-label">{t('finance.reconPaymentsTotal')}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">receipt_long</span>
                  <div className="stat-value">{money(recon.totals.invoices)}</div>
                  <div className="stat-label">{t('finance.reconInvoicesTotal')}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">replay</span>
                  <div className="stat-value">{money(recon.totals.refunds)}</div>
                  <div className="stat-label">{t('finance.reconRefundsTotal')}</div>
                </div>
                <div className="card-item stat-card">
                  <span className="material-icons">verified</span>
                  <div className="stat-value">{money(recon.totals.reconciledNet)}</div>
                  <div className="stat-label">{t('finance.reconNet')}</div>
                </div>
              </div>

              <div className="sub-grid" style={{ marginBottom: '1rem' }}>
                {[
                  { key: 'issuePaymentsNoInvoice', count: recon.counts.paymentsWithoutInvoice, icon: 'receipt' },
                  { key: 'issueInvoicesNoPayment', count: recon.counts.invoicesWithoutPayment, icon: 'request_quote' },
                  { key: 'issueMismatch', count: recon.counts.mismatchInvoices, icon: 'compare_arrows' },
                  { key: 'issueActiveNoPayment', count: recon.counts.activeWithoutPayment, icon: 'warning' }
                ].map((item) => (
                  <div className="card-item" key={item.key}>
                    <span className="material-icons">{item.icon}</span>
                    <strong>{item.count}</strong>
                    <div className="muted">{t(`finance.${item.key}`)}</div>
                  </div>
                ))}
              </div>

              <h4 style={{ marginBottom: '0.7rem' }}>{t('finance.paymentsNoInvoiceTitle')}</h4>
              {recon.issues.paymentsWithoutInvoice.length === 0 ? (
                <div className="empty">{t('finance.okPayments')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>{t('finance.idColumn')}</th><th>{t('finance.dateColumn')}</th><th>{t('finance.beneficiaryColumn')}</th><th>{t('finance.planColumn')}</th><th>{t('finance.amountColumn')}</th><th>{t('finance.methodColumn')}</th></tr></thead>
                    <tbody>
                      {recon.issues.paymentsWithoutInvoice.map((p) => (
                        <tr key={p.id}>
                          <td>#{p.id}</td>
                          <td className="date-value">{fmtDate(p.paidAt)}</td>
                          <td>{p.subscription?.user?.firstName} {p.subscription?.user?.lastName}</td>
                          <td>{p.subscription?.plan} ({p.subscription?.schoolYear})</td>
                          <td>{money(p.amount)}</td>
                          <td>{p.method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 style={{ marginTop: '1.4rem', marginBottom: '0.7rem' }}>{t('finance.mismatchTitle')}</h4>
              {recon.issues.mismatchInvoices.length === 0 ? (
                <div className="empty">{t('finance.noMismatch')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>{t('finance.invoiceColumn')}</th><th>{t('finance.totalColumn')}</th><th>{t('finance.amountColumn')}</th><th>{t('finance.discountColumn')}</th></tr></thead>
                    <tbody>
                      {recon.issues.mismatchInvoices.map((i) => (
                        <tr key={i.id}>
                          <td>{i.invoiceNumber || `#${i.id}`}</td>
                          <td>{money(i.total)}</td>
                          <td>{money(i.payment?.amount)}</td>
                          <td className="badge warn">{money(i.total - (i.payment?.amount || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4 style={{ marginTop: '1.4rem', marginBottom: '0.7rem' }}>{t('finance.differencesTitle')}</h4>
              <div className="alert-list">
                <li>{t('finance.diffPaidVsInvoiced')} <strong>{money(recon.differences.paidVsInvoiced)}</strong></li>
                <li>{t('finance.diffPaidVsIntents')} <strong>{money(recon.differences.paidVsIntents)}</strong></li>
                <li>{t('finance.diffInvoicesVsIntents')} <strong>{money(recon.differences.invoicesVsIntents)}</strong></li>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'anomalies' && (
        <div>
          <div className="panel-head" style={{ marginBottom: '0.8rem' }}>
            <div>
              <h4>{t('finance.anomaliesTitle')}</h4>
              <p className="muted">{t('finance.anomaliesSubtitle')}</p>
            </div>
            <button className="btn btn-sm" onClick={runDetection}>{t('finance.runDetection')}</button>
          </div>

          <div className="sub-grid" style={{ marginBottom: '0.8rem' }}>
            {['OPEN', 'RESOLVED', 'IGNORED', 'ALL'].map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${anomalyFilter === st ? 'btn-primary' : ''}`}
                onClick={() => { setAnomalyFilter(st); loadAnomalies(st); }}
              >
                {st === 'OPEN' ? t('finance.anomalyOpen') : st === 'RESOLVED' ? t('finance.anomalyResolved') : st === 'IGNORED' ? t('finance.anomalyIgnored') : t('finance.anomalyAll')}
              </button>
            ))}
          </div>

          {!anomalies ? (
            <div className="loading-wrap"><span className="spinner" /></div>
          ) : anomalies.anomalies.length === 0 ? (
            <div className="empty">
              {anomalyFilter === 'OPEN'
                ? t('finance.anomalyEmptyOpen')
                : t('finance.anomalyEmptyFilter')}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('finance.severityColumn')}</th>
                    <th>{t('finance.descriptionColumn')}</th>
                    <th>{t('finance.dateColumn')}</th>
                    <th>{t('finance.statusColumn')}</th>
                    <th>{t('finance.actionColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {anomalies.anomalies.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className={`badge badge-${severityBadge(a.severity)}`}>
                          {t(`finance.severity.${a.severity}`)}
                        </span>
                      </td>
                      <td>
                        <strong>{a.title}</strong>
                        <div className="muted" style={{ fontSize: '0.82rem', maxWidth: '560px' }}>{a.description}</div>
                        {a.resolution && (
                          <div className="muted" style={{ fontSize: '0.82rem' }}>{t('finance.resolutionPrefix')} {a.resolution}</div>
                        )}
                      </td>
                      <td className="date-value">{fmtDate(a.createdAt)}</td>
                      <td>
                        <span className={`badge badge-${a.status === 'RESOLVED' ? 'approved' : a.status === 'IGNORED' ? 'pending' : 'warn'}`}>
                          {t(`finance.anomalyStatus.${a.status}`)}
                        </span>
                      </td>
                      <td className="actions">
                        {a.status === 'OPEN' && (
                          <>
                            <button className="btn btn-sm" onClick={() => resolveAnomaly(a, 'RESOLVED')}>{t('finance.resolve')}</button>
                            <button className="btn btn-sm" style={{ marginInlineStart: '0.3rem' }} onClick={() => resolveAnomaly(a, 'IGNORED')}>{t('finance.ignore')}</button>
                          </>
                        )}
                        {a.resolver && (
                          <span className="muted" style={{ fontSize: '0.78rem' }}>
                            {a.resolver.firstName} {a.resolver.lastName}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div>
          <div className="panel-head" style={{ marginBottom: '0.8rem' }}>
            <div>
              <h4>{t('finance.reportsTitle')}</h4>
              <p className="muted">{t('finance.reportsSubtitle')}</p>
            </div>
            <div className="btn-group">
              <button className="btn btn-primary btn-sm" onClick={() => exportReport('pdf')}>{t('finance.exportPdf')}</button>
              <button className="btn btn-sm" onClick={() => exportReport('csv')}>{t('finance.exportCsv')}</button>
            </div>
          </div>

          {!reportData ? (
            <div className="loading-wrap"><span className="spinner" /></div>
          ) : (
            <div className="stat-grid" style={{ marginBottom: '1.4rem' }}>
              <div className="card-item stat-card">
                <span className="material-icons">payments</span>
                <div className="stat-value">{money(reportData.summary.totalRevenue)}</div>
                <div className="stat-label">{t('finance.totalRevenue')}</div>
              </div>
              <div className="card-item stat-card">
                <span className="material-icons">local_offer</span>
                <div className="stat-value">{money(reportData.summary.totalDiscounts)}</div>
                <div className="stat-label">{t('finance.totalDiscounts')}</div>
              </div>
              <div className="card-item stat-card">
                <span className="material-icons">replay</span>
                <div className="stat-value">{money(reportData.summary.totalRefunds)}</div>
                <div className="stat-label">{t('finance.totalRefunds')}</div>
              </div>
              <div className="card-item stat-card">
                <span className="material-icons">account_balance_wallet</span>
                <div className="stat-value">{money(reportData.summary.netRevenue)}</div>
                <div className="stat-label">{t('finance.netRevenue')}</div>
              </div>
              <div className="card-item stat-card">
                <span className="material-icons">receipt_long</span>
                <div className="stat-value">{reportData.summary.paymentCount}</div>
                <div className="stat-label">{t('finance.paymentCount')}</div>
              </div>
              <div className="card-item stat-card">
                <span className="material-icons">verified</span>
                <div className="stat-value">{reportData.summary.invoiceCount}</div>
                <div className="stat-label">{t('finance.invoiceCount')}</div>
              </div>
            </div>
          )}

          <h4 style={{ marginBottom: '0.7rem' }}>{t('finance.recentReportTitle', { label: reportData?.period.label || '' })}</h4>
          {!reportData || reportData.payments.length === 0 ? (
            <div className="empty">{t('finance.noPeriodOperations')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('finance.dateColumn')}</th>
                    <th>{t('finance.beneficiaryColumn')}</th>
                    <th>{t('finance.planColumn')}</th>
                    <th>{t('finance.schoolYearColumn')}</th>
                    <th>{t('finance.methodColumn')}</th>
                    <th>{t('finance.amountColumn')}</th>
                    <th>{t('finance.invoiceNumColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.payments.slice(0, 20).map((p) => (
                    <tr key={p.id}>
                      <td className="date-value">{fmtDate(p.paidAt)}</td>
                      <td>{p.subscription?.user?.firstName} {p.subscription?.user?.lastName}</td>
                      <td>{p.subscription?.plan}</td>
                      <td>{p.subscription?.schoolYear}</td>
                      <td>{p.method}</td>
                      <td>{money(p.amount)}</td>
                      <td>{p.invoiceNumber || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
