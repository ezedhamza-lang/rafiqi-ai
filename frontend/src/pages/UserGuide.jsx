import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';

const SECTIONS = [
  {
    icon: 'person_add',
    title: 'إنشاء حساب',
    body: 'اضغط على «إنشاء حساب» في الصفحة الرئيسية، اختر نوع حسابك (ولي أمر، تلميذ، أو أستاذ)، واملأ معطياتك. ستتلقى رسالة تأكيد على بريدك الإلكتروني.'
  },
  {
    icon: 'calendar_month',
    title: 'الأجندة المدرسية',
    body: 'من الصفحة الرئيسية اضغط على «الأجندة المدرسية» لرؤية العطل الرسمية، فترات الاختبارات، والأحداث المهمة بعرض سنوي وشهري — متاحة للجميع بلا تسجيل دخول. المدير يضيف الأحداث وعدّلها من لوحته.'
  },
  {
    icon: 'family_restroom',
    title: 'الولي',
    body: 'تابع نتائج وغيابات أبنائك، قدّم طلبات تسجيل تلميذ جديد، وراجع الرسائل والتنبيهات من المدرسة.'
  },
  {
    icon: 'school',
    title: 'التلميذ',
    body: 'ادخل فضاءك لرؤية جدولك الأسبوعي، الاختبارات، النتائج، والمصادر التعليمية حسب مستواك.'
  },
  {
    icon: 'Record_Voice_Over',
    title: 'الأستاذ',
    body: 'حرّر جداول أقسامك، أنشئ الاختبارات والفروض، وأرسل مذكرات وبطاقات التقويم إلى تلاميذك.'
  },
  {
    icon: 'admin_panel_settings',
    title: 'مدير المدرسة',
    body: 'صادق على طلبات تسجيل التلاميذ، نظّم الأقسام، عدّل الأجندة المدرسية، وتابع إحصاءات المؤسسة.'
  },
  {
    icon: 'help',
    title: 'الدعم',
    body: 'لأي مشكلة تواصل مع الإدارة عبر البريد ensp75882@education.tn أو الهاتف +216 96 035 997، أو افتح صفحة «المساعدة».'
  }
];

export default function UserGuide() {
  const { t } = useI18n();
  return (
    <div className="container" style={{ padding: '2.5rem 1rem 3rem' }}>
      <div className="panel-head">
        <h2>{t('footer.userGuide')}</h2>
        <p className="muted">دليل سريع لاستعمال منصة رفيقي للحياة المدرسية.</p>
      </div>

      <div className="cards-grid">
        {SECTIONS.map((s) => (
          <div key={s.title} className="card-item">
            <div className="panel-head" style={{ marginBottom: '0.6rem' }}>
              <span className="material-icons" style={{ color: 'var(--primary)', fontSize: '1.8rem' }}>{s.icon}</span>
            </div>
            <h4>{s.title}</h4>
            <p className="muted">{s.body}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
        <Link to="/register" className="btn btn-primary">
          <span className="material-icons">person_add</span> إنشاء حساب
        </Link>
        <Link to="/agenda" className="btn btn-outline">
          <span className="material-icons">calendar_month</span> الأجندة المدرسية
        </Link>
        <Link to="/help" className="btn btn-ghost">
          <span className="material-icons">help</span> المساعدة
        </Link>
      </div>
    </div>
  );
}
