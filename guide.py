# -*- coding: utf-8 -*-
"""يبني أدلة الاستخدام لكل صلاحية في docs/guide/ — الصور من tests/shots.js على بيانات تجريبية."""
import io, pathlib, html

root = pathlib.Path(__file__).parent
out = root / "docs" / "guide"
VERSION = "نوفمبر 2026"
SITE = "https://tiyb.saom.sa/"

GLYPH = '<g fill="#ceb26b"><path fill-rule="evenodd" d="M1655 53H1697V195H1830A115 115 0 0 1 1945 310A115 115 0 0 1 1830 425H1180A113 113 0 0 1 1067 312V240C1067 205 1050 184 1017 176L1029 133C1082 146 1110 185 1110 240V318A62 62 0 0 0 1172 380H1536V217H1578V380H1655ZM1697 238V310H1902A72 72 0 0 0 1830 238Z"/><path d="M1307 445l33 33-33 33-33-33zM1523 445l33 33-33 33-33-33zM1589 445l33 33-33 33-33-33z"/></g>'
LOGO = f'<svg viewBox="1000 36 962 492" xmlns="http://www.w3.org/2000/svg">{GLYPH}</svg>'
BADGE = f'<svg viewBox="952 0 1046 565" xmlns="http://www.w3.org/2000/svg"><rect x="952" width="1046" height="565" rx="62" fill="#563331"/>{GLYPH}</svg>'

# ───── عناصر المحتوى ─────
def P(t): return f"<p>{t}</p>"
def steps(*items): return "<ol class='steps'>" + "".join(f"<li><span>{i}</span></li>" for i in items) + "</ol>"
def bullets(*items): return "<ul class='pts'>" + "".join(f"<li>{i}</li>" for i in items) + "</ul>"
TIP_ICON = {"tip": "💡", "note": "ℹ️", "warn": "⚠️"}
def tip(t, kind="tip"):
    label = {"tip": "نصيحة", "note": "ملاحظة", "warn": "تنبيه"}[kind]
    return f"<div class='call {kind}'><i>{TIP_ICON[kind]}</i><div><b>{label}</b><span>{t}</span></div></div>"
def fig(img, cap, mobile=False):
    return (f"<figure class='shot{' mob' if mobile else ''}'><button class='zoom' type='button' aria-label='تكبير الصورة: {html.escape(cap)}'>"
            f"<img src='img/{img}.jpg' alt='{html.escape(cap)}' loading='lazy'><span class='zi'>⤢</span></button><figcaption>{cap}</figcaption></figure>")
def figs2(a, b): return f"<div class='pair'>{a}{b}</div>"
def table(head, rows): return "<table><thead><tr>" + "".join(f"<th>{h}</th>" for h in head) + "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</tbody></table>"

WORKFLOW = [
    ("1", "إدخال المسجد في القائمة المختارة", "مدير النظام"), ("2", "إسناد المسجد لجمعية مشرفة", "مدير النظام"),
    ("3", "استكمال بيانات المسجد (الحي، الإمام، المؤذن، الخادم)", "الجمعية"), ("4", "التواصل مع الإمام ورفع تقرير قابلية التطبيق", "الجمعية"),
    ("5", "دراسة احتياج الجامع ورفع التقرير", "الشركة المنفذة"), ("6", "اعتماد التركيب", "مدير النظام"),
    ("7", "التركيب ورفع تقرير التركيب", "الشركة المنفذة"), ("8", "الزيارات الأسبوعية", "الجمعية"),
    ("9", "قياس رضا المصلين عن العطر", "الجمعية"), ("10", "التقرير الشهري لأداء التعطير", "الجمعية"),
    ("11", "التعبئة الشهرية (مع تذكير آلي قبل ٧٢ ساعة)", "الشركة المنفذة"), ("12", "المتابعة والتقارير والمؤشرات", "الجميع"),
]
WHO_CLS = {"مدير النظام": "w-admin", "الجمعية": "w-assoc", "الشركة المنفذة": "w-co", "الجميع": "w-all"}
def workflow(mine):
    # مسار تفاعلي: خطوات صاحب الدليل مميزة، وزر لعرض خطواته فقط
    cards = "".join(f"<li class='wf-s {WHO_CLS[w]}{' me' if w in mine else ''}'><b class='wf-n'>{n}</b><div><span>{t}</span><small>{w}</small></div></li>" for n, t, w in WORKFLOW)
    return (f"<div class='wf'><div class='wf-bar'><button type='button' class='wf-t on' data-wf='all'>كل الخطوات</button>"
            f"<button type='button' class='wf-t' data-wf='me'>خطواتي فقط</button><span class='wf-k'><i class='me-dot'></i>خطوات صلاحيتك</span></div><ol class='wf-list'>{cards}</ol></div>")

def login_section(role_word):
    return ("الدخول وتفعيل الحساب", [
        P(f"يُنشئ مدير النظام حسابك ويرسل لك <b>رمز تفعيل</b> مع رابط المنصة عبر واتساب أو البريد. تفعّل الحساب مرة واحدة، ثم تدخل بعدها بالبريد وكلمة المرور."),
        steps(f"افتح رابط المنصة: <span class='ltr'>{SITE}</span>",
              "اختر تبويب <b>«تفعيل حساب جديد»</b>.",
              "اكتب بريدك الإلكتروني كما سجّله المدير، ورمز التفعيل المكوّن من ٨ خانات.",
              "اختر كلمة مرور من ٨ أحرف على الأقل، ثم اضغط <b>«تفعيل الحساب»</b> — تدخل المنصة مباشرة."),
        figs2(fig("login-up", "تفعيل حساب جديد برمز التفعيل"), fig("login", "الدخول المعتاد بالبريد وكلمة المرور")),
        tip("إذا نسيت كلمة المرور فاطلب من مدير النظام <b>«إعادة تعيين الدخول»</b>؛ يصلك رمز تفعيل جديد وتختار كلمة مرور جديدة.", "note"),
    ])

def shell_section(extra=""):
    return ("التنقل في المنصة", [
        P("القائمة الجانبية تعرض الصفحات المتاحة لصلاحيتك فقط. في الأعلى: زر <b>البحث السريع</b> للوصول لأي مسجد بالاسم أو الرمز أو الحي أو اسم الإمام وجواله، وزر <b>الإشعارات</b> وعليه عدد غير المقروء. وفي أسفل القائمة زر التبديل بين <b>الوضع الفاتح والداكن</b> وزر الخروج."),
        P("المنصة تعمل على الجوال بنفس الحساب: تظهر القائمة شريطًا سفليًا بأهم الصفحات، وزر «المزيد» يفتح بقية القائمة، والمساجد تظهر بطاقات سهلة اللمس." + extra),
        figs2(fig("mob-dash", "لوحة المؤشرات على الجوال", True), fig("mob-mosques", "قائمة المساجد على الجوال", True)),
        tip("لإضافة المنصة إلى الشاشة الرئيسية في الآيفون: افتحها في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية». وفي أندرويد: قائمة Chrome ← «إضافة إلى الشاشة الرئيسية»."),
    ])

def notif_section(img):
    return ("الإشعارات", [
        P("تصلك الإشعارات لحظيًا مع تنبيه صوتي خفيف عند كل ما يخصك: إسناد مسجد، تقرير جديد، اعتماد، مهمة، أو تذكير بموعد. اضغط الجرس لعرض آخر الإشعارات، واضغط أي إشعار للانتقال لصفحته مباشرة."),
        fig(img, "لوحة الإشعارات السريعة"),
        tip("فعّل <b>«تنبيهات المتصفح»</b> من لوحة الإشعارات ليصلك التنبيه حتى لو كانت المنصة في تبويب آخر."),
    ])

# ───── الأدلة ─────
GUIDES = {}

