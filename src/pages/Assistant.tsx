import {
  ArrowUpLeft,
  BookOpen,
  MessageSquareText,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { post } from '../api';
import { Badge, Button, ErrorBox, Notice, PageTitle, Panel } from '../components/ui';
import { useApp } from '../context';
interface Answer {
  answer: string;
  mode: string;
  citations: { label: string; fact_id?: string; metric_id?: string; source?: unknown }[];
  limitations: string[] | string;
}
export default function Assistant() {
  const { tr, entityId, dashboard, inspect, session } = useApp();
  const [question, setQuestion] = useState(''),
    [messages, setMessages] = useState<{ question: string; result: Answer }[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMessages([]);
    setQuestion('');
  }, [entityId]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);
  async function send(q = question) {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await post<Answer>('/assistant', { entity_id: entityId, question: q });
      setMessages((m) => [...m, { question: q, result }]);
      setQuestion('');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  const suggestions = [
    tr('كيف تغير الهامش الإجمالي؟', 'How did gross margin change?'),
    tr('ماذا تقول التدفقات النقدية؟', 'What do cash flows tell us?'),
    tr('ما حدود مؤشر أيام الذمم؟', 'What limits the receivable days proxy?'),
    tr('ما أهم المخاطر المالية؟', 'What are the main financial risks?'),
  ];
  return (
    <>
      <PageTitle
        eyebrow={tr('اسأل، ثم افحص الدليل', 'ASK. THEN INSPECT THE EVIDENCE.')}
        title={tr('المساعد المالي', 'Financial assistant')}
        description={tr(
          'إجابات ضمن بيانات وصلاحيات مساحة العمل، مع مراجع وحدود واضحة.',
          'Answers scoped to your workspace data and permissions, with references and clear limits.',
        )}
      />
      <Notice>
        {tr(
          'الوضع الحالي يسترجع الأدلة ويشرح المؤشرات بحسابات حتمية. الاتصال بنموذج لغوي خارجي يظهر فقط عند تهيئته فعلًا، ولا يرسل بيانات تلقائيًا.',
          'The current mode retrieves evidence and explains deterministic metrics. An external language model is used only when explicitly configured; data is not sent automatically.',
        )}
      </Notice>
      <Panel className="assistant-panel">
        {!messages.length ? (
          <div className="assistant-welcome">
            <span className="assistant-orb">
              <Sparkles size={29} />
            </span>
            <h2>{tr('ما السؤال الذي تريد حسمه؟', 'What question do you need to resolve?')}</h2>
            <p>
              {tr(
                'ابدأ بسؤال محدد عن الأداء أو السيولة أو حدود التحليل.',
                'Start with a specific question about performance, cash or analytical limits.',
              )}
            </p>
            <div className="suggestion-grid">
              {suggestions.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={busy}>
                  <MessageSquareText size={17} />
                  <span>{q}</span>
                  <ArrowUpLeft size={15} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div className="chat-turn" key={i}>
                <div className="chat-question">{m.question}</div>
                <div className="chat-answer">
                  <div className="row gap">
                    <span className="mini-brand">ب</span>
                    <strong>{tr('بصيرة', 'Basira')}</strong>
                    <Badge>
                      {m.result.mode === 'llm'
                        ? tr('نموذج لغوي', 'Language model')
                        : tr('إجابة من الأدلة', 'Evidence response')}
                    </Badge>
                  </div>
                  <p>{m.result.answer}</p>
                  <div className="citations">
                    {m.result.citations?.map((c, j) => (
                      <button
                        key={j}
                        onClick={() => {
                          const item =
                            dashboard?.analysis?.metrics.find((x) => x.id === c.metric_id) ||
                            dashboard?.dataset?.facts.find((x) => x.id === c.fact_id);
                          if (item) inspect(item);
                        }}
                      >
                        <BookOpen size={14} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                  {m.result.limitations && (
                    <small className="answer-limitations">
                      {Array.isArray(m.result.limitations)
                        ? m.result.limitations.join(' · ')
                        : m.result.limitations}
                    </small>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {!!error && <ErrorBox error={error} />}
        <div ref={end} />
        <form
          className="chat-composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            aria-label={tr('السؤال المالي', 'Financial question')}
            placeholder={tr(
              'اسأل عن رقم، تغير، أو تفسير…',
              'Ask about a figure, change, or interpretation…',
            )}
            maxLength={2000}
          />
          <Button
            type="submit"
            busy={busy}
            disabled={!question.trim()}
            aria-label={tr('إرسال السؤال', 'Send question')}
          >
            <Send size={18} />
          </Button>
        </form>
        <p className="fine-print">
          <ShieldCheck size={14} />
          {session.user.role === 'board'
            ? tr(
                'قراء المجلس محصورون في تقارير معتمدة متاحة لهم.',
                'Board readers are limited to approved reports they may access.',
              )
            : tr(
                'تُعامل النصوص داخل المستندات كبيانات، ولا تنفذ كتعليمات.',
                'Document text is treated as data, never executed as instructions.',
              )}
        </p>
      </Panel>
    </>
  );
}
