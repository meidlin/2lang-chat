import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { translationService } from './services/translationService';
import { supabase, getChannelName, ChatEvent, generateClientId } from './services/realtime';

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
  const [role, setRole] = useState<'user1' | 'user2' | 'spectator' | ''>('');
  const [roomId] = useState<string>('global');
  
  const [displayName, setDisplayName] = useState<string>(() => localStorage.getItem('display_name') || '');
  const [user1OnlineName, setUser1OnlineName] = useState<string | null>(null);
  const [user2OnlineName, setUser2OnlineName] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  useEffect(() => {
    if (!supabase || !roomId) return;
    const clientId = generateClientId();
    const channel = supabase.channel(getChannelName(roomId), { config: { broadcast: { ack: true }, presence: { key: clientId } } });

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
    
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      // Presence state shape: { [clientId]: [ { name, ... }, ... ] }
      const entries = Object.entries(state) as Array<[string, any[]]>;
      // Order by first seen (existing order of keys is acceptable for simple rooms)
      const ordered = entries.map(([key, metas]) => ({ key, meta: metas?.[0] || {} }));
      const myIndex = ordered.findIndex(e => e.key === clientId);
      if (myIndex === 0) setRole('user1');
      else if (myIndex === 1) setRole('user2');
      else setRole('spectator');

      const first = ordered[0]?.meta || {};
      const second = ordered[1]?.meta || {};
      setUser1OnlineName(first.name ? String(first.name) : null);
      setUser2OnlineName(second.name ? String(second.name) : null);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ clientId, name: displayName || 'Anonymous' });
      }
    });
    return () => { channel.unsubscribe(); };
  }, [roomId, displayName]);

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

  const otherUser = role === 'user1' ? 'user2' : role === 'user2' ? 'user1' : null;
  const canSend = role === 'user1' || role === 'user2';

  // Onboarding: ask for display name first
  if (!displayName) {
    return (
      <div className="language-selection">
        <div className="language-container">
          <h1>🌍 Multilingual Chat</h1>
          <p>Welcome! What should we call you?</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <input
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', width: '70%' }}
            />
            <button
              className="start-chat-btn"
              onClick={() => { if (displayName.trim()) { localStorage.setItem('display_name', displayName.trim()); setDisplayName(displayName.trim()); } }}
            >Continue</button>
          </div>
        </div>
      </div>
    );
  }

  if (!user1Language || !user2Language || !role) {
    return (
      <div className="language-selection">
        <div className="language-container">
          <h1>🌍 Multilingual Chat</h1>
          <p>Your role: <strong>{role || 'assigning…'}</strong> • Name: <strong>{displayName}</strong></p>
          <p>Choose languages for both users to start chatting</p>
          {/* Room and invite link removed */}
          {/* OpenAI API key UI removed */}
          
          <div className="language-grid">
            <div className="language-section">
              <h3>👤 User 1 Language {user1OnlineName ? (<span className="presence-badge">{user1OnlineName}</span>) : (<span className="presence-badge waiting">waiting…</span>)}
              </h3>
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
              <h3>👤 User 2 Language {user2OnlineName ? (<span className="presence-badge">{user2OnlineName}</span>) : (<span className="presence-badge waiting">waiting…</span>)}
              </h3>
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

          <div style={{ textAlign: 'center', marginBottom: 8, color: '#555' }}>
            {role === 'user1' && 'Waiting for User 2 to join…'}
            {role === 'user2' && 'Connected with User 1.'}
            {role === 'spectator' && 'Spectator mode: read‑only view.'}
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
          onKeyDown={(e) => {
            const ne = e as unknown as React.KeyboardEvent<HTMLInputElement> & { nativeEvent: any };
            if (ne.key === 'Enter' && !ne.shiftKey && !(ne.nativeEvent && ne.nativeEvent.isComposing)) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={`Type a message as ${currentSender === 'user1' ? 'User 1' : 'User 2'}...`}
          
        />
        <button 
          onClick={sendMessage}
          disabled={!newMessage.trim() || !canSend}
          className="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
