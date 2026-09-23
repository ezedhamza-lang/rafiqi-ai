import { useCallback, useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { api } from '../api/client.js';
import { useI18n } from '../i18n/index.jsx';

const INTENT_STATUS_LABEL_KEYS = {
  PENDING: 'paymentCenter.intentStatusLabels.PENDING',
  SUCCEEDED: 'paymentCenter.intentStatusLabels.SUCCEEDED',
  FAILED: 'paymentCenter.intentStatusLabels.FAILED',
  CANCELED: 'paymentCenter.intentStatusLabels.CANCELED',
  EXPIRED: 'paymentCenter.intentStatusLabels.EXPIRED'
};

const INTENT_BADGE = {
  PENDING: 'processing',
  SUCCEEDED: 'approved',
  FAILED: 'rejected',
  CANCELED: 'warn',
  EXPIRED: 'warn'
};

const PROVIDER_LABEL_KEYS = {
  DEMO: 'paymentCenter.providerLabels.DEMO',
  STRIPE: 'paymentCenter.providerLabels.STRIPE',
  STB: 'paymentCenter.providerLabels.STB'
};

export default function PaymentCenter() {
  const { lang, t } = useI18n();
  const [payable, setPayable] = useState({ own: [], children: [] });
  const [intents, setIntents] = useState([]);
  const [providers, setProviders] = useState([]);
  const [active, setActive] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [checkout, setCheckout] = useState(null);
  const [checkoutKind, setCheckoutKind] = useState('INITIAL');
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [provider, setProvider] = useState('DEMO');
  const [discountCode, setDiscountCode] = useState('');

  const load = useCallback(async () => {
    const [p, i, provs, a, inv] = await Promise.all([
      api.get('/payments/payable'),
      api.get('/payments/intents/mine'),
      api.get('/payments/providers'),
      api.get('/payments/active'),
      api.get('/payments/invoices/mine')
    ]);
    setPayable(p);
    setIntents(i);
    setProviders(provs);
    setActive(a);
    setInvoices(inv);
  }, []);

  useEffect(() => {
    load()
      .catch(() => setError(t('paymentCenter.loadError')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const openCheckout = async (sub, kind = 'INITIAL') => {
    setError('');
    setSuccess('');
    setCheckout(sub);
    setCheckoutKind(kind);
    setCaptchaAnswer('');
    setDiscountCode('');
    try {
      const c = await api.get('/payments/captcha');
      setCaptcha(c);
    } catch (err) {
      setError(err.message);
    }
  };

  const closeCheckout = () => {
    setCheckout(null);
    setCaptcha(null);
    setCaptchaAnswer('');
    setDiscountCode('');
  };

  const submitCheckout = async (e) => {
    e.preventDefault();
    if (!checkout) return;
    setBusy(true);
    setError('');
    try {
      const intent = await api.post('/payments/checkout', {
        subscriptionId: checkout.id,
        provider,
        kind: checkoutKind,
        discountCode: discountCode.trim() || undefined,
        captchaToken: captcha.token,
        captchaAnswer: captchaAnswer.trim()
      });
      closeCheckout();
      await load();
      if (intent.checkoutUrl) {
        window.location.href = intent.checkoutUrl;
      } else {
        setSuccess(t('paymentCenter.checkoutCreated'));
      }
    } catch (err) {
      setError(err.message);
      if (captcha) {
        api.get('/payments/captcha').then(setCaptcha).catch(() => {});
        setCaptchaAnswer('');
      }
    } finally {
      setBusy(false);
    }
  };

  const cancelIntent = async (id) => {
    if (!window.confirm(t('paymentCenter.confirmCancelIntent'))) return;
    try {
      await api.post(`/payments/intents/${id}/cancel`, {});
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleRenewal = async (sub) => {
    const enable = !sub.renewalEnabled;
    if (enable && !window.confirm(t('paymentCenter.confirmEnableRenewal'))) return;
    if (!enable && !window.confirm(t('paymentCenter.confirmDisableRenewal'))) return;
    try {
      await api.post(`/payments/subscriptions/${sub.id}/${enable ? 'enable-renewal' : 'cancel-renewal'}`, {});
      setSuccess(enable ? t('paymentCenter.renewalEnabled') : t('paymentCenter.renewalDisabled'));
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const renewNow = (sub) => openCheckout(sub, 'RENEWAL');

  const downloadInvoice = async (inv) => {
    try {
      await api.download(`/payments/invoices/${inv.id}/pdf`, `${inv.invoiceNumber}.pdf`);
    } catch (err) {
      setError(err.message);
    }
  };

  const refreshCaptcha = async () => {
    const c = await api.get('/payments/captcha');
    setCaptcha(c);
    setCaptchaAnswer('');
  };

  if (loading) {
    return (
      <div className="loading-wrap">
        <span className="spinner" />
      </div>
    );
  }

  const allPayable = [...payable.children, ...payable.own];
  const currency = (n) => t('paymentCenter.currency', { n });

  return (
    <div className="container" style={{ maxWidth: 1000, paddingTop: '2rem', paddingBottom: '2rem' }}>
      <h2>{t('paymentCenter.title')}</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '1.4rem', lineHeight: 1.8 }}>
        {t('paymentCenter.subtitle')}
      </p>

      {error && <div className="form-error">{error}</div>}
      {success && <div className="form-success">{success}</div>}

      <section className="panel" style={{ marginBottom: '1.6rem' }}>
        <div className="panel-head">
          <h3>{t('paymentCenter.payableTitle')}</h3>
          <p className="muted">{t('paymentCenter.payableSubtitle')}</p>
        </div>

        {allPayable.length === 0 ? (
          <div className="empty">{t('paymentCenter.noPayable')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('paymentCenter.beneficiary')}</th>
                  <th>{t('paymentCenter.plan')}</th>
                  <th>{t('paymentCenter.schoolYear')}</th>
                  <th>{t('paymentCenter.amount')}</th>
                  <th>{t('paymentCenter.status')}</th>
                  <th>{t('paymentCenter.action')}</th>
                </tr>
              </thead>
              <tbody>
                {allPayable.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.childName ? t('paymentCenter.childLabel', { name: s.childName }) : `${s.user.firstName} ${s.user.lastName}`}
                    </td>
                    <td>{s.plan}</td>
                    <td>{s.schoolYear}</td>
                    <td>{s.amount != null ? currency(s.amount) : '—'}</td>
                    <td>
                      <span className={`badge badge-${s.status === 'PENDING_PAYMENT' ? 'processing' : 'warn'}`}>
                        {s.status === 'PENDING_PAYMENT' ? t('paymentCenter.pendingPayment') : t('paymentCenter.disabled')}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => openCheckout(s, 'INITIAL')}>
                        {t('paymentCenter.payNow')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginBottom: '1.6rem' }}>
        <div className="panel-head">
          <h3>{t('paymentCenter.activeTitle')}</h3>
          <p className="muted">
            {t('paymentCenter.activeSubtitle')}
          </p>
        </div>

        {active.length === 0 ? (
          <div className="empty">{t('paymentCenter.noActive')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('paymentCenter.beneficiary')}</th>
                  <th>{t('paymentCenter.plan')}</th>
                  <th>{t('paymentCenter.duration')}</th>
                  <th>{t('paymentCenter.autoRenewal')}</th>
                  <th>{t('paymentCenter.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {active.map((s) => {
                  const pendingRenewal = s.paymentIntents && s.paymentIntents[0];
                  return (
                    <tr key={s.id}>
                      <td>
                        {s.childName ? t('paymentCenter.childLabel', { name: s.childName }) : `${s.user.firstName} ${s.user.lastName}`}
                      </td>
                      <td>{s.plan} ({s.schoolYear})</td>
                      <td className="date-value">
                        {new Date(s.startDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')} ←{' '}
                        {new Date(s.endDate).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}
                      </td>
                      <td>
                        <span className={`badge badge-${s.renewalEnabled ? 'approved' : 'warn'}`}>
                          {s.renewalEnabled ? t('paymentCenter.enabled') : t('paymentCenter.disabledRenewal')}
                        </span>
                      </td>
                      <td className="actions">
                        {pendingRenewal ? (
                          <>
                            <span className="badge badge-processing">{t('paymentCenter.renewalPending')}</span>
                            <a className="btn btn-primary btn-sm" href={pendingRenewal.checkoutUrl} target="_blank" rel="noreferrer">
                              {t('paymentCenter.completePayment')}
                            </a>
                          </>
                        ) : (
                          <button className="btn btn-sm" onClick={() => renewNow(s)}>
                            {t('paymentCenter.renewNow')}
                          </button>
                        )}
                        <button
                          className="btn btn-sm"
                          onClick={() => toggleRenewal(s)}
                        >
                          {s.renewalEnabled ? t('paymentCenter.cancelAutoRenewal') : t('paymentCenter.enableAutoRenewal')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel" style={{ marginBottom: '1.6rem' }}>
        <div className="panel-head">
          <h3>{t('paymentCenter.pastPayments')}</h3>
          <p className="muted">{t('paymentCenter.pastPaymentsSubtitle')}</p>
        </div>

        {intents.length === 0 ? (
          <div className="empty">{t('paymentCenter.noIntents')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('paymentCenter.operation')}</th>
                  <th>{t('paymentCenter.provider')}</th>
                  <th>{t('paymentCenter.plan')}</th>
                  <th>{t('paymentCenter.amount')}</th>
                  <th>{t('paymentCenter.status')}</th>
                  <th>{t('paymentCenter.date')}</th>
                  <th>{t('paymentCenter.action')}</th>
                </tr>
              </thead>
              <tbody>
                {intents.map((it) => (
                  <tr key={it.id}>
                    <td>
                      #{it.id}
                      {it.providerReference ? (
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{it.providerReference}</div>
                      ) : null}
                    </td>
                    <td>{PROVIDER_LABEL_KEYS[it.provider] ? t(PROVIDER_LABEL_KEYS[it.provider]) : it.provider}</td>
                    <td>{it.subscription?.plan || '—'}</td>
                    <td>{currency(it.amount)}</td>
                    <td>
                      <span className={`badge badge-${INTENT_BADGE[it.status]}`}>
                        {INTENT_STATUS_LABEL_KEYS[it.status] ? t(INTENT_STATUS_LABEL_KEYS[it.status]) : it.status}
                      </span>
                    </td>
                    <td className="date-value">{new Date(it.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                    <td>
                      {it.status === 'PENDING' && (
                        <button className="btn btn-sm" onClick={() => cancelIntent(it.id)}>{t('paymentCenter.cancel')}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>{t('paymentCenter.myInvoices')}</h3>
          <p className="muted">{t('paymentCenter.invoicesSubtitle')}</p>
        </div>

        {invoices.length === 0 ? (
          <div className="empty">{t('paymentCenter.noInvoices')}</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('paymentCenter.invoice')}</th>
                  <th>{t('paymentCenter.plan')}</th>
                  <th>{t('paymentCenter.date')}</th>
                  <th>{t('paymentCenter.amount')}</th>
                  <th>{t('paymentCenter.discount')}</th>
                  <th>{t('paymentCenter.total')}</th>
                  <th>{t('paymentCenter.action')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoiceNumber || `#${inv.id}`}</td>
                    <td>{inv.subscription?.plan || '—'}</td>
                    <td className="date-value">{new Date(inv.issuedAt).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'en-GB')}</td>
                    <td>{currency(inv.amount)}</td>
                    <td>{inv.discountAmount > 0 ? `-${currency(inv.discountAmount)}` : '—'}</td>
                    <td><strong>{currency(inv.total)}</strong></td>
                    <td>
                      <button className="btn btn-sm" onClick={() => downloadInvoice(inv)}>
                        {t('paymentCenter.downloadPdf')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {checkout && captcha && (
        <div className="modal-overlay" onClick={closeCheckout}>
          <form
            className="modal"
            style={{ maxWidth: 480 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitCheckout}
          >
            <div className="modal-head">
              <h3>{checkoutKind === 'RENEWAL' ? t('paymentCenter.renewalModalTitle') : t('paymentCenter.checkoutModalTitle')}</h3>
              <button type="button" className="icon-btn" onClick={closeCheckout} aria-label={t('paymentCenter.closeAria')}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div style={{ padding: '1.2rem 1.4rem 1.4rem' }}>

            <div style={{ background: 'var(--bg-subtle)', padding: '12px', borderRadius: '10px', marginBottom: '1rem' }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <div className="form-group grow">
                  <label>{t('paymentCenter.plan')}</label>
                  <input value={checkout.plan} disabled />
                </div>
                <div className="form-group">
                  <label>{t('paymentCenter.amount')}</label>
                  <input value={currency(checkout.amount ?? '—')} disabled />
                </div>
              </div>
              {checkoutKind === 'RENEWAL' && (
                <p className="muted" style={{ fontSize: '0.8rem', marginTop: '6px' }}>
                  {t('paymentCenter.renewalNote')}
                </p>
              )}
            </div>

            <div className="form-group">
              <label>{t('paymentCenter.providerLabel')}</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                {providers.map((p) => (
                  <option key={p.name} value={p.name} disabled={!p.configured}>
                    {p.label}{p.configured ? '' : ` ${t('paymentCenter.notConfigured')}`}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                {t('paymentCenter.providerHint')}
              </p>
            </div>

            <div className="form-group">
              <label>{t('paymentCenter.discountCodeLabel')}</label>
              <input
                placeholder={t('paymentCenter.discountCodePlaceholder')}
                value={discountCode}
                onChange={(e) => setDiscountCode(e.target.value)}
                style={{ textTransform: 'uppercase' }}
              />
              <p className="muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                {t('paymentCenter.discountCodeHint')}
              </p>
            </div>

            <div className="form-group">
              <label>{t('paymentCenter.captchaLabel')}</label>
              <div className="form-row" style={{ alignItems: 'center' }}>
                <div className="grow" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(captcha.svg || '', { USE_PROFILES: { svg: true, svgFilters: true } }) }} style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', width: '100%' }} />
                <button type="button" className="btn btn-sm" onClick={refreshCaptcha} aria-label={t('paymentCenter.refreshAria')}>
                  <span className="material-icons">refresh</span>
                </button>
              </div>
              <input
                style={{ marginTop: '8px' }}
                placeholder={captcha.question}
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
              />
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? t('paymentCenter.creatingPayment') : checkoutKind === 'RENEWAL' ? t('paymentCenter.proceedRenewal') : t('paymentCenter.proceedPayment')}
            </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