GUIDES["admin"] = dict(title="دليل مدير النظام", who="مدير النظام", lead="إدارة المشروع كاملًا: المساجد والجمعيات والحسابات، واعتماد التركيب، ومتابعة الأداء.", sections=[
    ("دورك في المنصة", [
        P("مدير النظام يملك كل الصلاحيات: يُدخل المساجد ويسندها للجمعيات، ويعتمد التركيب بعد دراسة الاحتياج، ويُنشئ حسابات الجمعيات والشركة وحسابات العرض، ويتابع المؤشرات والتقارير، ويضبط إعدادات المنصة. ويستطيع تنفيذ أي خطوة عن أي طرف عند الحاجة."),
        P("يمر كل مسجد بالمسار التالي، وتنتقل المرحلة تلقائيًا عند رفع كل تقرير، ويصل الإشعار للطرف التالي:"),
        workflow(["مدير النظام"]),
    ]),
    login_section("admin"),
    shell_section(),
    ("لوحة المؤشرات", [
        P("أول ما يظهر بعد الدخول. اختر الفترة (٧ أيام، ٣٠ يومًا، ٩٠ يومًا، ١٢ شهرًا) أو جمعية معيّنة من الأعلى، فتتحدث كل الأرقام."),
        bullets("<b>إنجاز المشروع:</b> المساجد المركّبة من الإجمالي، وعدد الأجهزة، واكتمال البيانات، ومتوسط مدة التنفيذ.",
                "<b>مربعات المؤشرات:</b> التعبئات، والزيارات، ورضا المصلين، والالتزام بالمواعيد — مع مقارنة بالفترة السابقة.",
                "<b>يحتاج انتباهك:</b> التعبئات المتأخرة والقريبة، والزيارات المتأخرة، والدراسات بانتظار اعتمادك… اضغط أي بند لفتح القائمة المعنية."),
        fig("a-dash", "لوحة المؤشرات"),
        fig("a-attn", "قسم «يحتاج انتباهك» ومسار التنفيذ"),
        P("<b>قسم المقارنات</b> فيه أربعة تبويبات: الفترة مقابل السابقة، وشهر بشهر، والجمعيات، والأحياء. في تبويب الجمعيات رتّبها بأي مقياس، واعرض «الفرق عن المتوسط»، وقارن جمعيتين مباشرة."),
        figs2(fig("a-cmp", "الفترة الحالية مقابل السابقة"), fig("a-cmp-assoc", "مقارنة الجمعيات")),
        P("<b>التوزيع حسب الجهة:</b> بطاقة تعرض عدد المساجد والمركّب منها في كل جهة من جهات الرياض (شمال، جنوب، شرق، غرب، وسط)، و«بدون جهة» للمساجد التي لم تُحدَّد جهتها. وفي تبويب <b>«الجهات»</b> بالمقارنات ترتّب الجهات بنسبة التركيب أو الزيارات أو التعبئات أو الرضا."),
        figs2(fig("a-region", "التوزيع حسب الجهة"), fig("a-cmp-region", "مقارنة الجهات")),
        tip("زر الطباعة أعلى اللوحة يُخرج اللوحة بصيغة مناسبة للعرض أو الحفظ PDF."),
    ]),
    ("خريطة المشروع", [
        P("خريطة خاصة بالرياض تعرض <b>كل مسجد نقطةً ملوّنة حسب حالته</b>، والأحياء التي نتواجد فيها مظللة بالذهبي. اللوحة الزجاجية الجانبية تعرض الأرقام والحالات والأحياء."),
        bullets("<b>الحالات:</b> بانتظار الإسناد (رمادي)، البيانات والتواصل (أزرق)، الدراسة والاعتماد (برتقالي)، بانتظار التركيب (بنفسجي)، قيد التشغيل (أخضر)، متوقف (أحمر). اضغط أي حالة لإخفائها أو إظهارها، ونقرًا مزدوجًا لعرضها وحدها.",
                "<b>نبض أحمر</b> حول النقطة يعني أن تعبئة المسجد متأخرة.",
                "<b>النقطة المضيئة</b> موقع دقيق من رابط الخرائط، و<b>النقطة الشفافة</b> موقع تقريبي داخل حدود الحي (عند عدم توفر الإحداثيات).",
                "اضغط أي نقطة لبطاقة المسجد (الحالة، الجمعية، الأجهزة، التعبئة القادمة)، أو أي حي لبطاقة الحي مع توزيع حالات مساجده.",
                "<b>التحريك والتكبير:</b> السحب بالفأرة أو الإصبع، والعجلة أو إصبعين أو النقر المزدوج للتكبير، وزر الإطار يعيد عرض كل المساجد. الخريطة مقيّدة بالرياض.",
                "صفِّ بالجمعية أو الجهة من الشريط العلوي، وأخفِ أسماء الأحياء أو التظليل عند الحاجة."),
        fig("a-map-home", "خريطة المشروع: نقاط المساجد حسب الحالة"),
        figs2(fig("a-map", "بطاقة الحي وتوزيع حالات مساجده"), fig("a-map-mosque", "بطاقة المسجد")),
        tip("لموقع دقيق لكل مسجد: ضع في «رابط الموقع» رابطًا يحتوي الإحداثيات (في خرائط Google اضغط مطولًا على الموقع وانسخ الإحداثيات).", "note"),
    ]),
    ("المساجد: القائمة والبحث", [
        P("صفحة المساجد تعرض كل المساجد مرقّمة مع مرحلتها وفريقها (الإمام والمؤذن والخادم) وأزرار الاتصال والواتساب."),
        fig("a-mosques", "قائمة المساجد"),
    ]),
    ("البحث المتقدم", [
        P("مربع البحث يبحث بالاسم أو الرمز أو الحي أو اسم الإمام وجواله. ويقبل <b>عدة كلمات مفصولة بفاصلة</b> (تظهر المساجد المطابقة لأيٍّ منها)، و<b>الكلمة المسبوقة بعلامة «-»</b> تُستبعد. مثال: <span class='ltr'>النور، الهدى</span> أو <span class='ltr'>جامع، -الملز</span>."),
        P("زر <b>«بحث متقدم»</b> يفتح مجموعات الخيارات: المرحلة، الجهة، الجمعية، الحي، البيانات (مكتملة/ناقصة)، التعبئة (متأخرة/قريبة/لاحقًا)، النوع، ورابط الموقع. وبجانب كل خيار عدد مساجده."),
        steps("اضغط الخيار <b>مرة</b> لتضمينه (يظهر بالبني مع ✓).",
              "اضغطه <b>مرة ثانية</b> لاستبعاده (يظهر بالأحمر مشطوبًا مع ✕).",
              "اضغطه <b>مرة ثالثة</b> لإلغائه."),
        bullets("يمكن اختيار <b>أكثر من خيار</b> في المجموعة نفسها: «شمال» و«شرق» معًا تعني مساجد الشمال أو الشرق.",
                "المجموعات المختلفة <b>تُطبَّق معًا</b>: الجهة «شمال أو شرق» + المرحلة «ليس قيد التشغيل» + البيانات «ناقصة».",
                "تظهر الشروط المختارة أعلى النتائج، واضغط × بجانب أي شرط لإزالته، أو «مسح الكل».",
                "<b>حفظ البحث:</b> احفظ أي بحث تستخدمه كثيرًا باسم، فيظهر زرًّا تعيد به البحث بضغطة.",
                "رابط الصفحة يحفظ شروط البحث، فيمكن مشاركته مع زميل ليرى النتائج نفسها."),
        fig("a-adv", "البحث المتقدم: شمال أو شرق، ليس قيد التشغيل، والبيانات ناقصة"),
        tip("التصدير وأزرار «إسناد المحدد» و«تحديد الجهة» و«حذف المحدد» تعمل على نتائج البحث المعروضة، فابحث أولًا ثم حدّد."),
    ]),
    ("تصدير القائمة: PDF أو Excel", [
        P("زر <b>«تصدير»</b> في صفحة المساجد يصدّر نتائج البحث الحالية بإحدى صيغتين:"),
        bullets("<b>PDF:</b> قائمة منسقة بشعار المنصة تتضمن شروط البحث وأعداد المساجد حسب المرحلة، وتختار الأعمدة المطلوبة (الحي، الجهة، الجمعية، المرحلة، الإمام والمؤذن والخادم مع جوالاتهم، التعبئة القادمة، الأجهزة، العطر، العنوان، الملاحظات). تُحفظ اختياراتك للمرة القادمة، وتكون الصفحة أفقية تلقائيًا عند كثرة الأعمدة.",
                "<b>Excel:</b> ملف بكل بيانات المساجد للتحليل أو المشاركة."),
        steps("ابحث أو صفِّ القائمة كما تريد.", "اضغط <b>«تصدير»</b> واختر <b>PDF</b> وحدد الأعمدة.", "في نافذة الطباعة اختر <b>«حفظ كملف PDF»</b> (Save as PDF) ثم احفظ."),
        fig("a-export", "نافذة تصدير قائمة المساجد"),
        tip("على الكمبيوتر: زر الفأرة الأيمن على أي خيار يستبعده مباشرة.", "note"),
        P("<b>الجهة:</b> لكل مسجد جهة من جهات الرياض الخمس (شمال، جنوب، شرق، غرب، وسط) تظهر بجانب الحي، ويمكن التصفية بها أو باختيار «بدون جهة» لمعرفة المساجد التي لم تُحدَّد جهتها."),
        tip("زر <b>«تصدير»</b> يحفظ القائمة المعروضة (بعد التصفية) كملف Excel."),
    ]),
    ("إضافة المساجد", [
        P("<b>مسجد واحد:</b> اضغط «إضافة مسجد» واملأ البيانات. الاسم وحده إلزامي، والبقية يمكن أن تكملها الجمعية لاحقًا."),
        fig("a-add", "نموذج إضافة مسجد"),
        P("<b>عدة مساجد من Excel:</b> اضغط «استيراد Excel»، ويمكنك تنزيل النموذج الجاهز أولًا. ارفع الملف فتتعرف المنصة على الأعمدة تلقائيًا (الاسم، الحي، الإمام، الجوال…) مع إمكانية تعديل المطابقة، ويظهر لك معاينة قبل الحفظ. المساجد المكررة (نفس الاسم والحي) تُستبعد تلقائيًا."),
        fig("a-import", "استيراد المساجد من ملف Excel"),
        tip("أضف في ملف Excel عمودًا باسم <b>«الجهة»</b> وقيمه: شمال، جنوب، شرق، غرب، وسط — فتُقرأ تلقائيًا (وتُقبل صيغ مثل «شمال الرياض»)."),
    ]),
    ("إسناد المساجد للجمعيات", [
        steps("في قائمة المساجد حدّد المساجد بمربع الاختيار (أو حدّد الكل من رأس الجدول).",
              "اضغط <b>«إسناد المحدد»</b> واختر الجمعية المشرفة.",
              "تنتقل المساجد لمرحلة «استكمال البيانات» ويصل إشعار للجمعية."),
        fig("a-assign", "إسناد عدة مساجد لجمعية"),
        P("ويمكن الإسناد من صفحة المسجد نفسه عبر زر «إسناد الآن» في بطاقة الإجراء التالي."),
    ]),
    ("تحديد جهات المساجد", [
        steps("في قائمة المساجد صفِّ بـ«بدون جهة» أو بالحي، وحدّد المساجد المطلوبة.",
              "اضغط <b>«تحديد الجهة»</b> واختر الجهة.",
              "اترك خيار <b>«تطبيقها أيضًا على مساجد الأحياء نفسها»</b> مفعّلًا لتُحدَّد جهة كل مساجد تلك الأحياء دفعة واحدة، ثم احفظ."),
        fig("a-region-dlg", "تحديد جهة عدة مساجد"),
        tip("تُحدَّد الجهة أيضًا من نموذج المسجد (إضافة أو تعديل)، ويمكن للجمعية تحديدها عند استكمال البيانات.", "note"),
    ]),
    ("صفحة المسجد", [
        P("تجمع كل ما يخص المسجد: بياناته وفريقه، و<b>بطاقة الإجراء التالي</b> (ما المطلوب ومن المسؤول)، ومسار المراحل الاثنتي عشرة، وتبويبات التقارير والمهام والملفات والسجل."),
        fig("a-m-selected", "صفحة مسجد في مرحلة الإسناد"),
        P("أزرار الأعلى: تعديل البيانات، تغيير الجمعية، إسناد مهمة، طباعة ملف المسجد، <b>إجراءات</b> (تغيير المرحلة يدويًا مع ذكر السبب — للإيقاف أو إعادة التفعيل أو التصحيح)، و<b>حذف</b> المسجد."),
        fig("a-more", "إجراءات المدير: تغيير المرحلة يدويًا"),
        tip("الحذف نهائي ويحذف معه التقارير والمهام والملفات. ويمكن حذف عدة مساجد معًا من القائمة بزر «حذف المحدد».", "warn"),
    ]),
    ("اعتماد التركيب", [
        P("بعد أن ترفع الشركة تقرير دراسة الاحتياج، يصلك إشعار وتظهر في صفحة المسجد بطاقة <b>«اعتماد التركيب»</b>."),
        steps("افتح المسجد واضغط <b>«مراجعة واعتماد»</b>.",
              "راجع تقرير الدراسة (عدد الأجهزة، العطر، مواقع التركيب، والمرفقات).",
              "اكتب ملاحظة إن وجدت، ثم اختر <b>«اعتماد التركيب»</b> أو <b>«إعادة الدراسة للشركة»</b>.",
              "يصل القرار وملاحظتك للشركة والجمعية."),
        figs2(fig("a-decide-card", "بطاقة الإجراء: بانتظار اعتمادك"), fig("a-decide", "نافذة مراجعة الدراسة واتخاذ القرار")),
    ]),
    ("المهام والطلبات", [
        P("لإسناد عمل محدد لطرف (الجمعية أو الشركة) مع موعد وأولوية، مرتبط بمسجد أو عام. يتابع الطرفان المهمة بالتعليقات والمرفقات حتى إغلاقها، وتظهر المهام المتأخرة في لوحة المؤشرات."),
        figs2(fig("a-tasks", "قائمة المهام والطلبات"), fig("a-task-new", "إنشاء مهمة جديدة")),
    ]),
    ("جدول التعبئة والتقارير والمنجزات", [
        P("<b>جدول التعبئة:</b> المساجد قيد التشغيل مقسّمة: متأخرة، وخلال ٧٢ ساعة، ومجدولة لاحقًا، والزيارات الأسبوعية المستحقة."),
        fig("a-refills", "جدول التعبئة والزيارات"),
        P("<b>التقارير:</b> كل التقارير المرفوعة مع التصفية بالنوع والفترة، وطباعة أي تقرير، و<b>التقرير الشهري المجمّع</b> لكل المساجد."),
        fig("a-reports", "مركز التقارير"),
        P("<b>المنجزات:</b> معرض المساجد المركّبة بصورها وأرقام المشروع، مناسب للعرض على الجهات."),
        fig("a-ach", "صفحة المنجزات"),
    ]),
    ("الرسائل الجماعية", [
        steps("اختر المستلمين: الأئمة، المؤذنون، الخدام، مسؤولو الجمعيات، أو الحسابات — وصفِّهم بالجمعية والمرحلة والجهة والحي.",
              "أضف أرقامًا إضافية إن أردت (رقم في كل سطر، ويمكن إضافة الاسم بعد فاصلة).",
              "اكتب الرسالة واستخدم المتغيرات <b>{الاسم}</b> و<b>{المسجد}</b> و<b>{الحي}</b> لتخصيصها لكل مستلم.",
              "اضغط «تجهيز قائمة الإرسال» ثم أرسل لكل مستلم عبر واتساب بضغطة، ويُحفظ ما أُرسل في السجل."),
        fig("a-messages", "إعداد رسالة جماعية"),
    ]),
    ("الجمعيات", [
        P("أضف الجمعيات المشرفة وبيانات التواصل معها، وتابع لكل جمعية عدد مساجدها ونسبة التركيب."),
        figs2(fig("a-assocs", "قائمة الجمعيات المشرفة"), fig("a-assoc-new", "إضافة جمعية")),
    ]),
    ("الحسابات والدعوات", [
        steps("من «الحسابات» اضغط <b>«إنشاء حساب»</b>: الاسم، البريد (اسم الدخول)، الجوال، والصلاحية (مدير، جمعية مشرفة مع اختيار الجمعية، الشركة المنفذة، حساب عرض).",
              "بعد الحفظ تظهر نافذة الدعوة: أرسل للمستخدم رابط المنصة ورمز التفعيل عبر واتساب أو البريد بضغطة.",
              "يفعّل المستخدم حسابه بنفسه ويختار كلمة مروره."),
        fig("a-accounts", "قائمة الحسابات وحالة كل حساب"),
        P("<b>طلب البيانات الناقصة عبر واتساب:</b> إذا لم تكتمل بيانات الشخص بعد، أدخل جواله في نموذج إنشاء الحساب، ثم اختر ما تريد طلبه منه (الاسم الكامل، البريد الإلكتروني، المسمى الوظيفي، اسم الجمعية) — تُحدَّد الحقول الفارغة تلقائيًا. تُجهَّز رسالة مهذبة يمكنك تعديلها، ثم اضغط «إرسال عبر واتساب». وبعد وصول الرد أكمل البيانات واحفظ."),
        fig("a-acc-wa", "طلب البيانات الناقصة من صاحب الجوال عبر واتساب"),
        P("<b>إرسال دليل الاستخدام:</b> زر الدليل بجانب كل حساب يرسل له دليل صلاحيته (رابط الصفحة ونسخة PDF) عبر واتساب أو البريد. وزر <b>«إرسال الأدلة»</b> أعلى الصفحة يجهّز الإرسال لكل الحسابات أو لصلاحية محددة (اختر التبويب أولًا)، وكل شخص يصله دليل صلاحيته، مع رسالة قابلة للتعديل وعلامة «أُرسل» لمن أرسلت له. ويُضاف رابط الدليل تلقائيًا إلى رسالة الدعوة."),
        fig("a-guide-send", "إرسال أدلة الاستخدام حسب الصلاحية"),
        figs2(fig("a-acc-new", "إنشاء حساب وتحديد الصلاحية"), fig("a-invite", "إرسال رمز التفعيل")),
        bullets("<b>إعادة تعيين الدخول</b> (أيقونة المفتاح): عند نسيان كلمة المرور أو تغيّر الشخص — يُلغى الدخول الحالي ويصدر رمز تفعيل جديد.",
                "<b>تعطيل الحساب:</b> من تعديل الحساب، فيُمنع من الدخول دون حذف سجله.",
                "<b>حساب العرض:</b> يرى لوحة المؤشرات وخريطة المشروع والمنجزات فقط، دون أرقام الجوالات أو تعديل أي شيء."),
    ]),
    ("الإعدادات", [
        bullets("<b>هوية المنصة:</b> اسم المنصة والمشروع والشركة المنفذة، واستبدال الشعار.",
                "<b>التشغيل والتذكيرات:</b> دورة التعبئة الافتراضية (يوم)، والتذكير قبل التعبئة (ساعة)، وتكرار الزيارة الدورية (يوم). يفحص الخادم المواعيد كل ساعة ويرسل التذكيرات تلقائيًا.",
                "<b>خط الهوية:</b> رفع ملفات خط المؤسسة لتظهر المنصة به."),
        fig("a-settings", "الإعدادات"),
    ]),
    notif_section("a-notif"),
    ("البحث السريع", [P("زر البحث أعلى الصفحة يبحث في كل المساجد بالاسم أو الرمز أو الحي أو اسم الإمام أو جواله، ويفتح المسجد مباشرة."), fig("a-search", "البحث السريع")]),
])

