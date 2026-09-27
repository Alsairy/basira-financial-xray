# تقرير التحقق المستقل — بصيرة

تاريخ التحقق: 27 سبتمبر 2026. التطبيق المحلي الفعلي: `http://127.0.0.1:4317`. هذه أدلة على نموذج تجريبي يعمل محليًا، وليست اعتمادًا محاسبيًا أو شهادة أمن أو اكتمالًا للمتطلبات الأربعين. ربط الدليل المحدود بكل متطلب في `IMPLEMENTATION_STATUS.md`.

## نتائج التنفيذ

| طبقة التحقق | النتيجة الفعلية | سجل الدليل |
|---|---|---|
| HTTP بحسابات وشركات مستقلة ومحرك Python الحقيقي | 36 ناجحًا؛ صفر إخفاق أو تعذر | `verification-evidence/api-mujvs2kg.json` |
| محرك الحساب في المشروع المدمج | 28/28 ناجحًا، ومنها قيم مرجعية صريحة لجميع المؤشرات الـ35 | `verification-evidence/engine-main-final.txt` |
| اختبارات Node في المشروع المدمج | 26/26 ناجحًا: 20 لعقد AI المحلي و6 للخادم/التقارير/العمليات | `verification-evidence/node-final.txt` |
| رحلة رفع ومراجعة واعتماد مستقل ثم قراءة المجلس | 7/7 ناجحة؛ تشمل منظور المجلس وحدود مصادره | `verification-evidence/journey-1790517820658/results.json` |
| رحلة المصدر والسيناريو والإجراء والدليل والإغلاق والمنفعة | 7/7 ناجحة؛ تشمل منظور التكليفات للمشغّل | `verification-evidence/functional-1790517866209/results.json` |
| التخطيط: 10 مسارات × 3 أحجام 1440/390/720 بكسل | 30/30؛ لا تجاوز أفقي لجسم الصفحة ولا أخطاء console/page/request | `verification-evidence/ui-1790517375535/results.json` |
| axe-core 4.10.2 على المسارات العشرة ببيانات علم المرجعية | صفر مخالفات آلية في الحالات المفتوحة | `verification-evidence/axe.json` |
| لوحة مفاتيح الجوال | 8 أهداف تركيز مرئية؛ فتح القائمة وحصر Tab بالاتجاهين وEscape/إرجاع التركيز ناجحة | `verification-evidence/mobile-focus.json` و`verification-evidence/mobile-menu-focus.json` |
| بطاقة الأثر والنوافذ المفتوحة | صفر مخالفات في إعادة فحص بطاقة الأثر بعد التصحيح؛ بقية الحالات المفتوحة نجحت | `verification-evidence/benefit-contrast-final.json` ونتائج functional |
| الرسم النهائي لسطح المكتب والجوال | 9 أعمدة ظاهرة بقيمها الكاملة؛ لا تجاوز أفقي | `verification-evidence/chart-probe.png` و`verification-evidence/chart-final-mobile.png` |
| مصفوفة روابط التقرير 7 جماهير × 3 أعماق | 21/21 بلا رابط داخلي مكسور أو معرف مكرر | `verification-evidence/scope-report-links-latest.json` |

طلبات HTTP تسلك المحرك الفعلي دون حقن نتائج حساب وهمية. اختبارات Node المنفصلة تستخدم بدائل محددة لبعض مكونات الخادم لاختبار الضوابط، ولا تحل محل دورة HTTP. المدخلات المالية للاختبارات مصطنعة؛ تجربة الواجهة تستخدم بيانات علم المرجعية المعلّمة. الإجراءات والأدلة ومبلغ 100 ألف ريال في الاختبار مصطنعة، ولا تمثل وفرًا حققته شركة علم.

## ما أُثبت سلوكيًا

