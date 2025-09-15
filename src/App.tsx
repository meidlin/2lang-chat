import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { translationService } from './services/translationService';
import { supabase, getChannelName, ChatEvent } from './services/realtime';

interface Message {
  id: string;
  text: string;
  translatedText?: string;
  sender: 'user1' | 'user2';
  timestamp: Date;
  showOriginal?: boolean;
}

interface Language {
  code: string;
  name: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

function App() {
  const [user1Language, setUser1Language] = useState<string>('');
  const [user2Language, setUser2Language] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentSender, setCurrentSender] = useState<'user1' | 'user2'>('user1');
  const [, setIsTranslating] = useState(false);
  const [typingUser, setTypingUser] = useState<'user1' | 'user2' | null>(null);
  const [role, setRole] = useState<'user1' | 'user2' | ''>('');
  const [roomId] = useState<string>('global');
  const [channelReady, setChannelReady] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  useEffect(() => {
    if (!supabase || !roomId) return;
    const channel = supabase.channel(getChannelName(roomId), { config: { broadcast: { ack: true } } });

    channel.on('broadcast', { event: 'chat' }, ({ payload }: { payload: ChatEvent }) => {
      if (payload.type === 'message') {
        const msg: Message = {
          id: payload.id,
          text: payload.text,
          sender: payload.sender,
          timestamp: new Date(payload.timestamp),
          showOriginal: false,
        };
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      } else if (payload.type === 'typing') {
        setTypingUser(payload.isTyping ? payload.sender : null);
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setChannelReady(true);
    });
    return () => { setChannelReady(false); channel.unsubscribe(); };
  }, [roomId]);

  // OpenAI key entry removed; service will use env var if set

  const translateText = async (text: string, fromLang: string, toLang: string): Promise<string> => {
    if (fromLang === toLang) return text;
    
    setIsTranslating(true);
    try {
      const result = await translationService.translateText(text, fromLang, toLang);
      return result.translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user1Language || !user2Language) return;

    const messageId = Date.now().toString();
    const message: Message = {
      id: messageId,
      text: newMessage,
      sender: currentSender,
      timestamp: new Date(),
      showOriginal: false
    };

    // Immediately render the sender's message
    setMessages(prev => [...prev, message]);
    setNewMessage('');

    // Broadcast message over realtime
    if (supabase && roomId) {
      const evt: ChatEvent = { type: 'message', id: messageId, text: message.text, sender: currentSender, timestamp: message.timestamp.toISOString() };
      supabase.channel(getChannelName(roomId)).send({ type: 'broadcast', event: 'chat', payload: evt });
    }

    // If languages differ, translate asynchronously and update the received copy
    if (user1Language !== user2Language) {
      const targetLanguage = currentSender === 'user1' ? user2Language : user1Language;
      const sourceLanguage = currentSender === 'user1' ? user1Language : user2Language;

      const receivingUser = currentSender === 'user1' ? 'user2' : 'user1';
      setTypingUser(receivingUser);
      if (supabase && roomId) {
        const typingOn: ChatEvent = { type: 'typing', sender: currentSender, isTyping: true };
        supabase.channel(getChannelName(roomId)).send({ type: 'broadcast', event: 'chat', payload: typingOn });
      }

      try {
        const translated = await translateText(message.text, sourceLanguage, targetLanguage);
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, translatedText: translated } : m));
      } finally {
        setTypingUser(null);
        if (supabase && roomId) {
          const typingOff: ChatEvent = { type: 'typing', sender: currentSender, isTyping: false };
          supabase.channel(getChannelName(roomId)).send({ type: 'broadcast', event: 'chat', payload: typingOff });
        }
      }
    }
  };

  const toggleOriginalText = (messageId: string) => {
    setMessages(prev => 
      prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, showOriginal: !msg.showOriginal }
          : msg
      )
    );
  };

  const switchSender = () => {
    setCurrentSender(prev => prev === 'user1' ? 'user2' : 'user1');
  };

  const goBackToLanguageSelection = () => {
    setMessages([]);
    setNewMessage('');
    setCurrentSender('user1');
    setUser1Language('');
    setUser2Language('');
  };

  const refreshApp = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } finally {
      window.location.reload();
    }
  };

  // Invite link removed

  if (!user1Language || !user2Language || !role) {
    return (
      <div className="language-selection">
        <div className="language-container">
          <h1>🌍 Multilingual Chat</h1>
          <p>Choose languages for both users to start chatting</p>
          {/* Room and invite link removed */}
          <div style={{
            background: '#f5f6ff',
            border: '1px solid #e2e6ff',
            padding: '12px',
            borderRadius: 12,
            marginBottom: 16,
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <strong>OpenAI API key (optional)</strong>
              {apiKeySaved && (
                <span style={{ fontSize: 12, color: '#4b5563' }}>
                  Saved ✓ {apiKey.length > 8 ? `…${apiKey.slice(-4)}` : ''}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db' }}
              />
              <button
                onClick={() => { localStorage.setItem('openai_api_key', apiKey); setApiKeySaved(!!apiKey); translationService.setApiKey(apiKey); }}
                style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #c7d2fe', background: '#e0e7ff', cursor: 'pointer' }}
              >Save</button>
              {apiKeySaved && (
                <button
                  onClick={() => { localStorage.removeItem('openai_api_key'); setApiKey(''); setApiKeySaved(false); translationService.setApiKey(''); }}
                  style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fee2e2', cursor: 'pointer' }}
                >Clear</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
              Without a key, we use public fallback translators which may be inconsistent. A key enables high‑quality GPT translations.
            </div>
          </div>
          
          <div className="language-grid">
            <div className="language-section">
              <h3>👤 User 1 Language</h3>
              <div className="language-options">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    className={`language-btn ${user1Language === lang.code ? 'selected' : ''}`}
                    onClick={() => setUser1Language(lang.code)}
                  >
                    <span className="flag">{lang.flag}</span>
                    <span className="name">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="language-section">
              <h3>👤 User 2 Language</h3>
              <div className="language-options">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    className={`language-btn ${user2Language === lang.code ? 'selected' : ''}`}
                    onClick={() => setUser2Language(lang.code)}
                  >
                    <span className="flag">{lang.flag}</span>
                    <span className="name">{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, justifyContent: 'center' }}>
            <button 
              className={`start-chat-btn ${role === 'user1' ? 'selected' : ''}`}
              onClick={() => setRole('user1')}
            >
              I am User 1
            </button>
            <button 
              className={`start-chat-btn ${role === 'user2' ? 'selected' : ''}`}
              onClick={() => setRole('user2')}
            >
              I am User 2
            </button>
          </div>

          {user1Language && user2Language && role && (
            <button 
              className="start-chat-btn"
              onClick={() => {}}
            >
              Start Chatting! 💬
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="chat-header">
        <button className="back-btn" onClick={goBackToLanguageSelection} aria-label="Back to language selection">← Back</button>
        <div className="language-display">
          <span className="user1-lang">
            {LANGUAGES.find(l => l.code === user1Language)?.flag} User 1
          </span>
          <span className="separator">↔️</span>
          <span className="user2-lang">
            {LANGUAGES.find(l => l.code === user2Language)?.flag} User 2
          </span>
        </div>
        <div className="header-actions">
          <button className="refresh-btn" onClick={refreshApp} aria-label="Refresh app">Refresh</button>
          <button className="switch-user-btn" onClick={switchSender}>
            Switch to {currentSender === 'user1' ? 'User 2' : 'User 1'}
          </button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map(message => {
          const isSentByCurrentUser = message.sender === currentSender;
          const hasTranslation = Boolean(message.translatedText);
          const showTranslation = !isSentByCurrentUser && hasTranslation && !message.showOriginal;

          return (
            <div key={message.id} className={`message ${isSentByCurrentUser ? 'sent' : 'received'}`}>
              <div className="message-content">
                {showTranslation ? (
                  <div className="translated-text">
                    {message.translatedText}
                    <button 
                      className="show-original-btn"
                      onClick={() => toggleOriginalText(message.id)}
                    >
                      Show original
                    </button>
                  </div>
                ) : (
                  <div className="original-text">
                    {message.text}
                    {hasTranslation && !isSentByCurrentUser && (
                      <button 
                        className="show-original-btn"
                        onClick={() => toggleOriginalText(message.id)}
                      >
                        Show translation
                      </button>
                    )}
                    {hasTranslation && isSentByCurrentUser && (
                      <button 
                        className="show-original-btn"
                        onClick={() => toggleOriginalText(message.id)}
                      >
                        {message.showOriginal ? 'Show translation' : 'Show translation'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="message-time">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          );
        })}
        {typingUser && typingUser === currentSender && (
          <div className="translating-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>{currentSender === 'user1' ? 'User 2' : 'User 1'} is typing…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="message-input">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder={`Type a message as ${currentSender === 'user1' ? 'User 1' : 'User 2'}...`}
          
        />
        <button 
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