GUIDES["association"] = dict(title="دليل الجمعية المشرفة", who="الجمعية المشرفة", lead="متابعة المساجد المسندة لجمعيتكم: استكمال البيانات، والتواصل مع الأئمة، والزيارات الأسبوعية، وقياس الرضا، والتقرير الشهري.", sections=[
    ("دورك في المنصة", [
        P("ترى الجمعية <b>مساجدها فقط</b>، ويصلها إشعار عند إسناد مسجد جديد لها. الخطوات المظللة في الجدول من مسؤولية الجمعية:"),
        workflow(["الجمعية"]),
        P("في صفحة كل مسجد تظهر <b>بطاقة الإجراء التالي</b> لتعرف المطلوب منك، أو «بانتظار…» إذا كانت الخطوة عند طرف آخر."),
    ]),
    login_section("association"),
    shell_section(),
    ("لوحة المؤشرات", [
        P("تعرض أرقام جمعيتكم: المساجد المركّبة، والتعبئات والزيارات، ورضا المصلين، والالتزام بالمواعيد، وما يحتاج انتباهك (زيارات متأخرة، مساجد بانتظار استكمال البيانات…)، مع مقارنات بالفترات السابقة."),
        fig("s-dash", "لوحة المؤشرات للجمعية"),
    ]),
    ("مساجدي", [
        P("قائمة مساجد الجمعية مرقّمة مع المرحلة والفريق. البيانات الناقصة تظهر بالأحمر (مثل: «ناقص: مؤذن، خادم»). اضغط أيقونة الواتساب أو الاتصال بجانب أي اسم للتواصل مباشرة."),
        fig("s-mosques", "قائمة مساجد الجمعية"),
        tip("من <b>«بحث متقدم»</b> اختر «البيانات: ناقصة» لترى المساجد التي تحتاج استكمالًا، ويمكن الجمع بين أكثر من خيار، أو استبعاد خيار بالضغط عليه مرتين (يظهر بالأحمر ✕). وتحفظ البحث المتكرر بزر «حفظ البحث»."),
    ]),
    ("الخطوة ٣: استكمال البيانات", [
        steps("افتح المسجد الذي في مرحلة «استكمال البيانات».",
              "اضغط <b>«استكمال البيانات»</b> في بطاقة الإجراء التالي.",
              "أكمل الحي و<b>الجهة</b> (شمال، جنوب، شرق، غرب، وسط)، واسم وجوال كل من الإمام والمؤذن والخادم، ويُفضل رابط الموقع من خرائط Google.",
              "احفظ ثم اضغط <b>«اعتماد اكتمال البيانات»</b> — ينتقل المسجد لمرحلة التواصل مع الإمام."),
        figs2(fig("s-assigned", "مسجد بانتظار استكمال بياناته"), fig("s-complete", "نموذج استكمال البيانات")),
        tip("ضع في «رابط الموقع» رابطًا يحتوي الإحداثيات (اضغط مطولًا على الموقع في خرائط Google وانسخه) ليظهر المسجد في موقعه الدقيق على خريطة المشروع."),
    ]),
    ("الخطوة ٤: التواصل مع الإمام", [
        steps("تواصل مع الإمام (اتصال أو زيارة أو واتساب) لعرض المشروع والتأكد من قابلية التطبيق.",
              "في صفحة المسجد اضغط <b>«رفع التقرير»</b>.",
              "املأ: تاريخ التواصل، الطريقة، مع من تم التواصل، <b>قابلية التطبيق</b>، والوقت المناسب للزيارة والتركيب، وأي ملاحظات أو مرفقات.",
              "إذا كان قابلًا للتطبيق يصل الإشعار للشركة لدراسة الاحتياج."),
        figs2(fig("s-datadone", "المسجد في مرحلة التواصل مع الإمام"), fig("s-feas", "تقرير التواصل مع الإمام")),
    ]),
    ("بعد التركيب: المتابعة الدورية", [
        P("عند تركيب الأجهزة يصبح المسجد <b>«قيد التشغيل»</b> وتظهر في صفحته أزرار المتابعة الدورية."),
        fig("s-active", "مسجد قيد التشغيل وأزرار المتابعة"),
        P("<b>الخطوة ٨ — الزيارة الأسبوعية:</b> حالة الأجهزة (سليمة أو توجد ملاحظة فنية)، وعدد الأجهزة العاملة، ومستوى الرائحة، ونظافة الأجهزة، مع صور. الملاحظة الفنية تصل للشركة والمدير فورًا."),
        fig("s-visit", "تقرير الزيارة الأسبوعية"),
        P("<b>الخطوة ٩ — قياس الرضا:</b> الفئة المستطلعة وعددها، والرضا عن نوع العطر وقوة الرائحة، و<b>الرضا العام</b> من ٥، مع الآراء والمقترحات."),
        fig("s-sat", "قياس رضا المصلين"),
        P("<b>الخطوة ١٠ — التقرير الشهري:</b> اختر الشهر فتُحسب الزيارات ومتوسط الرضا والتعبئات تلقائيًا، ثم قيّم أداء التعطير وأضف الملاحظات والتوصيات."),
        fig("s-monthly", "التقرير الشهري لأداء التعطير"),
        P("كل التقارير تظهر في تبويب <b>«التقارير»</b> بصفحة المسجد بالترتيب الزمني، ويمكن طباعة أي تقرير."),
        fig("s-reports-tab", "سجل تقارير المسجد"),
        tip("يصلك تذكير آلي عندما تتأخر الزيارة الأسبوعية لأي مسجد، وعند حلول موعد التقرير الشهري.", "note"),
    ]),
    ("جدول التعبئة والزيارات", [
        P("يعرض مواعيد تعبئة مساجد الجمعية (المتأخرة والقريبة واللاحقة) والزيارات الأسبوعية المستحقة، لتنسيق زياراتكم مع مواعيد الشركة."),
        fig("s-refills", "جدول التعبئة والزيارات الأسبوعية"),
    ]),
    ("المهام والطلبات", [
        P("تظهر هنا المهام المسندة لجمعيتكم من المدير. افتح المهمة لقراءة تفاصيلها، وأضف تعليقًا أو مرفقًا، وغيّر حالتها عند الإنجاز. ويمكنكم رفع <b>طلب</b> للمدير (مثل طلب صيانة أو إضافة مسجد)."),
        figs2(fig("s-tasks", "مهام وطلبات الجمعية"), fig("s-task-detail", "تفاصيل المهمة والتعليقات")),
    ]),
    ("الرسائل الجماعية", [
        P("أرسل رسالة واتساب لأئمة أو مؤذني أو خدام مساجد الجمعية دفعة واحدة، مع تخصيص الرسالة بالمتغيرات <b>{الاسم}</b> و<b>{المسجد}</b> و<b>{الحي}</b>."),
        fig("s-messages", "رسالة جماعية لفرق المساجد"),
    ]),
    notif_section("s-notif"),
])