- حسابات CFO ومحلل ومشغّل ومجلس ومراجع مستقل وشركة أخرى؛ CSRF، إبطال الجلسة، عزل المصادر والمرفقات والمسودات، وعدم ترقية الصلاحية باختيار الجمهور.
- رفع XLSX وCSV واستخراجهما، مراجعة الحقائق، رفض النسخة القديمة، رفض اعتماد المنشئ، منع عدم الاتزان الجوهري، وتجميد التقرير المعتمد بعد تغيير البيانات أو السياسة.
- هامش 30% من القيم المرجعية، وفصل تحرير النقد عن الربح. خفض التحصيل 10 أيام مع مبيعات آجلة 12 مليون ريال ينتج نحو 328,767.12 ريال كتوقيت نقدي. ترفض مدخلات السيناريو غير الرقمية أو المعكوسة أو خارج الحدود.
- تختلف أقسام التقرير وأسئلته باختلاف الجمهور والغرض والعمق؛ تبقى الأرقام والوحدات والتعريفات ثابتة بين العربية والإنجليزية. تمتنع أقسام المبيعات والقطاع عن تفاصيل غير موجودة، ويختفي الاستنتاج المرفوض من تقرير جديد ويمنع نشر مسودته القديمة.
- إجراء له مالك وموعد وخط أساس، ودليل قبل الإغلاق، ومراجع مستقل، ومبلغ متحقق مع فترة ومنهج وعوامل مؤثرة. يرفض الأثر المتداخل بين إجراءين. عرض المنفعة وتاريخها في الواجهة مُختبر.
- F13: تاريخ نسخ البيانات يحتفظ بالقيمة والمصدر والنسبة للحساب. F30: تنبيه داخلي للمالك وCFO مرة لكل يوم عمل بالرياض وحالة قراءة شخصية. F37: أعداد ومدد المحرك فعلية؛ التكلفة البشرية مدخلة صراحة، وتكلفة الحوسبة غير المقيسة تبقى null.

## الحدود المتبقية

- لا OCR عربي أو تكامل ERP أو SSO/MFA أو بيانات نظراء مرخصة حية. PDF النصي اختبر بعينة بسيطة وصفحة فارغة؛ الإحداثيات bbox مصرح بأنها غير متاحة، ودقة القوائم العربية متعددة الأعمدة لم تعتمد.
- 35 قيمة مؤشر في حالة مرجعية لا تثبت كل صناعة أو كل حالة حدية. القواعد العشر فُعّلت معًا؛ لم تكتمل عشر مصفوفات مستقلة لحالات الامتناع. تعريف النظراء وحقوق مصادرهم إقرار المستخدم، لا تحقق تجاري مستقل.
- اختبار الأثر يثبت ضوابط القياس وتصنيف التداخل؛ لا يثبت السببية أو صحة المستند التجاري. المبلغ بالريال يتطلب خط أساس نقديًا؛ خط أساس بالأيام لا يتحول تلقائيًا إلى منفعة مالية.
- تنبيهات التأخر تتولد عند قراءة المسارات؛ لا عامل جدولة دائم أو رسائل بريد خارجية. الجسر المتقدم لإعادة التصنيف والمحو الشامل والنسخ الاحتياطية الإنتاجية والتحميل والتزامن الواسع لم تثبت.
- AI يعمل بوضع الأدلة المحلية. الموجود عقد تحقق محلي بـ20 اختبارًا دون نقل بيانات أو نموذج خارجي. لا يوجد تكامل AI حي؛ ربطه يحتاج موافقة صريحة على الوجهة والبيانات. OCR وAI غير مفعّلين، وتكلفة الحوسبة المحلية غير مقيسة.
- فحص axe يخص حالات الصفحات التي فتحها الاختبار؛ لا يشمل تلقائيًا كل نافذة مخفية، ولا يساوي شهادة WCAG. الصور روجعت لسلامة العربية والتخطيط، لكن إخراج PDF متعدد الصفحات لم يعتمد بهذه الحزمة.
- SQLite والطوابير المحلية والتوثيق المحلي مناسبة لعرض تجريبي؛ لم تثبت جاهزية PostgreSQL/تشغيل إنتاجي أو مقاومة العبث الإداري أو اختبار اختراق.

## شفافية التشغيل

سجل API المعتمد انتهى عند `2026-09-27T13:55:19.459Z`. تشغيل sandbox الأول حُجب بخطأ EPERM، ثم نجح التشغيل المصرح. تكرار اختبارات تبديل أدوار demo بسرعة فعّل الحد الصحيح 40 محاولة مصادقة لكل IP خلال 15 دقيقة؛ احتفظنا بسجلات 429 ولم ننسبها إلى خلل الحساب أو الموافقات. تزامنت محاولة واجهة إضافية مع تبدل أجزاء JavaScript أثناء البناء ثم نجحت على بناء ثابت. عولج انتظار اختبار التنقل الهش بإشارة جاهزية المحتوى. اختفاء أعمدة الرسم في الالتقاط نتج عن إعادة الحركة عند تغيير حجم الالتقاط؛ تحققت الصور النهائية بعد إلغاء الحركة. سجلات الإخفاقات القديمة تبقى لإعادة الإنتاج، ويحدد الجدول أعلاه التشغيل الناجح المرجعي.

