# Admin Manual Test - First Run

الملف ده هو النسخة القابلة للمشاركة مع أول شخص سيجرب السيستم.  
هو مبني على الـ docs المعتمدة والكود الحالي والـ seed fixtures الموجودة داخل المشروع.

## قبل ما تبدأ

- ابدأ من `/login`.
- استخدم حساب `admin@examops.local`.
- كلمة المرور الحالية في هذه البيئة: `ChangeMe123!`.
- لو قيمة `SEED_APP_USERS_PASSWORD` اتغيرت داخل `.env` بعد كتابة الملف ده، استخدم القيمة الحالية هناك.
- هذا الدليل يفترض قاعدة بيانات معمول لها `migrate` و `seed` حديث.
- لا تضغط `Operational Reset` من `/settings` أثناء أول مرور.

## الـ seed fixtures المعتمد عليها

- Cycle: `FINAL-VALIDATION-2026`
- الاسم: `دورة تشغيل EST يناير 2026 / EST January 2026 Operations Cycle`
- Session 1: `جلسة EST1 الجمعة / Friday EST1 Session`
  - التاريخ: `2026-03-18`
  - الحالة: `COMPLETED`
- Session 2: `جلسة EST2 السبت / Saturday EST2 Session`
  - التاريخ: `2026-03-24`
  - الحالة: `SCHEDULED`
- Session 3: `جلسة ASSN التحقق / Locked ASSN Validation Session`
  - التاريخ: `2026-03-26`
  - الحالة: `LOCKED`

## 1. Login

- افتح `/login`.
- سجّل بـ `admin@examops.local` و `ChangeMe123!`.
- اختياري: جرّب كلمة مرور غلط مرة واحدة ثم سجّل صح.
- بعد الدخول افتح `/dashboard` ثم افتح `/test` في tab ثانية.

النتيجة المتوقعة:

- التحويل يتم إلى `/dashboard`.
- لا يوجد `403` عند فتح `/sessions`, `/settings`, `/reports`, `/notifications`.
- لو كلمة السر غلط، تبقى في `/login` مع رسالة credentials منطقية.

## 2. Dashboard والـ shell

- راجع أن الـ dashboard يحمل من غير loading دائم أو server error.
- افتح `/team` ثم ارجع.
- استخدم الروابط السريعة للانتقال إلى `/sessions` و `/reports`.

النتيجة المتوقعة:

- التنقل بين الصفحات المحمية شغال.
- الـ layout ثابت ومافيش كسر UI واضح.

## 3. Master Data sanity check

### `/locations`

- تأكد أن hierarchy المواقع موجودة: Governorate -> University -> Building -> Floor -> Room.
- راجع تحديداً وجود:
  - `NASR_HQ`
  - `ABBAS_ANNEX`
  - `GIZA_ENG`
  - `ASSN Control Room`

### `/proctors`

- ابحث عن:
  - `Heba Samir / هبة سامر`
  - `Rania Mohamed / رانيا محمد`
  - `Amal Ali / أمل علي`
- افتح profile كامل لمستخدم واحد على الأقل.
- `Amal Ali` لازم تظهر `TEMPORARY` block حتى `2026-04-01`.

### `/settings/import-templates`

- نزّل template واحد وsample واحد على الأقل.

النتيجة المتوقعة:

- hierarchy المواقع كاملة.
- بيانات الـ proctors تظهر مع governorate / rating / sessions / block status.
- downloads تعمل.

## 4. Cycles و Sessions

### `/cycles`

- ابحث عن cycle الكود بتاعها `FINAL-VALIDATION-2026`.

### `/sessions`

- تأكد أن الجلسات الثلاث seeded موجودة:
  - `Friday EST1 Session` - `COMPLETED`
  - `Saturday EST2 Session` - `SCHEDULED`
  - `Locked ASSN Validation Session` - `LOCKED`
- افتح session detail لـ `Saturday EST2 Session`.
- تأكد أن روابط:
  - `Assignments`
  - `Waiting List`
  - `Swaps`
  موجودة.