GUIDES["company"] = dict(title="دليل الشركة المنفذة", who="الشركة المنفذة", lead="دراسة احتياج الجوامع، والتركيب، والتعبئة الشهرية في مواعيدها مع رفع التقارير.", sections=[
    ("دورك في المنصة", [
        P("ترى الشركة المساجد التي وصلت لمرحلة <b>دراسة الاحتياج</b> وما بعدها. الخطوات المظللة من مسؤولية الشركة:"),
        workflow(["الشركة المنفذة"]),
    ]),
    login_section("company"),
    shell_section(),
    ("لوحة المؤشرات", [
        P("تعرض التعبئات المتأخرة والقريبة، والدراسات والتركيبات المطلوبة، والالتزام بمواعيد التعبئة، ورضا المصلين، مع المقارنة بالفترة السابقة."),
        fig("c-dash", "لوحة المؤشرات للشركة"),
    ]),
    ("المساجد", [
        P("قائمة المساجد الموجهة للشركة مع مرحلتها وبيانات التواصل مع الإمام والخادم لتنسيق الزيارة."),
        fig("c-mosques", "مساجد الشركة"),
    ]),
    ("الخطوة ٥: دراسة الاحتياج", [
        steps("بعد أن تؤكد الجمعية قابلية التطبيق يصلك إشعار. نسّق الزيارة مع الإمام (الوقت المناسب مذكور في تقرير الجمعية).",
              "افتح المسجد واضغط <b>«رفع التقرير»</b>.",
              "املأ: تاريخ الزيارة، <b>عدد الأجهزة المقترحة</b>، نوع الجهاز، المساحة، توفر الكهرباء، العطر المقترح، ومواقع التركيب، وأرفق الصور.",
              "يصل التقرير لمدير النظام للاعتماد."),
        fig("c-study", "تقرير دراسة الاحتياج"),
        tip("إذا أعاد المدير الدراسة تصلك ملاحظته في الإشعار وفي سجل المسجد؛ عدّل وارفع تقريرًا جديدًا.", "note"),
    ]),
    ("الخطوة ٧: التركيب", [
        steps("بعد اعتماد المدير يصلك إشعار «معتمد — بانتظار التركيب».",
              "نفّذ التركيب ثم اضغط <b>«رفع التقرير»</b> في صفحة المسجد.",
              "املأ: تاريخ التركيب، عدد الأجهزة المركّبة، العطر المستخدم، <b>دورة التعبئة</b> بالأيام، والأرقام التسلسلية، وأرفق صور الأجهزة بعد التركيب.",
              "يصبح المسجد «قيد التشغيل» ويُحسب <b>موعد التعبئة التالية تلقائيًا</b>."),
        fig("c-install", "تقرير التركيب"),
    ]),
    ("الخطوة ١١: التعبئة الشهرية", [
        P("صفحة <b>جدول التعبئة</b> هي مرجعك اليومي: المتأخرة بالأحمر، والمستحقة خلال ٧٢ ساعة، والمجدولة لاحقًا. ويصلك وللمدير <b>تذكير آلي قبل الموعد بـ٧٢ ساعة</b>، وتنبيه عند التأخر."),
        fig("c-refills", "جدول التعبئة"),
        steps("بعد التعبئة اضغط <b>«تسجيل التعبئة»</b> من الجدول، أو «تعبئة العطر» من صفحة المسجد.",
              "املأ: تاريخ ووقت التعبئة، العطر، الكمية (مل)، وعدد الأجهزة التي عُبّئت، وأرفق صورة.",
              "يُحدّث موعد التعبئة التالية تلقائيًا حسب دورة المسجد."),
        fig("c-refill", "تقرير التعبئة"),
        tip("تُحتسب التعبئة «في موعدها» إذا سُجلت حتى يوم واحد بعد الموعد، وتظهر نسبة الالتزام في لوحة المؤشرات والمقارنات.", "note"),
    ]),
    ("المهام والطلبات", [
        P("مهام الصيانة أو المتابعة التي يسندها المدير للشركة، مع الموعد والأولوية. افتح المهمة، وأضف التعليقات والصور، وغيّر حالتها عند الإنجاز."),
        figs2(fig("c-tasks", "مهام الشركة"), fig("c-task-detail", "تفاصيل المهمة")),
        tip("الملاحظات الفنية التي ترفعها الجمعية في زياراتها تصلك فورًا كإشعار — راجعها في سجل تقارير المسجد."),
    ]),
    notif_section("c-notif"),
])

