import React, { useState, useRef, useEffect } from 'react';
import { Terminal, X, ArrowUp, MessageSquarePlus } from 'lucide-react';
import axios from 'axios';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { pollAgentTask } from '../utils/pollAgentTask';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    '> САЙН БАЙНА УУ! Би таны AI туслагч.\n> Ерөнхий яриа, асуулт, санаа — юуг ч асууж болно. Салбар, компьютер, захиалгын талаар бол би өгөгдлөөр тусална.',
};

function initialMessages() {
  return [{ ...WELCOME_MESSAGE }];
}

export default function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [chatEpoch, setChatEpoch] = useState(0);
  const messagesEndRef = useRef(null);
  const chatAbortRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(
    () => () => {
      chatAbortRef.current?.abort();
    },
    []
  );

  const startNewChat = () => {
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setChatEpoch((e) => e + 1);
    setMessages(initialMessages());
    setInput('');
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    let location = null;
    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      } catch (err) {
        console.warn('Location access denied or timeout');
      }
    }

    // Capture history BEFORE we append the new user message so the server
    // gets prior turns as context (last 12 turns max to stay under token limits).
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      // Longer than core-api AGENT_RESPONSE_TIMEOUT_MS (default 30s) so axios does not
      // abort before the API returns 200 or 202.
      const response = await api.post(
        '/agent/chat',
        { message: userMsg, history, location },
        { signal: controller.signal, timeout: 120_000 }
      );
      if (chatAbortRef.current !== controller) return;

      let replyText;
      if (response.status === 202 && response.data?.taskId) {
        replyText = await pollAgentTask(api, response.data.taskId, {
          signal: controller.signal,
        });
      } else if (response.data?.reply != null && response.data.reply !== '') {
        replyText = String(response.data.reply);
      } else {
        replyText = '> АЛДАА :: Хариу ирээгүй\n> Дахин оролдоно уу';
      }

      if (chatAbortRef.current !== controller) return;
      setMessages((prev) => [...prev, { role: 'assistant', content: replyText }]);
    } catch (err) {
      if (axios.isCancel(err) || err.code === 'ERR_CANCELED') return;
      if (chatAbortRef.current !== controller) return;
      const fallback =
        err.agentTimeout || err.agentError
          ? `> ${String(err.message)}`
          : '> АЛДАА :: илгээж чадсангүй\n> Дахин оролдоно уу';
      setMessages((prev) => [...prev, { role: 'assistant', content: fallback }]);
    } finally {
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        setLoading(false);
      }
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
            <div className="chat-header-actions">
              <button
                type="button"
                className="chat-header-btn"
                onClick={startNewChat}
                disabled={loading}
                title="Шинэ чат — өмнөх яриа устгагдана"
              >
                <MessageSquarePlus size={14} />
              </button>
              <button type="button" className="chat-header-btn" onClick={() => setOpen(false)} title="Хаах">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={`${chatEpoch}-${i}`} className={`chat-msg ${msg.role}`}>
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