- افتح session detail لـ `Friday EST1 Session` وتأكد أن `Evaluations` متاحة.

ملاحظة:

- في أول مرور سنحوّل `EST2` فقط من `SCHEDULED` إلى `LOCKED`.
- لا تحاول إجبارها إلى `IN_PROGRESS` قبل وقتها الحقيقي في `2026-03-24`.

## 5. Assignments على Session EST2

المسار:

- `/sessions`
- افتح `Saturday EST2 Session`
- ادخل `Assignments`

راجع أولاً وجود seeded assignments:

- `Mahmoud Salah / محمود صلاح` كـ building head في `ABBAS_ANNEX`
- `Mariam Nabil / مريم نبيل` كـ room proctor في `ABBAS_ANNEX / First Floor / Room 201`
- `Nora Gamal / نورا جمال` كتوزيع manual في `NASR_HQ / Second Floor / Room A201`
- `Tarek Hassan / طارق حسن` كتوزيع `CANCELLED`

ثم نفّذ:

- اضغط `Auto dry run` ثم `Rerank dry run` فقط.
- أضف manual assignment جديدة:
  - user: `Rania Mohamed / رانيا محمد`
  - role: `room_proctor`
  - building: `NASR_HQ`
  - floor: `Second Floor`
  - room: `Room A201`
  - note: `manual first-run validation`
- بعد الحفظ تأكد أن السجل ظهر كـ `MANUAL`.
- جرّب بعدها نفس الفورم بالمستخدم `Amal Ali / أمل علي`.

النتيجة المتوقعة:

- dry runs تشتغل من غير crash.
- assignment جديدة لـ `Rania Mohamed` تظهر.
- محاولة توزيع `Amal Ali` تترفض لأن عليها temporary block.

## 6. Waiting List و Swaps على Session EST2

### Waiting List

راجع seeded entries:

- `Heba Samir / هبة سامر` = `WAITING`
- `Nora Gamal / نورا جمال` = `PROMOTED`
- `Tarek Hassan / طارق حسن` = `REMOVED`

أضف entry جديدة:

- user: `Hala Salah Hamed Attia / هالة صلاح حامد عطية`
- building: `ABBAS_ANNEX`
- role: `room_proctor`
- entrySource: `manual_test`
- reason: `first run validation`

### Swaps

نفّذ waiting-list replacement:

- assignment: assignment الخاصة بـ `Mariam Nabil` في `ABBAS_ANNEX / Room 201`
- waiting entry: `Heba Samir`
- اترك `demote current assignee` مفعّل

بعدها نفّذ manual replacement:

- assignment: assignment التي أنشأتها لـ `Rania Mohamed`
- replacement user: `Ahmed Adel Wahba / أحمد عادل وهبة`

النتيجة المتوقعة:

- `Heba Samir` تتحول من waiting list إلى assignment.
- `Mariam Nabil` ترجع waiting list.
- assignment اليدوية تنتقل من `Rania Mohamed` إلى `Ahmed Adel Wahba`.

## 7. Lock ثم Attendance على Session EST2

- ارجع إلى `/sessions`.
- غيّر `Saturday EST2 Session` من `SCHEDULED` إلى `LOCKED`.
- افتح session detail ثم `Attendance`.

نفّذ الآتي:

- ابحث عن assignment الخاصة بـ `Heba Samir` الناتجة من swap.
- غيّر status إلى `ABSENT`.
- أضف note مثل `manual first-run absence`.
- اضغط `Load suggestions`.
- اختر replacement مثل `Mariam Nabil` أو `Hala Salah Hamed Attia`.
- احفظ.
- بعد ذلك اختر assignment أخرى مثل `Mahmoud Salah` أو `Ahmed Adel Wahba` وغيّرها إلى `CONFIRMED`.

النتيجة المتوقعة:

- session status تتغير إلى `LOCKED`.
- replacement من waiting list يشتغل.
- record الـ `CONFIRMED` يملأ `checkedInAt`.

ملاحظة:

- لو suggestions طلعت فاضية، ارجع لخطوة waiting list لأن لازم يبقى فيه WAITING entry متوافقة.

## 8. Evaluations على Session EST1 المكتملة

المسار:

- `/sessions`
- افتح `Friday EST1 Session`
- ادخل `Evaluations`

نفّذ:

- أنشئ evaluation جديدة لـ `Mahmoud Salah / محمود صلاح` بدرجة `4.6`.
- عدّل evaluation `Salma Hany / سلمى هاني` بدرجة جديدة مثل `4.4` أو note جديدة.
- راجع row تم تقييمها من actor آخر مثل `Mariam Nabil` وتأكد أنه لا يوجد تعديل غير منطقي.

النتيجة المتوقعة:

- إنشاء evaluation جديد ينجح.
- evaluation الخاصة بـ `Salma Hany` تتحدث لأن الـ admin هو evaluator الأصلي.
- الصفوف التي تخص evaluator آخر لا تسمح بتعديل خاطئ.

## 9. Reports و Notifications و Settings

### Reports

- افتح `/reports`.
- افتح session detail الخاصة بـ `Friday EST1 Session` وانسخ الـ `sessionId` من الـ URL.
- في `Attendance Report` أدخل `sessionId` الخاص بـ EST1.
- لازم baseline attendance تكون:
  - `3 CONFIRMED`
  - `1 ABSENT`
  - `1 DECLINED`
- في `Evaluations Report` استخدم نفس `sessionId` وتأكد أن التقييم الجديد أو المعدل ظاهر.
- اختياري: استخدم `Assignments Report` على session `EST2` بعد نسخ الـ id الخاص بها.

### Notifications

- افتح `/notifications`.
- راجع أن in-app notifications جديدة ظهرت بعد assignment / swap / attendance / evaluation operations.

### Notification Preferences

- افتح `/settings/notifications`.
- اقفل قناة واحدة ثم ارجع فعّلها مرة ثانية.

### Settings

- افتح `/settings`.
- تأكد أن بطاقة `Operational Reset` ظاهرة للـ super admin.
- لا تضغطها.

## 10. Optional Admin API Checks

نفّذها من DevTools Console وأنت logged in:

### Promotion Suggestions

```js
await fetch('/api/promotion/suggestions?limit=5', {
  credentials: 'same-origin'
}).then((response) => response.json())
```

### WhatsApp Test

```js
await fetch('/api/notifications/whatsapp/test', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+201099110106',
    locale: 'ar',
    type: 'manual_test',
    title: { ar: 'اختبار واتساب', en: 'WhatsApp test' },
    body: { ar: 'رسالة اختبار من صفحة /test', en: 'Test message from /test page' }
  })
}).then((response) => response.json())
```

### SMS Test

```js
await fetch('/api/notifications/sms/test', {
  method: 'POST',
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phoneNumber: '+201099110106',
    locale: 'en',
    type: 'manual_test',
    title: { ar: 'اختبار SMS', en: 'SMS test' },
    body: { ar: 'رسالة اختبار', en: 'Test SMS from /test page' }
  })
}).then((response) => response.json())
```

ملاحظات:

- لو WhatsApp أو SMS غير configured في البيئة، فـ provider-disabled أو configuration error نتيجة متوقعة.
- إدارة الـ blocks موجودة API-only حالياً، لذلك لا تستخدمها في first run إلا لو عندك سبب واضح.

## Sign-off Checklist

- login ناجح بحساب `admin@examops.local`
- dashboard والتنقل العام شغال
- locations / proctors / import templates شغالين
- cycle `FINAL-VALIDATION-2026` والجلسات الثلاث موجودين
- manual assignment نجحت وblocked-user validation اشتغلت
- waiting list + swap flow اشتغل
- session `EST2` اتقفلت وattendance اتسجل مع replacement
- evaluation create + update اشتغلوا على `EST1`
- reports وnotifications وsettings انعكس عليهم التعديل
- لم تظهر أخطاء `500` أو white screens أثناء الرحلة كاملة