GUIDES["viewer"] = dict(title="دليل حساب العرض", who="حساب العرض", lead="متابعة مؤشرات المشروع وإنجازاته دون صلاحية تعديل.", sections=[
    ("صلاحياتك", [
        P("حساب العرض مخصص للجهات والمسؤولين الذين يتابعون المشروع. يرى: <b>لوحة المؤشرات</b> بكل مقارناتها، و<b>خريطة المشروع</b>، و<b>المنجزات</b>، و<b>الإشعارات</b>. ولا يرى أرقام جوالات فرق المساجد، ولا يعدّل أي بيانات."),
    ]),
    login_section("viewer"),
    ("لوحة المؤشرات", [
        P("اختر الفترة من الأعلى (٧ أيام إلى ١٢ شهرًا) أو جمعية معينة. تعرض اللوحة إنجاز المشروع، والتعبئات والزيارات، ورضا المصلين، والالتزام بالمواعيد، ومسار التنفيذ، والتوزيع على الأحياء، وأداء الجمعيات."),
        fig("v-dash", "لوحة المؤشرات"),
        P("في <b>قسم المقارنات</b>: الفترة الحالية مقابل السابقة، وشهر بشهر، وترتيب الجمعيات والجهات والأحياء بأي مقياس مع الفرق عن المتوسط، ومقارنة مباشرة بين جمعيتين."),
        fig("a-cmp", "المقارنات بين الفترات"),
        tip("زر الطباعة أعلى اللوحة يُخرجها مناسبة للعرض أو الحفظ PDF."),
    ]),
    ("خريطة المشروع", [
        P("كل مسجد نقطة ملوّنة حسب حالته (من الإسناد حتى التشغيل)، والنبض الأحمر يعني تعبئة متأخرة. اضغط أي حالة في اللوحة لإخفائها أو إظهارها، وأي نقطة أو حي لعرض تفاصيله. اسحب للتحريك واستخدم العجلة أو إصبعين للتكبير."),
        fig("v-map", "خريطة المشروع"),
    ]),
    ("المنجزات", [
        P("معرض المساجد المركّبة بصورها مع أرقام المشروع: عدد المساجد المعطّرة، وأجهزة التعطير، وعمليات التعبئة، ومتوسط رضا المصلين."),
        fig("v-ach", "المنجزات"),
    ]),
    notif_section("v-notif"),
])

