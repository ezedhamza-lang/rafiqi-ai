# المرحلة 5.3 — الإشعارات الموحدة + مركز الرسائل (مكتملة)

تاريخ الإنجاز: 2026-08-15

## النطاق
نظام إشعارات متعدد القنوات (داخل المنصة + فوري عبر WebSocket + بريد إلكتروني + SMS اختياري) مع مركز رسائل داخلي موحّد يجمع: الإعلانات الصادرة من الإدارة، الإشعارات، والمراسلات المباشرة.

## ما تم تنفيذه

### قاعدة البيانات (Prisma — `prisma/schema.prisma`)
- `Notification`: حقول جديدة `channels` (Json)، `channelStatus` (Json)، `priority` (LOW/NORMAL/HIGH/URGENT)، `readAt`، `metadata`، `schoolAnnouncementId` (ربط بإعلان الإدارة).
- نموذج جديد `SchoolAnnouncement`: عنوان/نص/فئة/أولوية/جمهور (Json)/مستوى دراسي/رابط/حالة/الناشر.
- نموذج جديد `NotificationOutbox`: صندوق إرسال القنوات الخارجية (EMAIL/SMS) بحالة PENDING/SENT/FAILED.
- `User`: حقول تفضيلات القنوات `notifyEmail` (افتراضي false)، `notifyPush` (افتراضي true)، `notifySms` (افتراضي false).
- تهجيرة: `20260815110500_notifications_message_center`.

### Backend — الخدمات
- `src/services/notificationChannels.js` — مزوّدا قنوات قابلان للتبديل:
  - البريد: `DEMO` (افتراضي، يُسجَّل ويُخزَّن في الـ Outbox) أو `SMTP` عبر `nodemailer` عند ضبط `NOTIFICATION_EMAIL_PROVIDER=SMTP` و`SMTP_HOST/...`.
  - SMS: `DEMO` (اختياري) — منصة التبديل جاهزة لأي مزوّد مستقبلاً.
- `src/services/notify.js` — أُعيد بناءه مع الحفاظ على نفس التوقيع (`notify`, `notifyRole`):
  - القنوات الفعلية لكل مستخدم تُحسب من تفضيلاته (IN_APP دائمًا، PUSH إن مفعّل، EMAIL/SMS إن مفعّلة والمنصة مفعّلة).
  - دفع فوري عبر WS: `notification:new` + `notification:unread`.
  - إنشاء سجلات الـ Outbox وتحديث حالتها (SENT/FAILED).
  - دوال: `getUnreadCount`, `markAllRead`, `markRead`.
- `src/services/announcementService.js` — إصدار الإعلان + تحديد الجمهور حسب الأدوار (`ALL/STUDENT/PARENT/TEACHER/DIRECTOR/ADMIN`) وفلترة المستوى الدراسي للتلاميذ، ثم `notify` للمستفيدين برابط `/message-center`.

### Backend — المسارات
- `src/routes/notifications.js` (يُركَّب على `/api/notifications`):
  - `GET /` — قائمة الإشعارات (مصفحة + فلتر نوع).
  - `GET /unread-count` — عدّاد غير المقروء.
  - `GET/PUT /preferences` — تفضيلات القنوات.
  - `GET /announcements` — إعلانات الإدارة الواصلة للمستخدم.
  - `POST /read` — تعليم الكل/قائمة محددة كمقروء.
  - `POST /:id/read` — قراءة إشعار واحد.
- `src/routes/announcements.js` (يُركَّب على `/api/director/announcements` — للمدير/الإدارة فقط):
  - `POST /` — إصدار إعلان (يتحقق من الصلاحية والتحقق من البيانات).
  - `GET /` — قائمة كل الإعلانات مع عدد الواصلين.
  - `GET /audience-count` — معاينة عدد المستفيدين.
- مفعّلة في `src/index.js`؛ Swagger: tag `notifications` + وثائق `director/announcements`.
- جميع استدعاءات `notify()` السابقة (رسائل، تكليفات، تصحيح، مدفوعات، حضور، حصص...) بقيت متوافقة تمامًا.

### Frontend
- `src/context/NotificationContext.jsx` — عدّاد غير المقروء، قائمة حديثة، اشتراك WS (`notification:new`/`notification:unread`)، قراءة/تعليم الكل، تفضيلات القنوات.
- `src/components/Header.jsx` — زر جرس إشعارات يعمل مع شارة العدد وقائمة منسدلة (آخر 6 إشعارات + رابط «عرض كل الإشعارات»)، وتبويب «الإشعارات» في تنقّل كل الأدوار (بما فيها التلميذ).
- `src/pages/MessageCenter.jsx` — صفحة **مركز الرسائل** بثلاثة أقسام:
  1. **الإشعارات**: قائمة كاملة + فلتر + قراءة فردية/جماعية + تفضيلات القنوات.
  2. **الإعلانات**: قائمة إعلانات الإدارة + **نموذج إصدار إعلان** للمدير (فئة/أولوية/جمهور/مستوى/قنوات إضافية + معاينة عدد المستفيدين).
  3. **المراسلات**: ملخص المحادثات مع زر فتح المحادثة الكاملة `/messages`.
- `src/App.jsx`: مزوّد `NotificationProvider` + مسار `/message-center`.
- أنماط CSS جديدة في `frontend/src/styles/index.css` (`.notif-*`, `.ann-item`, `.check-group`, `.message-center`...).

## الاختبارات
- ملف جديد: `backend/tests/notifications.test.js` — 11 اختبارًا تغطي:
  1. إعلان من الإدارة يصل التلاميذ والأولياء والأساتذة كإشعار داخل المنصة.
  2. توجيه الجمهور (أساتذة فقط لا يصل للتلميذ/الولي).
  3. فلترة المستوى الدراسي (تلاميذ السنة الأولى دون الثانية).
  4. عدّاد غير المقروء + قراءة الكل.
  5. قراءة إشعار واحد لا يمس البقية.
  6. تفعيل البريد يولّد رسالة Outbox بحالة SENT عند وصول إشعار.
  7. توافق المسار الحالي: رسالة داخلية تُنشئ إشعارًا للمستلم.
  8. إعلانات مركز الرسائل تصل مع تفاصيلها.
  9. غير المدير لا يمكنه إصدار إعلانات (403).
  10. حساب عدد المستفيدين.
  11. مدير المدرسة يرى قائمة الإعلانات مع عدد الواصلين.
- النتيجة: **12 ملفًا / 135 اختبارًا ناجحًا**.
- Lint (backend): 0 أخطاء في الملفات الجديدة. Lint (frontend): 0 أخطاء. Build (frontend/Vite): ناجح.
- اختبار يدوي: إصدار إعلان → استلام التلميذ لإشعار داخل المنصة + دفع فوري عبر WS (`notification:new`/`notification:unread`).

## معايير القبول
- [x] إعلان يصدر من الإدارة (مدير مدرسة/مدير عام/نظامي) فيصل المستخدمين كإشعار داخل المنصة.
- [x] إشعارات فورية عبر WebSocket أثناء الاتصال.
- [x] قنوات بريد إلكتروني (SMTP/DEMO) وSMS (اختياري) مع تفضيلات لكل مستخدم.
- [x] مركز رسائل موحّد: الإعلانات + الإشعارات + المراسلات.
