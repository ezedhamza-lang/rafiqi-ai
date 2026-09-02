# المرحلة 5.2 — تفاعلات الحصة الحية (مكتملة)

تاريخ الإنجاز: 2026-08-15

## النطاق
دردشة حية خلال البث + رفع اليد + مشاركة شاشة، داخل الحصة المباشرة (مبنيّة على مخرجات المرحلة 5.1: LiveSession/LiveRecording + مزوّدا LOCAL وLIVEKIT).

## ما تم تنفيذه

### قاعدة البيانات (Prisma)
- نماذج جديدة: `LiveChatMessage`, `LiveRaisedHand`, `LiveScreenShare` في `prisma/schema.prisma`.
- علاقات جديدة في `User` و`LiveSession`.
- تهجيرة: `20260815101351_live_interactions` (منشورة على القاعدة الرئيسية والاختبارية).

### Backend — WebSocket (`src/ws.js`)
- خرائط `roomSockets`, `liveRaisedHands`, `liveScreenShares`.
- رسائل WS جديدة:
  - `live:chat` — إرسال رسالة دردشة (اقتطاع عند 500 حرف).
  - `live:raise-hand` — رفع/خفض اليد.
  - `live:screen-share` — بدء/إيقاف مشاركة الشاشة.
  - `live:presence` — تحديث حضور الغرفة.
- بث فوري للغرفة: `live:chat:new`, `live:raised-hands`, `live:screen-share`.
- تحقق `authorizeRoom` حسب الدور/القسم (رفض من لا ينتمي للقسم).
- `leaveRoom` يخفض اليد ويوقف الشاشة ويبث التحديث.
- دوال مساعدة: `getLiveRoomInteractions`, `lowerRaisedHand`, `stopScreenShare` (حالة DB عبر upsert).

### Backend — REST (`src/routes/liveSessions.js`)
- `GET /api/:space/live/:id/chat` — آخر 100 رسالة.
- `GET /api/:space/live/:id/interactions` — الأيدي المرفوعة ومشاركات الشاشة.
- `POST /api/teacher/live/:id/hand/:userId/lower` — خفض يد من الأستاذ.
- `POST /api/teacher/live/:id/screen/:userId/stop` — إيقاف مشاركة شاشة من الأستاذ.
- `requireRole(...TEACHER_ROLES)` + `validateParams(liveSessionUserParamSchema)`.
- `liveSessionUserParamSchema` جديد في `src/validators/liveSessions.js`.

### Backend — Misc
- `getVideoProviderInfo()` يعيد `supportsInteractions: { chat, raiseHand, screenShare }`.
- Swagger: tag `live-sessions` = «الحصص المباشرة وجدولتها وتفاعلاتها (المرحلة 5.1 + 5.2)».

### Frontend (`LiveRoom.jsx`)
- لوحة دردشة حية: WS + سجل REST + auto-scroll.
- زر رفع/خفض اليد.
- زر مشاركة/إيقاف شاشة (`getDisplayMedia` لـ LOCAL، `setScreenShareEnabled` لـ LIVEKIT).
- قائمة أعضاء الغرفة مع شارات اليد/الشاشة وأزرار تحكم الأستاذ (خفض اليد/إيقاف الشاشة عبر REST).
- أنماط CSS جديدة في `frontend/src/styles/components.css` (`.live-toolbar`, `.live-chat-*`, `.live-share-*`, `.live-badge-*`, `.badge-warning/info/accent`, `.btn-xs`).

## الاختبارات
- ملف جديد: `backend/tests/live-interactions.test.js` — 9 اختبارات تغطي:
  1. المزوّد يدعم التفاعلات.
  2. سجل دردشة فارغ.
  3. تلميذ خارج القسم مرفوض 403.
  4. رسالة عبر WS تُخزَّن في DB.
  5. اقتطاع الرسائل عند 500 حرف.
  6. رفع يد + تقرير تفاعلات + خفض من الأستاذ.
  7. مشاركة شاشة + إيقاف.
  8. مغادرة الغرفة تنظّف الحالة.
  9. رسالة لغير الغرفة تُرفض بـ `live:chat:error`.
- النتيجة: **11 ملفاً / 124 اختباراً ناجحاً**.
- Lint (backend): 0 أخطاء. Lint (frontend): 0 أخطاء. Build (frontend/Vite): ناجح.

## معايير القبول
- [x] تلميذ يرفع يده أثناء الحصة (WS + REST، وخفض من الأستاذ).
- [x] تلميذ يشارك شاشته (LOCAL وLIVEKIT).
- [x] دردشة حية أثناء البث (تخزين واسترجاع).