CSS = r"""
:root{--brown:#563331;--brown2:#6b4340;--gold:#ceb26b;--gold2:#e6cf8f;--gold-soft:#f5eedc;--bg:#f4efe6;--ink:#2b1a18;--ink2:#5e4d4a;--ink3:#8e817e;--line:#e8dfd1;
  --glass:rgba(255,255,255,.62);--glass2:rgba(255,255,255,.78);--edge:rgba(255,255,255,.75);--shadow:0 14px 40px rgba(86,51,49,.12);--card:#fff}
html[data-theme=dark]{--bg:#120d0c;--ink:#f4ede7;--ink2:#c8bab4;--ink3:#978883;--line:#33282500;--line:#352a27;--gold-soft:#2c2318;
  --glass:rgba(34,26,24,.62);--glass2:rgba(34,26,24,.8);--edge:rgba(255,255,255,.08);--shadow:0 14px 40px rgba(0,0,0,.45);--card:#1d1615}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:90px}
body{margin:0;font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;color:var(--ink);line-height:1.9;font-size:16px;background:var(--bg);
  background-image:radial-gradient(900px 500px at 85% -10%,rgba(206,178,107,.28),transparent 70%),radial-gradient(800px 600px at -10% 30%,rgba(86,51,49,.12),transparent 70%),radial-gradient(700px 500px at 70% 110%,rgba(206,178,107,.16),transparent 70%);background-attachment:fixed}
a{color:inherit}
.ltr{direction:ltr;unicode-bidi:embed;font-family:ui-monospace,Menlo,monospace;font-size:.88em;background:var(--card);border:1px solid var(--line);padding:1px 7px;border-radius:7px}
.glass{background:var(--glass);border:1px solid var(--edge);box-shadow:var(--shadow);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4)}
/* شريط علوي ثابت */
.bar{position:sticky;top:0;z-index:30;display:flex;align-items:center;gap:12px;padding:10px max(16px,calc((100vw - 1240px)/2));border-bottom:1px solid var(--edge);background:var(--glass2);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)}
.bar .mark{width:54px;height:30px;flex:none;display:block}
.bar .mark svg{width:100%;height:100%}
.bar .ttl{font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar .ttl small{font-weight:400;color:var(--ink3);margin-inline-start:6px}
.bar .sp{flex:1}
.bar .ib{all:unset;cursor:pointer;height:38px;min-width:38px;padding:0 12px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14px;color:var(--ink);background:var(--glass);border:1px solid var(--edge)}
.bar .ib:hover{background:var(--gold-soft)}
.bar .ib.pdf{background:var(--brown);color:#fff;border-color:var(--brown)}
.prog{position:absolute;left:0;right:0;bottom:-1px;height:3px;background:transparent}
.prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--gold),var(--gold2));border-radius:3px;transition:width .1s}
/* الغلاف */
.hero{position:relative;margin:22px auto 0;max-width:1240px;padding:0 16px}
.hero .in{position:relative;overflow:hidden;border-radius:28px;padding:42px 40px 36px;color:#fff;background:linear-gradient(125deg,#3f2523 0%,#563331 50%,#74493f 100%);box-shadow:0 24px 60px rgba(86,51,49,.3)}
.hero .in::before{content:"";position:absolute;inset:0;background:radial-gradient(520px 260px at 10% 0%,rgba(206,178,107,.35),transparent 70%),radial-gradient(420px 240px at 95% 110%,rgba(206,178,107,.22),transparent 70%)}
.hero .in>*{position:relative}
.hero .logo{width:120px;margin-bottom:14px}
.hero h1{margin:0;font-size:38px;line-height:1.25}
.hero p{margin:10px 0 0;color:#ecdcb8;font-size:17px;max-width:680px}
.hero .meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}
.hero .pill{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:999px;font-size:13.5px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.hero .pill b{color:var(--gold2)}
/* بداية سريعة */
.quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:-26px;position:relative;z-index:2;padding:0 26px}
.quick a{text-decoration:none;border-radius:18px;padding:16px 18px;display:grid;gap:4px;transition:transform .15s}
.quick a:hover{transform:translateY(-2px)}
.quick a small{color:var(--ink3);font-size:12.5px}
.quick a b{font-size:15px}
.quick a .n{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;background:var(--brown);color:var(--gold);font-weight:700;font-size:14px;margin-bottom:4px}
/* التخطيط */
.layout{max-width:1240px;margin:28px auto 80px;padding:0 16px;display:grid;grid-template-columns:290px minmax(0,1fr);gap:24px;align-items:start}
.side{position:sticky;top:76px;border-radius:22px;padding:14px;max-height:calc(100vh - 96px);display:flex;flex-direction:column;gap:10px}
.search{position:relative}
.search input{width:100%;height:42px;border-radius:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:0 38px 0 12px;font:inherit;font-size:14px;outline:none}
.search input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(206,178,107,.25)}
.search::before{content:"⌕";position:absolute;right:12px;top:50%;transform:translateY(-52%);font-size:20px;color:var(--ink3)}
.done-meter{display:flex;align-items:center;gap:10px;padding:4px 6px;font-size:13px;color:var(--ink2)}
.ring{--p:0;width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11px;font-weight:700;color:var(--ink);background:conic-gradient(var(--gold) calc(var(--p)*1%),var(--line) 0)}
.ring::before{content:"";position:absolute;width:30px;height:30px;border-radius:50%;background:var(--card)}
.ring{position:relative}.ring span{position:relative}
.toc{list-style:none;margin:0;padding:0;overflow-y:auto;display:grid;gap:2px}
.toc a{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;text-decoration:none;font-size:14px;color:var(--ink2);transition:background .15s,color .15s}
.toc a .k{width:24px;height:24px;border-radius:8px;flex:none;display:grid;place-items:center;font-size:12px;font-weight:700;background:var(--gold-soft);color:var(--brown)}
html[data-theme=dark] .toc a .k{color:var(--gold)}
.toc a:hover{background:var(--glass2);color:var(--ink)}
.toc a.on{background:var(--brown);color:#fff}.toc a.on .k{background:var(--gold);color:var(--brown)}
.toc a.read .k{background:#2f9e6a;color:#fff}
.toc a.read .k::after{content:"✓"}.toc a.read .k span{display:none}
.toc li[hidden]{display:none}
.nores{display:none;padding:10px;text-align:center;color:var(--ink3);font-size:13px}
.nores.show{display:block}
/* الأقسام */
.content{display:grid;gap:18px}
section.sec{border-radius:24px;padding:26px 28px 22px;scroll-margin-top:90px}
section.sec[hidden]{display:none}
.sh{display:flex;align-items:center;gap:14px;margin-bottom:6px}
.sh .num{width:44px;height:44px;border-radius:14px;flex:none;display:grid;place-items:center;font-weight:700;font-size:18px;color:var(--gold);background:linear-gradient(135deg,#4a2b29,#6b4340);box-shadow:0 6px 16px rgba(86,51,49,.25)}
.sh h2{margin:0;font-size:23px;line-height:1.35;flex:1}
.mark-read{all:unset;cursor:pointer;flex:none;font-size:13px;padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--ink2);white-space:nowrap}
.mark-read:hover{border-color:#2f9e6a;color:#2f9e6a}
.mark-read.on{background:#2f9e6a;border-color:#2f9e6a;color:#fff}
p{margin:12px 0}
mark{background:rgba(206,178,107,.45);color:inherit;border-radius:4px;padding:0 2px}
ol.steps{counter-reset:s;list-style:none;padding:0;margin:16px 0;display:grid;gap:10px}
ol.steps li{counter-increment:s;display:flex;gap:12px;align-items:flex-start;padding:12px 14px;background:var(--card);border:1px solid var(--line);border-radius:16px}
ol.steps li::before{content:counter(s);width:30px;height:30px;border-radius:50%;flex:none;display:grid;place-items:center;font-weight:700;font-size:14px;color:var(--brown);background:linear-gradient(135deg,var(--gold2),var(--gold));margin-top:1px}
ul.pts{list-style:none;padding:0;margin:14px 0;display:grid;gap:8px}
ul.pts li{position:relative;padding-inline-start:22px}
ul.pts li::before{content:"";position:absolute;right:4px;top:12px;width:8px;height:8px;border-radius:3px;background:var(--gold);transform:rotate(45deg)}
.call{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:16px;margin:16px 0;font-size:15px;border:1px solid}
.call i{font-style:normal;font-size:20px;line-height:1.4}
.call b{display:block;font-size:13px;margin-bottom:2px}
.call.tip{background:rgba(206,178,107,.14);border-color:rgba(206,178,107,.45)}
.call.note{background:rgba(79,134,198,.1);border-color:rgba(79,134,198,.35)}
.call.warn{background:rgba(196,84,74,.1);border-color:rgba(196,84,74,.35)}
figure.shot{margin:18px 0 22px}
.zoom{all:unset;cursor:zoom-in;display:block;position:relative;border-radius:16px;overflow:hidden;border:1px solid var(--line);box-shadow:0 14px 34px rgba(43,26,24,.14);background:var(--card)}
.zoom img{width:100%;display:block;transition:transform .35s}
.zoom:hover img{transform:scale(1.015)}
.zoom .zi{position:absolute;top:10px;left:10px;width:34px;height:34px;border-radius:11px;display:grid;place-items:center;font-size:17px;color:#fff;background:rgba(43,26,24,.55);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);opacity:0;transition:opacity .2s}
.zoom:hover .zi,.zoom:focus-visible .zi{opacity:1}
.zoom:focus-visible{outline:3px solid var(--gold)}
figure.mob .zoom{max-width:290px;margin:0 auto;border-radius:26px}
figcaption{text-align:center;font-size:13px;color:var(--ink3);margin-top:9px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
.pair figure{margin:12px 0}
table{width:100%;border-collapse:separate;border-spacing:0;margin:14px 0;font-size:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
th,td{padding:9px 12px;text-align:right;border-bottom:1px solid var(--line)}
th{background:var(--gold-soft)}
/* مسار العمل التفاعلي */
.wf{margin:14px 0}
.wf-bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.wf-t{all:unset;cursor:pointer;font-size:13px;padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--card)}
.wf-t.on{background:var(--brown);color:#fff;border-color:var(--brown)}
.wf-k{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink3)}
.me-dot{width:12px;height:12px;border-radius:4px;background:linear-gradient(135deg,var(--gold2),var(--gold))}
.wf-list{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.wf-s{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:14px;background:var(--card);border:1px solid var(--line);transition:opacity .2s,transform .2s}
.wf-s .wf-n{width:28px;height:28px;border-radius:9px;flex:none;display:grid;place-items:center;font-size:13px;background:var(--gold-soft);color:var(--brown)}
.wf-s span{display:block;font-size:13.5px;line-height:1.55}
.wf-s small{display:block;font-size:11.5px;color:var(--ink3);margin-top:2px}
html[data-theme=dark] .wf-s .wf-n{color:var(--gold)}
.wf-s.me{border-color:var(--gold);background:linear-gradient(135deg,rgba(206,178,107,.2),rgba(206,178,107,.06));box-shadow:0 6px 16px rgba(206,178,107,.18)}
.wf-s.me .wf-n{background:linear-gradient(135deg,var(--gold2),var(--gold));color:var(--brown)}
.wf.only-me .wf-s:not(.me){display:none}
/* عارض الصور */
.lb{position:fixed;inset:0;z-index:100;display:none;align-items:center;justify-content:center;padding:24px;background:rgba(20,12,11,.82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.lb.open{display:flex}
.lb figure{margin:0;max-width:min(1200px,96vw);display:grid;gap:10px}
.lb img{max-width:100%;max-height:82vh;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.5);background:#fff;justify-self:center}
.lb figcaption{color:#f1e6d3;font-size:14px}
.lb button{all:unset;cursor:pointer;position:absolute;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2)}
.lb button:hover{background:rgba(255,255,255,.22)}
.lb .x{top:16px;left:16px}.lb .pv{right:16px;top:50%}.lb .nx{left:16px;top:50%}
/* أزرار عائمة */
.fab{position:fixed;bottom:18px;left:18px;z-index:25;display:flex;gap:8px}
.fab button{all:unset;cursor:pointer;height:46px;min-width:46px;padding:0 16px;border-radius:16px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:14px;font-weight:600}
.fab .top{opacity:0;pointer-events:none;transition:opacity .2s}.fab .top.show{opacity:1;pointer-events:auto}
.fab .tocb{display:none;background:var(--brown)!important;color:#fff;border-color:var(--brown)!important;box-shadow:0 10px 26px rgba(86,51,49,.35)!important}
footer{max-width:1240px;margin:0 auto 40px;padding:0 16px;color:var(--ink3);font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
/* الجوال */
@media (max-width:980px){
  .layout{grid-template-columns:1fr}
  .side{position:fixed;inset:auto 10px 10px 10px;top:auto;z-index:40;max-height:72vh;transform:translateY(calc(100% + 20px));transition:transform .25s ease;border-radius:22px}
  .side.open{transform:none}
  .fab .tocb{display:inline-flex}
  .scrim{position:fixed;inset:0;z-index:35;background:rgba(20,12,11,.35);display:none}.scrim.show{display:block}
  .bar .ttl small,.bar .ib .t{display:none}
}
@media (max-width:720px){
  body{font-size:15.5px}
  .hero .in{padding:30px 22px 34px;border-radius:22px}.hero h1{font-size:28px}.hero .logo{width:96px}
  .quick{padding:0 10px;grid-template-columns:1fr 1fr}
  section.sec{padding:20px 16px 16px;border-radius:20px}
  .sh h2{font-size:19px}.sh .num{width:38px;height:38px;font-size:16px}
  .sh{flex-wrap:wrap}.mark-read{margin-inline-start:52px}
  .pair{grid-template-columns:1fr}
  .wf-list{grid-template-columns:1fr}
}
/* الطباعة وPDF: مستند نظيف بلا عناصر تفاعلية */
@media print{
  @page{size:A4;margin:14mm 13mm}
  @page :first{margin:0}
  html,body{background:#fff!important;color:#2b1a18;font-size:12px}
  html[data-theme=dark]{--bg:#fff;--ink:#2b1a18;--ink2:#5e4d4a;--ink3:#8e817e;--line:#e8dfd1;--gold-soft:#f5eedc;--card:#fff;--glass:#fff;--glass2:#fff}
  .bar,.side,.fab,.lb,.quick,.mark-read,.wf-bar,.zi,.scrim,.noprint{display:none!important}
  body>*:not(.hero):not(.layout){display:none!important}
  body{background-image:none!important}
  *,*::before,*::after{box-shadow:none!important;text-shadow:none!important}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .glass{background:#fff!important;box-shadow:none!important;border:0!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
  .hero{margin:0;padding:0;max-width:none;break-after:page}
  .hero .in{height:297mm;border-radius:0;display:flex;flex-direction:column;justify-content:center;padding:0 22mm;box-shadow:none}
  .hero .logo{width:200px}.hero h1{font-size:46px}
  .layout{display:block;margin:0;padding:0;max-width:none}
  section.sec{break-before:page;padding:0;border-radius:0}
  section.sec:first-child{break-before:auto}
  section.sec[hidden]{display:block!important}
  .wf.only-me .wf-s{display:flex!important}
  .zoom{box-shadow:none}
  figure{break-inside:avoid}
  ol.steps li,.call,.wf-s{break-inside:avoid}
  footer{display:none}
}
"""

