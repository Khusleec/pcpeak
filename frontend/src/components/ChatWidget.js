import React, { useState, useRef, useEffect } from 'react';
import { Terminal, X, ArrowUp } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '> САЙН БАЙНА УУ! Би таны AI туслагч.\n> Юу ч асууж болно — программ, орчуулга, зөвлөгөө эсвэл Mongol PC-ийн захиалга.' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');
    // Capture history BEFORE we append the new user message so the server
    // gets prior turns as context (last 10 turns max to stay under token limits).
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const { data } = await api.post('/agent/chat', { message: userMsg, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '> АЛДАА :: илгээж чадсангүй\n> Дахин оролдоно уу' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) return null;

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="dot alert" />
              <span className="chat-header-title">AI//ТУСЛАГЧ</span>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={14} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div className="chat-msg assistant">
                <span className="blink">▮</span> бодож байна...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="> Асуултаа бичнэ үү..."
              disabled={loading}
            />
            <button className="btn btn-primary" onClick={sendMessage} disabled={loading}>
              <ArrowUp size={11} />
            </button>
          </div>
        </div>
      )}

      <button className="chat-toggle" onClick={() => setOpen(!open)} title="AI ТУСЛАГЧ">
        {open ? <X size={20} /> : <Terminal size={20} />}
      </button>
    </div>
  );
}
