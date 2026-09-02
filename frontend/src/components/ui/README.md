# نظام التصميم — بوابة رفيقي للحياة المدرسية

وثيقة استعمال مكتبة المكونات الموحدة (Design System) الخاصة بواجهة المنصة.

## البنية

```
src/
  styles/
    tokens.css       ← متغيرات التصميم (ألوان، مسافات، خطوط، ظلال، RTL)
    components.css   ← أنماط مكونات النظام (ui-*)
    overrides.css    ← الوضع الليلي + إمكانية الوصول + تحسينات الجوال
  components/
    ui/
      index.js       ← تصدير مركزي لكل المكونات
      Button.jsx     Card.jsx  Input.jsx  Select.jsx  Textarea.jsx
      Modal.jsx      Tabs.jsx  Badge.jsx  Table.jsx  Toast.jsx
      Spinner.jsx    Skeleton.jsx  Switch.jsx  EmptyState.jsx
      PointsCard.jsx Gamification.jsx (BadgeItem, BadgeCard, Leaderboard)
  context/
    ThemeContext.jsx ← الوضع الليلي/النهاري مع حفظ الاختيار في localStorage
```

## التثبيت في صفحة جديدة

```jsx
import { Button, Card, Input, Badge, useToast } from '../components/ui/index.js';

export default function MyPage() {
  const toast = useToast();
  return (
    <Card title="عنوان" icon="star">
      <Input label="الاسم" required placeholder="أدخل الاسم" />
      <Button onClick={() => toast.success('تم الحفظ بنجاح')}>حفظ</Button>
    </Card>
  );
}
```

## الوضع الليلي

- التبديل عبر زر القمر/الشمس في الهيدر (`Header`).
- الاختيار محفوظ في `localStorage` تحت مفتاح `rafiqi-theme`، ويُحترم تفضيل النظام عند أول زيارة.
- كل متغيرات `tokens.css` تُعرف مرتين: في `:root` (نهاري) وفي `[data-theme='dark']` (ليلي).
- أي لون جديد في المكونات يجب أن يُكتب عبر المتغيرات (لا ألوان صلبة داخل `components.css`).

### المتغيرات الأساسية

| المتغير | الوظيفة |
|---|---|
| `--primary` / `--primary-dark` / `--primary-light` | اللون الأساسي (Sky) |
| `--accent` / `--accent-dark` / `--accent-light` | اللون المميز (Amber) |
| `--bg` / `--surface` / `--bg-subtle` | خلفيات الصفحة / البطاقات / الخافتة |
| `--text` / `--text-secondary` / `--muted` | ألوان النصوص |
| `--border` / `--border-strong` | الحدود |
| `--green` / `--red` / `--yellow` / `--blue` + `-bg` / `-border` | ألوان الحالة |
| `--space-1..7`, `--radius-sm..full`, `--shadow`, `--z-*` | المسافات والزوايا والظلال والطبقات |

## المكونات المتاحة

### Button
| الخاصية | القيم |
|---|---|
| `variant` | `primary` (افتراضي)، `accent`، `outline`، `ghost`، `danger`، `success`، `subtle` |
| `size` | `sm`، `md`، `lg`، `block` |
| `loading` | يعرض حلقة تحميل ويعطّل الزر |
| `icon` | اسم أيقونة Material |
| `disabled` | يعطّل الزر |

### Card
`title`، `subtitle`، `icon`، `actions`، `hoverable` (true افتراضياً).

### Input / Textarea / Select
`label`، `error`، `hint`، `icon`، `required`. تظهر رسالة الخطأ مع `role="alert"`.

### Modal
`open`، `onClose`، `title`، `subtitle`، `icon`، `footer`، `size` (`sm|md|lg|xl`). يغلق بـ `Escape` أو النقر خارج النافذة.

### Tabs + TabPanel
`items=[{label, icon, value, count}]`، `active`، `onChange`.

### Badge
`variant`: `default|primary|success|danger|warning|info|accent`.

### Table
`columns=[{key, label, render, style}]`، `data`، `renderRow`، `loading`، `emptyText`.

### Toast (Provider)
لفّ التطبيق بـ `ToastProvider` ثم استعمل `useToast()`:
`toast.success(msg)`، `toast.error(msg)`، `toast.warning(msg)`، `toast.info(msg)`.

### Spinner / Skeleton
`Spinner({ size, label })`، `Skeleton({ width, height, variant })`، `SkeletonCard({ lines })`.

### Switch
`checked`، `onChange`، `label`.

### EmptyState
`icon`، `title`، `description`، `action`.

### Gamification
- `PointsCard({ icon, label, value, sub, color })`
- `BadgeItem({ badge, locked })` / `BadgeCard({ badge, locked })`
- `Leaderboard({ title, rows })` / `LeaderboardRow({ rank, name, points, avatar, current })`

## إمكانية الوصول (A11y)

- كل الأزرار الأيقونية تحمل `aria-label`، والحقول المقصودة مرتبطة بـ `label htmlFor`.
- النوافذ `role="dialog"` + `aria-modal` مع إغلاق بـ `Escape`.
- حلقة تركيز مرئية (`:focus-visible`) لكل العناصر.
- رابط "تخطَّ إلى المحتوى الرئيسي" أعلى الصفحة.
- `prefers-reduced-motion` محترمة (تقليل الحركة).

## الجوال

- شبكات البطاقات تصبح عمودية عند 480px، والأزرار ≥ 44px ارتفاعاً.
- الجداول قابلة للتمرير الأفقي داخل حاويات `table-wrap`.
- الهدف: جودة متساوية على عرض 375px و768px وأكبر.

## PWA

- `public/manifest.webmanifest` + `public/sw.js` + أيقونات في `public/icons/`.
- إستراتيجية SW: شبكة أولاً للـ `/api`، ذاكرة أولاً للأصول الثابتة (تخزين مؤقت آلي).
- تُسجَّل تلقائياً في `main.jsx`، مع دعم التشغيل دون اتصال للمحتوى المفتوح.