JS = r"""
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const role = document.body.dataset.role, KEY = "tayyib.guide.read." + role;
  const root = document.documentElement;
  // المظهر: يتبع النظام ويمكن تبديله
  const saved = (() => { try { return localStorage.getItem("tayyib.guide.theme"); } catch { return null; } })();
  const setTheme = (t) => { root.dataset.theme = t; $("#theme") && ($("#theme").textContent = t === "dark" ? "☀︎" : "☾"); };
  setTheme(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  $("#theme")?.addEventListener("click", () => { const t = root.dataset.theme === "dark" ? "light" : "dark"; setTheme(t); try { localStorage.setItem("tayyib.guide.theme", t); } catch {} });
  $("#print")?.addEventListener("click", () => window.print());
  if (!role) return;

  const secs = $$("section.sec"), links = $$(".toc a");
  // تقدّم القراءة
  const prog = $(".prog i"), topBtn = $(".fab .top");
  const onScroll = () => { const h = document.documentElement; const p = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight); prog.style.width = (p * 100).toFixed(1) + "%"; topBtn.classList.toggle("show", h.scrollTop > 600); };
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
  topBtn.onclick = () => scrollTo({ top: 0, behavior: "smooth" });
  // القسم الحالي في المحتويات
  const io = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { links.forEach((a) => a.classList.toggle("on", a.hash === "#" + e.target.id)); const a = links.find((x) => x.hash === "#" + e.target.id); a && a.scrollIntoView({ block: "nearest" }); } }); }, { rootMargin: "-30% 0px -60% 0px" });
  secs.forEach((s) => io.observe(s));
  // «تمت قراءته» محفوظ في المتصفح
  let read = new Set(); try { read = new Set(JSON.parse(localStorage.getItem(KEY)) || []); } catch {}
  const paint = () => {
    secs.forEach((s) => { const b = $(".mark-read", s), on = read.has(s.id); b.classList.toggle("on", on); b.textContent = on ? "✓ تمت قراءته" : "تحديد كمقروء"; });
    links.forEach((a) => a.classList.toggle("read", read.has(a.hash.slice(1))));
    const p = Math.round(read.size / secs.length * 100); $(".ring").style.setProperty("--p", p); $(".ring span").textContent = p + "٪";
    $(".done-meter b").textContent = `${read.size} من ${secs.length}`;
    try { localStorage.setItem(KEY, JSON.stringify([...read])); } catch {}
  };
  secs.forEach((s) => $(".mark-read", s).onclick = () => { read.has(s.id) ? read.delete(s.id) : read.add(s.id); paint(); });
  paint();
  // البحث الفوري في الأقسام
  const norm = (t) => t.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").toLowerCase();
  const texts = secs.map((s) => norm(s.textContent));
  const clearMarks = () => $$("mark.hl").forEach((m) => m.replaceWith(m.textContent));
  const highlight = (s, q) => { const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach((n) => { const i = norm(n.data).indexOf(q); if (i < 0 || n.parentElement.closest("button,figcaption,.wf-bar")) return; const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + q.length); const m = document.createElement("mark"); m.className = "hl"; r.surroundContents(m); }); };
  $("#q").addEventListener("input", (e) => {
    const q = norm(e.target.value.trim()); clearMarks(); let n = 0;
    secs.forEach((s, i) => { const hit = !q || texts[i].includes(q); s.hidden = !hit; links[i].parentElement.hidden = !hit; if (hit) n++; if (hit && q.length > 1) highlight(s, q); });
    $(".nores").classList.toggle("show", !n);
  });
  // مسار العمل: خطواتي فقط
  $$(".wf").forEach((w) => w.addEventListener("click", (e) => { const b = e.target.closest("[data-wf]"); if (!b) return; $$("[data-wf]", w).forEach((x) => x.classList.toggle("on", x === b)); w.classList.toggle("only-me", b.dataset.wf === "me"); }));
  // المحتويات على الجوال
  const side = $(".side"), scrim = $(".scrim");
  const toggleSide = (o) => { side.classList.toggle("open", o); scrim.classList.toggle("show", o); };
  $(".fab .tocb").onclick = () => toggleSide(!side.classList.contains("open"));
  scrim.onclick = () => toggleSide(false);
  links.forEach((a) => a.addEventListener("click", () => toggleSide(false)));
  // عارض الصور مع التنقل بالأسهم
  const shots = $$("figure.shot"), lb = $(".lb"); let cur = 0;
  const show = (i) => { cur = (i + shots.length) % shots.length; const f = shots[cur]; $("img", lb).src = $("img", f).src; $("img", lb).alt = $("img", f).alt; $("figcaption", lb).textContent = `${$("figcaption", f).textContent}  •  ${cur + 1} / ${shots.length}`; lb.classList.add("open"); };
  shots.forEach((f, i) => $(".zoom", f).onclick = () => show(i));
  $(".x", lb).onclick = () => lb.classList.remove("open");
  $(".pv", lb).onclick = () => show(cur - 1); $(".nx", lb).onclick = () => show(cur + 1);
  lb.onclick = (e) => { if (e.target === lb) lb.classList.remove("open"); };
  addEventListener("keydown", (e) => {
    if (lb.classList.contains("open")) { if (e.key === "Escape") lb.classList.remove("open"); if (e.key === "ArrowLeft") show(cur + 1); if (e.key === "ArrowRight") show(cur - 1); }
    else if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("#q").focus(); }
  });
})();
"""

