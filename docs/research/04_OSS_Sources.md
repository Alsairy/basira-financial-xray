# سجل المصادر الأولية — 27 سبتمبر 2026

جميع المصادر أدناه فُتحت أو قُرئت نتائجها الرسمية عبر أداة الويب بتاريخ **2026-09-27**. هذا تاريخ الاطلاع، وليس تاريخ نشر كل صفحة. لا توجد مصادر صحفية أو مدونات وسيطة في الاستدلال النهائي. صفحات الفروع المتحركة ليست إثباتاً لرخصة نسخة إنتاجية بعينها؛ تثبت ملفات الرخص والـcommit والأوزان عند اعتماد التنفيذ. «التحقق» يعني قراءة المصدر العام، لا تدقيقاً قانونياً ولا فحصاً عملياً للبرمجيات.

| ID | المصدر الرسمي والرابط | ما يدعمه وحدوده |
|---|---|---|
| S01 | [Docling repository](https://github.com/docling-project/docling) | MIT للكود؛ استقلال رخص النماذج؛ PDF/layout/tables/JSON وتشغيل محلي. لا يثبت دقة القوائم السعودية. |
| S02 | [Docling model bundle](https://huggingface.co/docling-project/docling-models) | بطاقة الحزمة تعرض CDLA-Permissive-2.0 وApache-2.0؛ لا يعمم أحدهما على كل نموذج optional. |
| S03 | [Docling Heron model](https://huggingface.co/docling-project/docling-layout-heron) | بطاقة النموذج الرسمي تعرض Apache-2.0. |
| S04 | [Docling releases](https://github.com/docling-project/docling/releases) | عرض أحدث وسم v2.130.0 بتاريخ 22 Sep، commit الظاهر 92fc74c؛ قرينة نشاط فقط. |
| S05 | [PaddleOCR repository](https://github.com/PaddlePaddle/PaddleOCR) | Apache-2.0؛ وثائق العربية ضمن عائلة نماذج محددة وPaddleOCR-VL؛ لا يمثل ضمان دقة. |
| S06 | [PaddleOCR-VL model card](https://huggingface.co/PaddlePaddle/PaddleOCR-VL) | Apache-2.0 لهذا النموذج؛ العربية ضمن الدعم المعلن. تذكر الصفحة نسخة أحدث منفصلة؛ لا تنسب رخصتها أو نتائجها دون فحصها. |
| S07 | [PaddleOCR releases](https://github.com/PaddlePaddle/PaddleOCR/releases) | v3.7.0 بتاريخ 2026-06-11، commit b03f464. إعلان PP-OCRv6 يذكر مجموعة لغات؛ لا يفترض دعم العربية في كل إصدار فرعي. |
| S08 | [PaddleOCR OCR usage documentation](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/pipeline_usage/OCR.html) | وثيقة رسمية عن lang/model compatibility؛ نتيجة الفهرسة أقدم من README الحالي، لذلك لم تُستخدم لتجميد قائمة أحدث اللغات. |
| S09 | [Marker repository](https://github.com/datalab-to/marker) | README الحالي Apache-2.0 للكود، commercial usage يفصل الأوزان. |
| S10 | [Marker code license](https://github.com/datalab-to/marker/blob/master/LICENSE) | Apache License 2.0 للكود في الفرع الحالي؛ لا تعميم على إصدارات تاريخية. |
| S11 | [Marker model license](https://github.com/datalab-to/marker/blob/master/MODEL_LICENSE) | Modified AI Pubs Open RAIL-M؛ حدود تجارية للإيرادات/التمويل/المنافسة؛ شروط إسناد ومشاركة بالمثل في النص؛ يتطلب فحص نطاقه وتراخيص الأوزان الفعلية قبل الاستخدام. |
| S12 | [Unstructured repository](https://github.com/Unstructured-IO/unstructured) | Apache-2.0 للمكتبة؛ يميزها وصف الصفحة عن Platform التجاري. |
| S13 | [Arelle repository](https://github.com/Arelle/Arelle) | منصة XBRL؛ نطاقها هو الملفات المهيكلة، لا OCR مالي. |
| S14 | [Arelle LICENSE.md](https://github.com/Arelle/Arelle/blob/master/LICENSE.md) | Apache-2.0؛ تبعيات وإضافات قد تتبع شروطاً خاصة. |
| S15 | [Arelle releases](https://github.com/Arelle/Arelle/releases) | 2.45.3 بتاريخ 24 Sep، commit 21b08df؛ نشاط صيانة وليس SLA. |
| S16 | [DuckDB repository](https://github.com/duckdb/duckdb) | MIT؛ قاعدة تحليلات in-process. تقييم ملاءمتها للـMVP توصية تصميم. |
| S17 | [Polars repository](https://github.com/pola-rs/polars) | MIT؛ DataFrame/query engine. |
| S18 | [PostgreSQL license](https://www.postgresql.org/about/licence/) | PostgreSQL License؛ النص الرسمي. |
| S19 | [PostgreSQL row security policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | superuser/BYPASSRLS يتجاوزان RLS، والمالك عادةً يتجاوزها إلا مع FORCE؛ RLS ليست طبقة تفويض لكل بقية الأنظمة. |
| S20 | [dbt repository](https://github.com/dbt-labs/dbt) | تم الوصول إليه عبر redirect من dbt-core؛ main يصف Rust v2 Apache-2.0، distribution بترخيص منتج منفصل. |
| S21 | [dbt Python v1 branch](https://github.com/dbt-labs/dbt/tree/1.latest) | فرع Python v1 الحالي المشار إليه من README؛ تثبيت artifact وإصدار مطلوب. |
| S22 | [Pandera repository](https://github.com/unionai-oss/pandera) | MIT؛ validation لمكتبات DataFrame منها Polars، وتحذير تغيّر import path. |
| S23 | [Great Expectations repository](https://github.com/fivetran/great_expectations) | Apache-2.0؛ الرابط القديم great-expectations يحوّل إلى fivetran. لا استنتاج لدعم مستقبلي من redirect. |
| S24 | [GX releases](https://github.com/fivetran/great_expectations/releases) | 1.23.1 بتاريخ 18 Sep، commit b6bf1ed؛ قرينة نشاط. |
| S25 | [FinanceToolkit repository](https://github.com/JerBouma/FinanceToolkit) | MIT؛ موصلات FMP/Yahoo وفصل التزامات مصدر البيانات؛ توثيق fallback. لا يعتمد تسعير أو حدود FMP من مكتبة وسيطة. |
| S26 | [FinanceToolkit releases](https://github.com/JerBouma/FinanceToolkit/releases) | v2.2.0 بتاريخ 18 Aug، commit 9fa19f9؛ الإصدار يناقش تصحيح صيغ، وهو سبب للاختبار المستقل لا شهادة صحة. |
| S27 | [OpenBB repository](https://github.com/OpenBB-finance/OpenBB) | AGPLv3، منصة دمج بيانات عامة/مرخصة/خاصة وليست ترخيصاً لبيانات المزودين. |
| S28 | [OpenBB license](https://github.com/OpenBB-finance/OpenBB/blob/develop/LICENSE) | AGPLv3 في الفرع الحالي؛ تقييم طريقة الدمج يحتاج مراجعة. |
| S29 | [Apache Superset repository](https://github.com/apache/superset) | Apache-2.0؛ visualization/data exploration. |
| S30 | [Metabase repository](https://github.com/metabase/metabase) | ملفات AGPL وMCL وembedding منفصلة. |
| S31 | [Metabase LICENSE.txt](https://github.com/metabase/metabase/blob/master/LICENSE.txt) | مجلد enterprise وترخيصه التجاري؛ بقية المصدر AGPL ما لم يذكر خلاف ذلك؛ تفريق binaries. |
| S32 | [Temporal repository](https://github.com/temporalio/temporal) | MIT للخادم؛ durable workflows وإعادة المحاولة. لا استنتاج لسعر/منطقة/عقد Temporal Cloud. |
| S33 | [LangGraph repository](https://github.com/langchain-ai/langgraph) | MIT للمكتبة؛ لا يعمم على خدمات تجارية مرتبطة. |
| S34 | [Qdrant repository](https://github.com/qdrant/qdrant) | Apache-2.0؛ vector engine. سياسات isolation المقترحة مسؤولية تطبيقنا. |
| S35 | [Keycloak repository](https://github.com/keycloak/keycloak) | Apache-2.0؛ IAM وOIDC/SAML؛ لا تعني المصادقة صحة RLS. |
| S36 | [OpenTelemetry Python repository](https://github.com/open-telemetry/opentelemetry-python) | Apache-2.0 لـAPI/SDK؛ سياسة تقليل البيانات في traces توصية تصميم. |
| S37 | [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | بلا مفاتيح API؛ companyfacts/frames/submissions/bulk؛ standard non-custom entity-wide facts؛ التحذير من اختلاف الفترات. المصدر الأهم لحدود التغطية. |
| S38 | [SEC webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) | تصريح بإتاحة إعادة استخدام government-created وEDGAR public filing content؛ ومتطلبات هوية آلية. لا يعمم على كل موقع مالي أو علامة SEC. |
| S39 | [SEC developer resources](https://www.sec.gov/about/developer-resources) | حد Fair Access الحالي 10 requests/sec إجمالاً، والتنزيل الكفء. |
| S40 | [IFRS Accounting Taxonomy](https://www.ifrs.org/issued-standards/ifrs-taxonomy/) | وظيفة taxonomy وروابط licensing، ليست قاعدة بيانات شركات. |
| S41 | [IFRS digital financial reporting](https://www.ifrs.org/digital-financial-reporting/) | استخدام غير تجاري مجاني؛ integration في products/services يحتاج licence. |
| S42 | [IFRS taxonomy terms PDF](https://www.ifrs.org/content/dam/ifrs/about-us/legal-and-governance/legal-docs/taxonomy/taxonomy-terms-and-conditions.pdf) | definitions لـCommercial/Professional use، ومادة الترخيص؛ PDF رسمي 4 صفحات فُتح كنص. |
| S43 | [Damodaran data index](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/data.html) | أنواع التجميعات وروابط الاستخدام؛ لم يُعد توزيع أي dataset. |
| S44 | [Damodaran site guide](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/guide.html) | الاستخدام المهني/البحثي ونسب المصدر؛ طلب عدم بيع البيانات. لا يمنح تلقائياً حق تضمين/إعادة بيع SaaS. |
| S45 | [Damodaran data caveats](https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacaveat.htm) | الاعتماد على مزودي بيانات وتجنب نسخ بيانات الشركات الفردية؛ حدود دقة المصدر. |
| S46 | [Saudi Exchange legal notice — official indexed URL](https://www.saudiexchange.sa/wps/portal/saudiexchange/hidden/legal_notice?csrt=96579565926507294&locale=en) | النص الرسمي ظهر في نتائج البحث ويقيد التخزين في retrieval systems وإعادة النشر بإذن سابق. محاولة فتح URL المبسط أعادت Internal Error؛ يجب إعادة قراءة نص حي كامل عند التعاقد. لا يُعرض هنا كرخصة مفتوحة. |
| S47 | [S&P Global licensing terms](https://www.spglobal.com/en/licensing-terms-and-conditions) | الربط بين الشروط الإقليمية والـOrder والـExhibit. ليس إثباتاً لتغطية السعودية أو عرض سعر أو حق derived-data خاص. |
| S48 | [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | الحقن غير المباشر والمرئي، فصل التعليمات/البيانات، صلاحيات دنيا وتحقق مخرجات؛ لا ضمان منع كامل. |
| S49 | [OWASP file upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | فحوص أنواع الملفات والحجم والتخزين/الصلاحيات وطبقات دفاع الرفع. |
| S50 | [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html) | الثقة بالمصدر والصلاحيات عبر دورة إدخال واسترجاع المحتوى؛ تصميم isolation تفصيلي مقترح في المذكرة. |
| S51 | [OWASP secure AI model ops](https://cheatsheetseries.owasp.org/cheatsheets/Secure_AI_Model_Ops_Cheat_Sheet.html) | مخاطر model files والتسميم وحماية دورة التشغيل؛ يدعم تثبيت ومراجعة artifacts. |

## نقاط عدم اليقين التي يجب ألا تضيع في ملخص تنفيذي

- لا إثبات في هذا العمل لجودة استخراج رقمية على قوائم عربية فعلية؛ جميع نسب الجودة المذكورة gates مستهدفة وليست نتائج.
- لا اتفاق بيانات سعودي، ولا عرض مورد، ولا licence تجارية IFRS/Marker تم الحصول عليه. لم يتم التواصل مع جهات خارجية.
- لا مراجعة شاملة لتراخيص جميع التبعيات/الأوزان/الخطوط، ولا تدقيق CVE، ولا تثبيت تجريبي. النصوص التي تذكر Apache/MIT تخص المكون المعين؛ المكدس الكامل قد يحتوي عناصر أخرى.
- لا وعد بأن قاعدة SEC تجيب عن private Saudi peers؛ مقارنات جغرافية/محاسبية وقطاعية تحتاج اختياراً وتطبيعاً.
- صفحات latest/main متحركة. الوصول في 2026-09-27 يمنع الاعتماد على أوصاف قديمة، لكنه لا يغني عن pin وsnapshot وقت الشحن.
- 12 أسبوعاً تقدير لبداية pilot ضيقة بالموارد المذكورة، ولا يشمل الاعتمادات التنظيمية أو بناء قاعدة عالمية أو integrations غير محدودة.
