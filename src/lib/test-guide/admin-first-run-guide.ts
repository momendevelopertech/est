export type ManualTestCodeSnippet = {
  label: string;
  code: string;
};

export type ManualTestSection = {
  id: string;
  title: string;
  route?: string;
  summary: string;
  fixtures?: string[];
  steps: string[];
  expected: string[];
  notes?: string[];
  snippets?: ManualTestCodeSnippet[];
};

export type ManualTestCard = {
  title: string;
  items: string[];
};

export type ManualTestGuide = {
  title: string;
  subtitle: string;
  intro: string;
  cards: ManualTestCard[];
  sections: ManualTestSection[];
  checklist: string[];
};

export const adminFirstRunGuide: ManualTestGuide = {
  title: "مانيوال تيست كامل لأول تشغيل للنظام",
  subtitle:
    "الدليل ده مبني على ترتيب الشغل الحقيقي الموجود في الكود: login ثم dashboard ثم master data ثم cycle/session ثم assignments ثم waiting list ثم swaps ثم lock ثم attendance ثم evaluations ثم reports والـ notifications.",
  intro:
    "الدليل ده مخصص لأول تجربة على قاعدة بيانات معمول لها seed حديث. امشِ عليه بحساب الـ admin حتى تكون كل الصلاحيات متاحة، وسجّل أي خطأ بالـ route والنص الظاهر على الشاشة قبل ما تكمل للخطوة اللي بعدها.",
  cards: [
    {
      title: "بيانات الدخول",
      items: [
        "ابدأ من `/login` وليس من `/test` لأن صفحة `/test` نفسها protected.",
        "حساب الاختبار الرئيسي: `admin@examops.local`.",
        "كلمة المرور الحالية في هذه البيئة: `ChangeMe123!`.",
        "لو قيمة `SEED_APP_USERS_PASSWORD` اتغيرت داخل `.env` استخدم القيمة الحالية هناك."
      ]
    },
    {
      title: "الـ Seed Fixtures التي سنعتمد عليها",
      items: [
        "Cycle أساسي: `FINAL-VALIDATION-2026` باسم `دورة تشغيل EST يناير 2026 / EST January 2026 Operations Cycle`.",
        "جلسة مكتملة: `جلسة EST1 الجمعة / Friday EST1 Session` بتاريخ `2026-03-18` وحالتها `COMPLETED`.",
        "جلسة تشغيل قبل التنفيذ: `جلسة EST2 السبت / Saturday EST2 Session` بتاريخ `2026-03-24` وحالتها `SCHEDULED`.",
        "جلسة مقفولة: `جلسة ASSN التحقق / Locked ASSN Validation Session` بتاريخ `2026-03-26` وحالتها `LOCKED`."
      ]
    },
    {
      title: "قواعد الأمان أثناء الاختبار",
      items: [
        "هذا الدليل يفترض First Run على data نظيفة؛ لو حد جرّب قبلك قد تختلف الأعداد والأسماء المتوقعة.",
        "في أول مرور لا تضغط `Operational Reset` من `/settings` لأنه destructive.",
        "في صفحة assignments جرّب `Auto dry run` و `Rerank dry run` فقط في أول مرور، ولا تستخدم execute إلا لو ناوي تعيد التوزيع فعلاً.",
        "لو خطوة محتاجة `sessionId` للـ reports، افتح session detail أولاً وانسخ الـ id من الـ URL."
      ]
    }
  ],
  sections: [
    {
      id: "login",
      title: "1. تسجيل الدخول وبداية الـ protected flow",
      route: "/login",
      summary:
        "نبدأ من الـ public entry point ونتأكد أن auth session تتكون بشكل صحيح وأن حساب الـ admin يدخل على كل الصفحات المحمية.",
      steps: [
        "افتح `/login` وسجّل بـ `admin@examops.local` و `ChangeMe123!`.",
        "اختياري كـ negative check: جرّب كلمة مرور غلط مرة واحدة ثم سجّل بالطريقة الصحيحة.",
        "بعد نجاح الدخول افتح `/dashboard` ثم افتح `/test` في tab ثانية حتى تقدر ترجع للدليل بسهولة.",
        "تأكد أن `/sessions` و `/settings` و `/reports` و `/notifications` تفتح من غير `403` أو redirect غير متوقع."
      ],
      expected: [
        "النجاح يحولك إلى `/dashboard` مع session فعالة.",
        "فشل كلمة السر يتركك في `/login` مع رسالة `invalid credentials` أو رسالة تعادلها.",
        "حساب الـ admin يقدر يفتح كل صفحات الإدارة المستخدمة في هذا الدليل."
      ],
      notes: [
        "لو صفحة login فشلت تماماً فالمشكلة غالباً auth / database / env وليست مشكلة UI فقط.",
        "بما أن صفحة `/test` protected، فهي مرجع بعد تسجيل الدخول وليست بديلاً عن خطوة login."
      ]
    },
    {
      id: "dashboard",
      title: "2. مراجعة الـ dashboard والـ shell العام",
      route: "/dashboard",
      summary:
        "الهدف هنا التأكد أن الـ app shell شغال: التنقل، البطاقات الرئيسية، والروابط السريعة للصفحات التشغيلية.",
      steps: [
        "راجع أن الـ dashboard يحمل البطاقات الرئيسية بدون loading دائم أو خطأ server.",
        "استخدم الروابط السريعة للوصول إلى `/sessions` و `/reports` و `/test`.",
        "افتح `/team` للتأكد أن صفحة role matrix تظهر بشكل read-only ثم ارجع للـ dashboard.",
        "راجع أن تغيير اللغة أو الثيم - لو جربته - لا يكسر التنقل أو الـ layout."
      ],
      expected: [
        "الـ dashboard يعرض البيانات الأساسية بسرعة ومن غير كسر في الـ layout.",
        "التنقل بين الصفحات المحمية يتم من غير فقدان الجلسة.",
        "صفحة `/team` تظهر كمصدر مرجعي للأدوار وليست workflow تشغيلية."
      ],
      notes: [
        "أي كسر مبكر في الـ navigation غالباً سيؤثر على بقية الدليل، فاعتبره blocker أساسي.",
        "لو التطبيق يفتح بالواجهة العربية فهذا متوافق مع الـ seed الافتراضي لحساب admin."
      ]
    },
    {
      id: "master-data",
      title: "3. sanity check على البيانات المرجعية",
      route: "/locations",
      summary:
        "قبل ما ندخل في التشغيل لازم نتأكد أن hierarchy المواقع والـ proctors والـ import/export utilities كلها سليمة.",
      fixtures: [
        "`NASR_HQ / مبنى هندسة الشيراتون A`",
        "`ABBAS_ANNEX / مبنى صيدلة أبو قير`",
        "`GIZA_ENG / مبنى A سمارت فيلدج`",
        "`ABBAS_ANNEX_AS1 / ASSN Control Room`",
        "`Heba Samir / هبة سامر`",
        "`Rania Mohamed / رانيا محمد`",
        "`Amal Ali / أمل علي`"
      ],
      steps: [
        "في `/locations` تأكد أن hierarchy يظهر Governorate -> University -> Building -> Floor -> Room، وابحث تحديداً عن `NASR_HQ` و `ABBAS_ANNEX` و `GIZA_ENG` وعن غرفة `ASSN Control Room`.",
        "راجع أن الـ buildings والفصول والغرف تظهر بأسماء عربية وإنجليزية سليمة ومن غير duplicates واضحة.",
        "انتقل إلى `/proctors` وابحث عن `Heba Samir` و `Rania Mohamed` و `Amal Ali`.",
        "افتح profile كامل لأي واحد منهم وتأكد أن الإحصائيات وبيانات governorate والـ block status تظهر.",
        "بالذات `Amal Ali / أمل علي` لازم تظهر `TEMPORARY` block ممتد حتى `2026-04-01`.",
        "من `/proctors` افتح import modal و export modal فقط للتأكد أن النماذج والخيارات تظهر.",
        "من `/settings/import-templates` نزّل على الأقل template واحد و sample واحد وتأكد أن download يعمل."
      ],
      expected: [
        "شجرة المواقع كاملة وتحتوي على الـ seed buildings والغرف المستخدمة في الـ sessions.",
        "Directory الـ proctors يعرض block status وsessions count وrating بشكل صحيح.",
        "صفحـة الـ profile تعرض assignments / attendance / evaluations / blocks لو فيه data.",
        "تحميل import templates والـ sample files يعمل بدون error."
      ],
      notes: [
        "لو hierarchy المواقع ناقصة ستفشل لاحقاً صفحات assignments وsessions وreports.",
        "وجود `Amal Ali` كـ temporarily blocked مهم لأننا سنستخدمها لاحقاً في negative validation."
      ]
    },
    {
      id: "cycles-sessions",
      title: "4. مراجعة الـ cycle والـ sessions قبل التشغيل",
      route: "/sessions",
      summary:
        "هنا نتأكد أن الـ seed cycle والجلسات الثلاث موجودة بالحالات والتواريخ المتوقعة، وأن session detail يفتح الـ workspaces الفرعية الصحيحة.",
      fixtures: [
        "`FINAL-VALIDATION-2026`",
        "`Friday EST1 Session / جلسة EST1 الجمعة` - `2026-03-18` - `COMPLETED`",
        "`Saturday EST2 Session / جلسة EST2 السبت` - `2026-03-24` - `SCHEDULED`",
        "`Locked ASSN Validation Session / جلسة ASSN التحقق` - `2026-03-26` - `LOCKED`"
      ],
      steps: [
        "افتح `/cycles` وابحث عن الـ cycle صاحب الكود `FINAL-VALIDATION-2026` ثم افتح تفاصيله لو احتجت تتأكد من الاسم الكامل.",
        "افتح `/sessions` وتأكد أن الجلسات الثلاث أعلاه موجودة في القائمة.",
        "راجع أن الـ badges تعرض الـ stored status والـ derived status بشكل منطقي.",
        "افتح session detail الخاصة بـ `Saturday EST2 Session` وتأكد أن روابط `Assignments`, `Waiting List`, و `Swaps` تظهر.",
        "افتح session detail الخاصة بـ `Friday EST1 Session` وتأكد أن رابط `Evaluations` متاح.",
        "راجع من نفس القائمة أن الانتقال `SCHEDULED -> LOCKED` هو الانتقال الطبيعي المتاح للجلسة `EST2` في تاريخ `2026-03-24`."
      ],
      expected: [
        "الـ cycle active ويظهر باسمه العربي والإنجليزي.",
        "الجلسات الثلاث تحمل تواريخ `2026-03-18` و `2026-03-24` و `2026-03-26` كما في الـ seed.",
        "Session detail يعرض counts وروابط workspaces المناسبة لكل حالة."
      ],
      notes: [
        "الانتقالات الزمنية في sessions مربوطة بوقت البداية والنهاية الحقيقي، لذلك في هذه الجولة سنغلق `EST2` فقط ولن نحاول إجبارها إلى `IN_PROGRESS` قبل `2026-03-24`.",
        "لو اختفت أي session من القائمة راجع include inactive أو filters قبل اعتبارها bug."
      ]
    },
    {
      id: "assignments",
      title: "5. اختبار التوزيع اليدوي والـ validation في Session EST2",
      route: "/sessions -> Saturday EST2 Session -> Assignments",
      summary:
        "نستخدم جلسة `EST2` وهي ما زالت قبل التنفيذ لاختبار dry runs، مشاهدة التوزيعات الحالية، ثم إضافة manual assignment وتجربة blocked-user validation.",
      fixtures: [
        "`Mahmoud Salah / محمود صلاح` كـ building head داخل `ABBAS_ANNEX`",
        "`Mariam Nabil / مريم نبيل` كـ room proctor داخل `ABBAS_ANNEX / First Floor / Room 201`",
        "`Nora Gamal / نورا جمال` كتوزيع manual داخل `NASR_HQ / Second Floor / Room A201`",
        "`Tarek Hassan / طارق حسن` كتوزيع `CANCELLED`"
      ],
      steps: [
        "ادخل صفحة assignments الخاصة بـ `Saturday EST2 Session`.",
        "راجع أن السجلات الأساسية الأربعة أعلاه موجودة وأن status/method ظاهرين.",
        "اضغط `Auto dry run` ثم `Rerank dry run` فقط وتأكد أن الصفحة لا تنهار.",
        "في manual assignment أنشئ توزيع جديد للمستخدم `Rania Mohamed / رانيا محمد`.",
        "اختَر role `room_proctor`, building `NASR_HQ`, floor `Second Floor`, room `Room A201`, واكتب note مثل `manual first-run validation`.",
        "بعد الحفظ تأكد أن التوزيع الجديد ظهر كـ `MANUAL`.",
        "جرّب بعدها نفس الفورم بالمستخدم `Amal Ali / أمل علي` مع أي role مناسب ثم احفظ.",
        "تأكد أن العملية الثانية تترفض برسالة منطقية لأن المستخدم عليه temporary block حتى `2026-04-01`."
      ],
      expected: [
        "القائمة تعرض التوزيعات الحالية وتسمح بالـ dry runs بدون crash.",
        "يظهر توزيع جديد لـ `Rania Mohamed` في `NASR_HQ / Second Floor / Room A201`.",
        "محاولة توزيع `Amal Ali` تفشل ولا تضيف assignment جديد."
      ],
      notes: [
        "في أول مرور تجنّب `Auto execute` و `Rerank execute` لأنهما يغيّران بيانات الجلسة نفسها.",
        "لو الـ lock validation يعرض issues فدوّنها، لكنها لا تمنعنا من إكمال بقية الدليل ما لم تمنع الـ UI نفسه."
      ]
    },
    {
      id: "waiting-swaps",
      title: "6. اختبار الـ waiting list والـ swaps على نفس الجلسة",
      route: "/sessions -> Saturday EST2 Session -> Waiting List / Swaps",
      summary:
        "بعد التوزيع اليدوي نكمل نفس الـ flow الطبيعي: مراجعة queue الحالية، إضافة entry جديدة، ثم تجربة waiting-list replacement وmanual replacement.",
      fixtures: [
        "`Heba Samir / هبة سامر` بحالة `WAITING` وأولوية `1`",
        "`Nora Gamal / نورا جمال` بحالة `PROMOTED`",
        "`Tarek Hassan / طارق حسن` بحالة `REMOVED`",
        "`Hala Salah Hamed Attia / هالة صلاح حامد عطية` كمستخدم سنضيفه يدويًا"
      ],
      steps: [
        "من صفحة waiting list راجع أولاً entries الـ seed الثلاثة وتأكد من statuses المذكورة.",
        "أضف entry جديدة للمستخدم `Hala Salah Hamed Attia` على building `ABBAS_ANNEX` ودور `room_proctor`، واجعل `entrySource` مثل `manual_test` وreason مثل `first run validation`.",
        "انتقل إلى صفحة swaps الخاصة بنفس الجلسة.",
        "في `Waiting list replacement` اختَر assignment الخاص بـ `Mariam Nabil` داخل `ABBAS_ANNEX / Room 201`.",
        "اختَر waiting entry الخاصة بـ `Heba Samir`، واترك `demote current assignee` مفعّل ثم نفّذ العملية.",
        "بعد نجاح العملية راجع أن `Heba Samir` أصبحت assigned وأن `Mariam Nabil` رجعت إلى waiting list.",
        "في `Manual replacement` اختَر assignment الذي أنشأته قبل قليل لـ `Rania Mohamed`.",
        "اختَر replacement user `Ahmed Adel Wahba / أحمد عادل وهبة` ثم نفّذ العملية من غير manual override.",
        "راجع صفحة assignments مرة ثانية للتأكد أن `Ahmed Adel Wahba` أخذ نفس المكان وأن `Rania Mohamed` لم تعد assignee عليه."
      ],
      expected: [
        "الـ waiting list تعرض seeded entries ثم entry جديدة لـ `Hala Salah Hamed Attia`.",
        "عملية waiting-list replacement تنقل `Heba Samir` من queue إلى assignment وتعيد `Mariam Nabil` إلى WAITING.",
        "عملية manual replacement تبدّل assignee على التوزيع اليدوي من `Rania Mohamed` إلى `Ahmed Adel Wahba`."
      ],
      notes: [
        "لو replacement فشل بسبب role/building mismatch فراجع أنك اخترت assignment عباس المناسب وwaiting entry الموافقة لنفس الـ role/building.",
        "الـ swaps الصفحة تحمل assignments غير الملغاة وغير المكتملة فقط، لذلك لن ترى `Tarek Hassan` هناك."
      ]
    },
    {
      id: "lock-attendance",
      title: "7. غلق الجلسة ثم اختبار attendance وreplacement promotion",
      route: "/sessions -> Saturday EST2 Session -> Attendance",
      summary:
        "بعد الانتهاء من مرحلة التحضير نقفل جلسة `EST2` ثم نختبر attendance على نفس البيانات التي عدّلناها للتو، بما فيها replacement من waiting list.",
      steps: [
        "ارجع إلى `/sessions` وغيّر حالة `Saturday EST2 Session` من `SCHEDULED` إلى `LOCKED`.",
        "افتح session detail ثم ادخل إلى صفحة attendance الخاصة بنفس الجلسة.",
        "ابحث عن assignment الخاص بـ `Heba Samir` في `ABBAS_ANNEX` الناتج من swap الخطوة السابقة.",
        "غيّر status إلى `ABSENT` واكتب note مثل `manual first-run absence`.",
        "اضغط `Load suggestions` ثم اختر replacement مناسباً مثل `Mariam Nabil` أو `Hala Salah Hamed Attia` ثم احفظ.",
        "بعدها اختر assignment آخر طبيعي مثل `Mahmoud Salah` أو `Ahmed Adel Wahba` وغيّر حالته إلى `CONFIRMED` ثم احفظ.",
        "راجع أن `checkedInAt` اتملأ على الـ confirmed record وأن replacement اتعالج بدون error."
      ],
      expected: [
        "تتحول session بنجاح إلى `LOCKED` ويظهر workspace attendance.",
        "حفظ `ABSENT` يعمل، ومع replacement مناسب يتم ترقية البديل من waiting list.",
        "حفظ `CONFIRMED` يضيف `checkedInAt` timestamp.",
        "لا يبقى assignee الغائب active بنفس الصورة بعد replacement الناجح."
      ],
      notes: [
        "لو قائمة suggestions فارغة فمعناها مفيش waiting entry متوافقة؛ ارجع لخطوة waiting list قبل اعتبارها bug.",
        "attendance هنا مبني على نفس session `EST2` لأن stored status `LOCKED` يسمح بالوصول حتى قبل وقت البداية الفعلي."
      ]
    },
    {
      id: "evaluations",
      title: "8. تقييمات ما بعد الجلسة على Session EST1 المكتملة",
      route: "/sessions -> Friday EST1 Session -> Evaluations",
      summary:
        "التقييمات لا تشتغل منطقياً إلا على session بدأت بالفعل، لذلك سنستخدم جلسة `Friday EST1 Session` المكتملة لاختبار إنشاء evaluation جديد وتعديل evaluation موجود للـ admin نفسه.",
      fixtures: [
        "يوجد seed evaluations حالية لـ `Mariam Nabil`, `Khaled Atef`, `Youssef Adel`, و `Salma Hany`.",
        "`Mahmoud Salah` لا يملك evaluation seeded حالياً، لذلك هو أفضل candidate لاختبار create.",
        "`Salma Hany` عليها evaluation من `admin@examops.local`، لذلك هي أفضل candidate لاختبار update."
      ],
      steps: [
        "افتح evaluations الخاصة بـ `Friday EST1 Session`.",
        "راجع أن بعض الصفوف معلمة already evaluated وبعضها not evaluated.",
        "أنشئ evaluation جديدة لـ `Mahmoud Salah / محمود صلاح` بدرجة مثل `4.6` وملاحظة مثل `manual first-run review`.",
        "عدّل evaluation `Salma Hany / سلمى هاني` من نفس حساب admin بدرجة جديدة مثل `4.4` أو note محدثة ثم احفظ.",
        "راجع صفاً مقيمًا بواسطة actor آخر - مثل صف `Mariam Nabil` - وتأكد أن الصفحة لا تسمح للـ admin بكتابة over actor مختلف أو تعرض error منطقي لو حاول."
      ],
      expected: [
        "يتم إنشاء evaluation جديدة لـ `Mahmoud Salah` بنجاح.",
        "يتم تحديث evaluation `Salma Hany` لأن evaluator الأصلي هو نفس حساب admin.",
        "الصفوف التي يملكها evaluator مختلف لا تُكسر الصفحة ولا تسمح بتعديل غير صحيح."
      ],
      notes: [
        "لو التقييمات لا تظهر على جلسة مكتملة فهذه مشكلة business rule أو API وليست مجرد مشكلة UI.",
        "أي تحديث ناجح هنا لازم ينعكس لاحقًا في reports وprofile الخاص بالمستخدم."
      ]
    },
    {
      id: "reports-notifications-settings",
      title: "9. الـ reports والـ notifications والـ settings بعد التعديلات",
      route: "/reports",
      summary:
        "الآن نراجع إن كل التعديلات السابقة فعلاً انعكست على التقارير والـ notifications preferences والـ in-app inbox.",
      steps: [
        "افتح `/reports` ثم ادخل `Attendance Report` و `Evaluations Report`.",
        "افتح session detail الخاصة بـ `Friday EST1 Session` وانسخ الـ session id من الـ URL.",
        "في `Attendance Report` أدخل `sessionId` الخاص بـ EST1 وتأكد أن breakdown يطابق seed baseline: `3 CONFIRMED`, `1 ABSENT`, `1 DECLINED`.",
        "في `Evaluations Report` استخدم نفس `sessionId` وتأكد أن التقرير يعكس seed evaluations بالإضافة إلى أي evaluation جديدة أو updated عملتها في الخطوة السابقة.",
        "اختياري: افتح `Assignments Report` على `Saturday EST2 Session` بعد نسخ الـ session id الخاص بها وتأكد أن التوزيعات اليدوية والـ replacements ظهرت.",
        "افتح `/notifications` وراجع أن هناك in-app notifications جديدة مرتبطة بالـ assignment / waiting list / attendance / evaluation flows التي نفذتها.",
        "افتح `/settings/notifications` واغلق قناة واحدة مثل `in-app` أو `email` ثم أعد تفعيلها وتأكد من success state.",
        "افتح `/settings` وتأكد أن بطاقة `Operational Reset` ظاهرة لحساب الـ super admin، لكن لا تضغطها."
      ],
      expected: [
        "التقارير تحمل بدون 500 وتعرض breakdown منطقي.",
        "Attendance report لـ EST1 يعكس baseline seeded counts المذكورة.",
        "Notifications inbox يظهر events جديدة بعد العمليات التي تمت.",
        "Notification preferences تحفظ toggles بنجاح ثم يمكن إرجاعها كما كانت.",
        "صفحة settings تعرض operational reset كوظيفة admin فقط."
      ],
      notes: [
        "فلاتر التقارير تعتمد على raw ids وليس dropdowns، لذلك نسخ الـ id من الـ URL خطوة مقصودة في المنتج الحالي.",
        "لو inbox لم يستقبل أي شيء رغم نجاح العمليات، فهذه ملاحظة مهمة على triggers أو preferences حتى لو الـ CRUD نفسه نجح."
      ]
    },
    {
      id: "advanced-admin",
      title: "10. checks إضافية للـ super admin خارج الـ UI الأساسي",
      route: "/api/*",
      summary:
        "الجزء ده optional ومفيد لو عايز تطمّن على الخدمات الموجودة في الكود لكنها ليست exposed بواجهة كاملة داخل المنتج الحالي. نفّذ السطور التالية من DevTools Console وأنت logged in كـ admin.",
      steps: [
        "افتح أي صفحة محمية ثم افتح DevTools Console.",
        "نفّذ snippets الـ promotion وnotification tests واحدة واحدة.",
        "لو environment غير مهيأ فعلاً لـ WhatsApp أو SMS ففشل provider/disabled يعد نتيجة متوقعة وليس failure في الـ auth layer.",
        "بالنسبة للـ blocks، نفّذها فقط لو عندك userId واضح ولأنها mutate state فلا تُعتبر ضمن first-run الأساسي."
      ],
      expected: [
        "promotion suggestions ترجع JSON منظماً.",
        "اختبارات WhatsApp/SMS تمر عبر auth والvalidation layer وتُرجع إما success أو provider-disabled / configuration error منطقي.",
        "لا يوجد redirect إلى login أو HTML response بدل JSON."
      ],
      notes: [
        "ميزة promotion suggestions متاحة كـ GET على `/api/promotion/suggestions?limit=5`.",
        "إدارة الـ blocks موجودة في API فقط حالياً، لذلك استخدمها بحذر حتى لا تغيّر حالة مستخدم مطلوب في بقية الاختبار."
      ],
      snippets: [
        {
          label: "Promotion Suggestions",
          code: "await fetch('/api/promotion/suggestions?limit=5', {\n  credentials: 'same-origin'\n}).then((response) => response.json())"
        },
        {
          label: "WhatsApp Test Message",
          code: "await fetch('/api/notifications/whatsapp/test', {\n  method: 'POST',\n  credentials: 'same-origin',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    phoneNumber: '+201099110106',\n    locale: 'ar',\n    type: 'manual_test',\n    title: { ar: 'اختبار واتساب', en: 'WhatsApp test' },\n    body: { ar: 'رسالة اختبار من صفحة /test', en: 'Test message from /test page' }\n  })\n}).then((response) => response.json())"
        },
        {
          label: "SMS Test Message",
          code: "await fetch('/api/notifications/sms/test', {\n  method: 'POST',\n  credentials: 'same-origin',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    phoneNumber: '+201099110106',\n    locale: 'en',\n    type: 'manual_test',\n    title: { ar: 'اختبار SMS', en: 'SMS test' },\n    body: { ar: 'رسالة اختبار', en: 'Test SMS from /test page' }\n  })\n}).then((response) => response.json())"
        },
        {
          label: "Temporary Block Example",
          code: "await fetch('/api/blocks', {\n  method: 'POST',\n  credentials: 'same-origin',\n  headers: { 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    userId: '<USER_ID>',\n    type: 'TEMPORARY',\n    startsAt: '2026-03-22T10:00:00.000Z',\n    endsAt: '2026-03-29T10:00:00.000Z',\n    reason: 'manual test temporary block'\n  })\n}).then((response) => response.json())"
        }
      ]
    }
  ],
  checklist: [
    "يمكن تسجيل الدخول والخروج بحساب `admin@examops.local` بدون مشاكل auth.",
    "الـ dashboard والـ navigation والصفحات المرجعية (`locations`, `proctors`, `settings/import-templates`) كلها تعمل.",
    "الـ cycle `FINAL-VALIDATION-2026` والجلسات الثلاث seeded ظاهرة بالحالات الصحيحة.",
    "تمت مراجعة assignments على `Saturday EST2 Session` وإضافة manual assignment ناجح مع negative check blocked user.",
    "تمت مراجعة waiting list وإضافة entry جديدة ثم تنفيذ swap ناجح.",
    "تم تحويل `Saturday EST2 Session` إلى `LOCKED` وتسجيل attendance مع replacement suggestion ناجح.",
    "تم إنشاء evaluation جديدة على `Friday EST1 Session` وتحديث evaluation يخص نفس الـ admin.",
    "التقارير والـ notifications والـ notification preferences انعكس عليها ما تم في الخطوات السابقة.",
    "لم تظهر أخطاء `500`, `Unhandled`, أو صفحات بيضاء أثناء المرور الكامل."
  ]
};
