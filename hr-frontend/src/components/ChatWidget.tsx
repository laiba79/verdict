import { useEffect, useRef, useState } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react';
import { askChatbot } from '../services/resources';
import { apiErrorMessage } from '../services/api';

type Msg = { role: 'user' | 'assistant'; content: string };

const ChatWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Hi! I'm the HR Assistant. Ask me about your team's numbers, pending approvals, or how to use this app." },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setInput('');
    const nextMessages: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setLoading(true);
    try {
      const { reply } = await askChatbot(text, nextMessages.slice(0, -1));
      setMessages([...nextMessages, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reach the assistant.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close HR Assistant' : 'Open HR Assistant'}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        {open ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[22rem] max-w-[calc(100vw-3rem)] h-[30rem] max-h-[calc(100vh-8rem)] panel flex flex-col overflow-hidden animate-fadeUp">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-white font-display">HR Assistant</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500">Scoped to your own data</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-primary-500 text-white rounded-br-sm'
                      : 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-200 rounded-bl-sm'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-white/[0.06] rounded-2xl rounded-bl-sm px-3.5 py-2 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                  <span className="text-xs text-slate-400">Thinking…</span>
                </div>
              </div>
            )}
            {error && (
              <div className="text-xs text-reject-500 bg-reject-50 dark:bg-reject-500/10 rounded-lg px-3 py-2">{error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="p-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask about your team…"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-sm text-slate-700 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-primary-400/40"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              aria-label="Send message"
              className="w-9 h-9 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatWidget;