HEAD = """<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><script>if(location.protocol==="http:"&&!/^(localhost|127\\.|\\[::1\\])/.test(location.hostname))location.replace("https://"+location.host+location.pathname+location.search+location.hash)</script><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} — منصة طيب</title><link rel="icon" href="../icon.svg" type="image/svg+xml"><meta name="theme-color" content="#563331">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="guide.css"></head>"""

def topbar(title, sub, key=""):
    return f"""<header class="bar"><a class="mark" href="index.html" aria-label="كل الأدلة">{BADGE}</a><div class="ttl">{title}<small>{sub}</small></div><span class="sp"></span>
<button class="ib" id="theme" type="button" aria-label="تبديل المظهر">☾</button>
{f'<a class="ib pdf" href="pdf/{key}.pdf" download>⤓ <span class="t">PDF</span></a>' if key else ''}
<a class="ib" href="../" title="فتح المنصة">↗ <span class="t">المنصة</span></a><div class="prog"><i></i></div></header>"""

def build(key, g):
    secs = g["sections"]
    toc = "".join(f"<li><a href='#s{i}'><span class='k'><span>{i}</span></span>{t}</a></li>" for i, (t, _) in enumerate(secs, 1))
    body = "".join(f"<section class='sec glass' id='s{i}'><div class='sh'><span class='num'>{i}</span><h2>{t}</h2><button class='mark-read' type='button'>تحديد كمقروء</button></div>{''.join(b)}</section>" for i, (t, b) in enumerate(secs, 1))
    # بداية سريعة: أهم أربعة أقسام بعد المقدمة
    picks = [(i, t) for i, (t, _) in enumerate(secs, 1) if not any(x in t for x in ("الدخول", "التنقل", "دورك", "صلاحياتك", "الإشعارات"))][:4]
    quick = "".join(f"<a class='glass' href='#s{i}'><span class='n'>{i}</span><b>{t}</b><small>انتقل للشرح ←</small></a>" for i, t in picks)
    page = HEAD.format(title=g["title"]) + f"""<body data-role="{key}">
{topbar(g['title'], 'منصة طيب', key)}
<div class="hero"><div class="in"><div class="logo">{LOGO}</div><h1>{g['title']}</h1><p>{g['lead']}</p>
<div class="meta"><span class="pill">📘 <b>{len(secs)}</b> قسمًا</span><span class="pill">🖼️ شرح بالصور</span><span class="pill">🗓️ {VERSION}</span></div></div>
<div class="quick">{quick}</div></div>
<div class="layout">
<aside class="side glass" aria-label="المحتويات"><div class="search"><input id="q" type="search" placeholder="ابحث في الدليل… ( / )" aria-label="البحث في الدليل"></div>
<div class="done-meter"><div class="ring"><span>0٪</span></div><div>تقدّم القراءة<br><b>0</b></div></div>
<ul class="toc">{toc}</ul><div class="nores">لا توجد نتائج مطابقة</div></aside>
<main class="content">{body}</main></div>
<footer><span>منصة طيب • {g['title']}</span><span>الصور من بيانات تجريبية للتوضيح</span></footer>
<div class="fab"><button class="tocb glass" type="button">☰ المحتويات</button><button class="top glass" type="button" aria-label="إلى الأعلى">↑</button></div>
<div class="scrim"></div>
<div class="lb" role="dialog" aria-label="عرض الصورة"><button class="x" type="button" aria-label="إغلاق">✕</button><button class="pv" type="button" aria-label="السابقة">›</button><button class="nx" type="button" aria-label="التالية">‹</button><figure><img alt=""><figcaption></figcaption></figure></div>
<script src="guide.js"></script></body></html>"""
    (out / f"{key}.html").write_text(page, encoding="utf-8")

ICONS = {"admin": "🛠️", "association": "🕌", "company": "🧰", "viewer": "📊"}
def index():
    cards = "".join(f"""<a class="rc glass" href="{k}.html"><span class="ri">{ICONS[k]}</span><b>{g['title']}</b><span>{g['lead']}</span><i>فتح الدليل ←</i><em><a href="pdf/{k}.pdf" download>⤓ PDF</a></em></a>""" for k, g in GUIDES.items())
    cards = cards.replace('<em><a href="', '<em data-href="').replace('" download>⤓ PDF</a></em>', '">⤓ PDF</em>')
    page = HEAD.format(title="أدلة الاستخدام") + f"""<body>
{topbar('أدلة الاستخدام', 'منصة طيب')}
<style>.rcs{{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;max-width:1000px;margin:-26px auto 60px;padding:0 26px;position:relative;z-index:2}}
.rc{{border-radius:22px;padding:22px;text-decoration:none;display:grid;gap:6px;transition:transform .15s}}.rc:hover{{transform:translateY(-3px)}}
.rc .ri{{font-size:28px}}.rc b{{font-size:19px}}.rc span{{color:var(--ink2);font-size:14px}}.rc i{{font-style:normal;color:var(--brown);font-weight:700;font-size:14px;margin-top:4px}}
html[data-theme=dark] .rc i{{color:var(--gold)}}.rc em{{font-style:normal;font-size:12.5px;color:var(--ink3);cursor:pointer;justify-self:start}}
@media(max-width:720px){{.rcs{{grid-template-columns:1fr;padding:0 10px}}}}</style>
<div class="hero"><div class="in"><div class="logo">{LOGO}</div><h1>أدلة استخدام منصة طيب</h1>
<p>اختر الدليل حسب صلاحية حسابك. كل دليل يشرح خطوات عملك بالصور، مع بحث فوري وتتبّع لما قرأته، ويمكن تنزيله PDF.</p></div></div>
<div class="rcs">{cards}</div>
<footer><span>منصة طيب — مشروع تعطير مساجد الرياض</span><span>الإصدار: {VERSION}</span></footer>
<script src="guide.js"></script><script>document.querySelectorAll(".rc em").forEach(e=>e.addEventListener("click",ev=>{{ev.preventDefault();location.href=e.dataset.href}}))</script></body></html>"""
    (out / "index.html").write_text(page, encoding="utf-8")

if __name__ == "__main__":
    (out / "pdf").mkdir(parents=True, exist_ok=True)
    (out / "guide.css").write_text(CSS, encoding="utf-8")
    (out / "guide.js").write_text(JS, encoding="utf-8")
    for k, g in GUIDES.items(): build(k, g)
    index()
    missing = sorted({s.split("img/")[1].split(".jpg")[0] for f in out.glob("*.html") for s in f.read_text(encoding="utf-8").split("src='")[1:] if "img/" in s} - {p.stem for p in (out / "img").glob("*.jpg")})
    print("built guides:", ", ".join(GUIDES), "| missing images:", missing or "none")