## سجل HTTP التفصيلي

| الفحص | السلوك المختبر | النتيجة |
|---|---|---|
| AUTH-01 | Health and anonymous session boundary | نجح |
| AUTH-02 | Register actual tenant, provision independent roles, log in | نجح |
| AUTH-03 | CSRF and member provisioning restrictions | نجح |
| DATA-01 | Upload XLSX, async extraction, units and source provenance | نجح |
| DATA-02 | Tenant and board source boundaries | نجح |
| DATA-03 | Approval refuses uploader and unreviewed facts | نجح |
| DATA-04 | Review all facts with revision conflict protection | نجح |
| CALC-01 | Real calculated analysis with source-backed metrics/findings | نجح |
| REPORT-01 | Dataset approval gate and independent report approval | نجح |
| SCENARIO-01 | Collection scenario cash timing calculated from actual credit sales | نجح |
| SCENARIO-02 | Reject invalid type, order, bounds, nulls and numeric strings | نجح |
| PEER-01 | Peer metadata and metric validation rejects arbitrary benchmarks | نجح |
| PEER-02 | Benchmark cohort eligibility and minimum sample size | نجح |
| ACTION-01 | Action required values and tenant owner validation | نجح |
| ACTION-02 | Evidence-gated closure by an independent reviewer | نجح |
| ACTION-03 | Benefit requires independent reviewer and measurement metadata | نجح |
| ACTION-04 | Second action cannot double-count overlapping benefit; evidence access scoped | نجح |
| AUDIENCE-01 | Audience changes structured content while preserving financial facts | نجح |
| AUDIENCE-02 | Audience selection cannot elevate board role or raw-source access | نجح |
| AUDIENCE-03 | Purpose and depth change actual report content | نجح |
| LANGUAGE-01 | Arabic and English report sections preserve identical financial definitions | نجح |
| FINDING-01 | CFO rejection after draft preparation blocks stale publication | نجح |
| FINDING-02 | New report omits rejected findings from decision/watchpoint sections | نجح |
| REPORT-02 | Fact edit invalidates approval and stale analyses; frozen report unchanged | نجح |
| DATA-05 | Material imbalance blocks dataset approval after human review | نجح |
| DATA-06 | Duplicate source ingestion is prevented or explicitly identified | نجح |
| DATA-07 | Unsupported type and missing upload rights fail safely | نجح |
| ASSISTANT-01 | Board assistant restricted to approved report with evidence | نجح |
| CONTROL-01 | Settings authority and audit attribution | نجح |
| CONTROL-02 | Settings versions invalidate drafts and downloads are audited | نجح |
| DATA-08 | Malformed short XLSX and impossible dates return controlled errors | نجح |
| DATA-09 | Validated CSV upload uses real extraction and currency units | نجح |
| VERSION-01 | Historical dataset versions retain original fact values and attribution | نجح |
| NOTIFY-01 | Overdue reminders reach owner and CFO once per business date | نجح |
| USAGE-01 | Actual engine usage is distinct from declared review cost and inactive providers | نجح |
| AUTH-04 | Logout revokes server session | نجح |

## إعادة التشغيل

راجع `../README.md`. ابدأ بخدمة محلية معزولة، وشغّل رحلات التوثيق بالتتابع لتجنب تراكم المصادقات. كل دليل نجاح هنا مقصور على السلوك والعينة المذكورين.

## النسخة النهائية

التحقق المحدود الأخير على البناء `index-D0Aspy2G.js` أثبت ظهور مبلغ الأثر وتاريخه بلون rgb(69, 99, 70)، وصفر مخالفات axe في الحوار الفعلي. آخر رحلتي استخدام ناجحتين تتضمنان اختبارات منظوري المجلس والتشغيل. أُوقفت خدمة QA المؤقتة على 4319؛ خدمة العرض الرئيسية 4317 لم تُوقف. لا تعديلات على ملفات التطبيق من هذه الحزمة.
