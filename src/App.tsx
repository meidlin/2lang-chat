import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { translationService } from './services/translationService';
import { getOrCreateClientId } from './services/realtime';
import { supabaseChatService } from './services/supabaseChat';
import EnvDebug from './EnvDebug';

interface Message {
  id: string;
  text: string;
  translatedText?: string;
  sender: 'user1' | 'user2';
  senderName: string;
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
  console.log('🚀 App component is starting to render...');
  const [user1Language, setUser1Language] = useState<string>('');
  const [user2Language, setUser2Language] = useState<string>('');
  const [myLanguage, setMyLanguage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentSender, setCurrentSender] = useState<'user1' | 'user2'>('user1');
  const [typingUser, setTypingUser] = useState<'user1' | 'user2' | null>(null);
  const [role, setRole] = useState<'user1' | 'user2' | 'spectator' | ''>('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  const [displayName, setDisplayName] = useState<string>(() => {
    const clientId = getOrCreateClientId();
    return sessionStorage.getItem(`display_name_${clientId}`) || '';
  });
  const [pendingName, setPendingName] = useState<string>(() => displayName || '');
  const [user1OnlineName, setUser1OnlineName] = useState<string | null>(null);
  const [user2OnlineName, setUser2OnlineName] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [presenceDebug, setPresenceDebug] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  // Initialize shared chat service
  useEffect(() => {
    const initializeChat = async () => {
      const clientId = getOrCreateClientId();
      console.log('🔧 Initializing chat for clientId:', clientId);
      
      // Clean up old presence first
      await supabaseChatService.cleanupOldPresence();
      
      // Assign role based on existing presence or create new one
      const presence = await supabaseChatService.getPresence();
      console.log('👥 Current presence:', presence);
      
      const existingUser = presence.find(p => p.clientId === clientId);
      console.log('🔍 Existing user found:', existingUser);
      
      if (existingUser) {
        console.log('✅ Using existing role:', existingUser.role);
        setRole(existingUser.role);
      } else {
        // New user - assign role based on existing users
        const user1Count = presence.filter(p => p.role === 'user1').length;
        const user2Count = presence.filter(p => p.role === 'user2').length;
        
        console.log('📊 Role counts - User1:', user1Count, 'User2:', user2Count);
        
        let newRole: 'user1' | 'user2' | 'spectator';
        if (user1Count === 0) {
          newRole = 'user1';
        } else if (user2Count === 0) {
          newRole = 'user2';
        } else {
          newRole = 'spectator';
        }
        
        console.log('🎯 Assigned new role:', newRole);
        setRole(newRole);
        
        // Update presence immediately with the new role
        await supabaseChatService.updatePresence(clientId, displayName || 'Anonymous', newRole);
        console.log('✅ Presence updated with role:', newRole);
        
        // Wait a moment for the presence to propagate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh presence to ensure it's updated
        const updatedPresence = await supabaseChatService.getPresence();
        console.log('🔄 Refreshed presence after role assignment:', updatedPresence);
      }
    };

    initializeChat();

    // Subscribe to messages
    const unsubscribeMessages = supabaseChatService.subscribeToMessages((sharedMessages) => {
      const convertedMessages: Message[] = sharedMessages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      setMessages(convertedMessages);
      setConnectionStatus('connected');
    });

    // Subscribe to presence
    const unsubscribePresence = supabaseChatService.subscribeToPresence((presence) => {
      setTotalUsers(presence.length);
      
      const user1 = presence.find(p => p.role === 'user1');
      const user2 = presence.find(p => p.role === 'user2');
      
      setUser1OnlineName(user1?.name || null);
      setUser2OnlineName(user2?.name || null);
      
      setPresenceDebug(`Supabase real-time: ${presence.length} users online`);
      setConnectionStatus('connected');
    });

    return () => {
      unsubscribeMessages();
      unsubscribePresence();
    };
  }, [displayName]);

  // Update presence when displayName changes
  useEffect(() => {
    if (!displayName) return;
    const clientId = getOrCreateClientId();
    supabaseChatService.updatePresence(clientId, displayName, role as 'user1' | 'user2' | 'spectator');
  }, [displayName, role]);

  // Sync my language choice with the appropriate user language
  useEffect(() => {
    if (!myLanguage || !role) return;
    
    if (role === 'user1') {
      setUser1Language(myLanguage);
    } else if (role === 'user2') {
      setUser2Language(myLanguage);
    }
  }, [myLanguage, role]);

  // OpenAI key entry removed; service will use env var if set

  const translateText = async (text: string, fromLang: string, toLang: string): Promise<string> => {
    if (fromLang === toLang) return text;
    
    try {
      const result = await translationService.translateText(text, fromLang, toLang);
      return result.translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  const sendMessage = async () => {
    console.log('🚀 sendMessage called');
    console.log('📝 newMessage:', newMessage);
    console.log('🌍 myLanguage:', myLanguage);
    console.log('👤 currentSender:', currentSender);
    console.log('📛 displayName:', displayName);
    
    if (!newMessage.trim()) {
      console.log('❌ No message text');
      return;
    }
    
    if (!myLanguage) {
      console.log('❌ No language selected');
      return;
    }

    const messageText = newMessage;
    setNewMessage('');
    console.log('✅ Message validation passed, proceeding...');

    try {
      console.log('📤 Adding message to Supabase...');
      const messageData = {
        text: messageText,
        sender: currentSender,
        senderName: displayName || 'Anonymous',
        showOriginal: false
      };
      console.log('📦 Message data:', messageData);
      
      const messageId = await supabaseChatService.addMessage(messageData);
      console.log('✅ Message added with ID:', messageId);

      // If there are other users online with different languages, translate the message
      console.log('🔍 Checking translation conditions...');
      console.log('👥 user1OnlineName:', user1OnlineName);
      console.log('👥 user2OnlineName:', user2OnlineName);
      console.log('🌍 user1Language:', user1Language);
      console.log('🌍 user2Language:', user2Language);
      
      if (user1OnlineName && user2OnlineName && user1Language && user2Language && user1Language !== user2Language) {
        console.log('🔄 Translation needed, starting translation...');
        const targetLanguage = currentSender === 'user1' ? user2Language : user1Language;
        const sourceLanguage = myLanguage;

        const receivingUser = currentSender === 'user1' ? 'user2' : 'user1';
        setTypingUser(receivingUser);
        console.log('⏳ Setting typing indicator for:', receivingUser);

        try {
          console.log('🌐 Translating from', sourceLanguage, 'to', targetLanguage);
          const translated = await translateText(messageText, sourceLanguage, targetLanguage);
          console.log('✅ Translation result:', translated);
          await supabaseChatService.updateMessage(messageId, { translatedText: translated });
          console.log('✅ Translation saved to message');
        } finally {
          setTypingUser(null);
          console.log('✅ Typing indicator cleared');
        }
      } else {
        console.log('ℹ️ No translation needed');
      }
      
      console.log('🎉 Message send process completed successfully');
    } catch (error) {
      console.error('💥 Error sending message:', error);
      console.error('💥 Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      });
      // Show error to user
      alert('Failed to send message. Please check your connection and try again. Check console for details.');
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
    supabaseChatService.clearChat();
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

  const canSend = role === 'user1' || role === 'user2';
  
  // Debug canSend
  console.log('🔍 canSend debug:', {
    role,
    canSend,
    isUser1: role === 'user1',
    isUser2: role === 'user2'
  });

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
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', width: '70%' }}
            />
            <button
              className="start-chat-btn"
              onClick={() => { 
                const n = pendingName.trim(); 
                if (n) { 
                  const clientId = getOrCreateClientId();
                  sessionStorage.setItem(`display_name_${clientId}`, n); 
                  setDisplayName(n); 
                } 
              }}
            >Continue</button>
          </div>
        </div>
      </div>
    );
  }

  if (!myLanguage || !role) {
    return (
      <div className="language-selection">
        <div className="language-container">
          <h1>🌍 Multilingual Chat</h1>
          <p>Your role: <strong>{role || 'assigning…'}</strong> • Name: <strong>{displayName}</strong></p>
          <p>Online users: <strong>{totalUsers}</strong></p>
          <p>Choose languages for both users to start chatting</p>
          {presenceDebug && (
            <details style={{ margin: '10px 0', padding: '10px', background: '#f5f5f5', borderRadius: '4px', fontSize: '12px' }}>
              <summary>Debug Info</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{presenceDebug}</pre>
            </details>
          )}
          {/* Room and invite link removed */}
          {/* OpenAI API key UI removed */}
          
          <div className="language-section">
            <h3>🌍 Choose Your Language</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
              Select the language you want to chat in. Other users will see your messages in their chosen language.
            </p>
            <div className="language-options">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  className={`language-btn ${myLanguage === lang.code ? 'selected' : ''}`}
                  onClick={() => setMyLanguage(lang.code)}
                >
                  <span className="flag">{lang.flag}</span>
                  <span className="name">{lang.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Show other users' language choices */}
          {(user1OnlineName || user2OnlineName) && (
            <div className="other-users-section" style={{ marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '10px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#333' }}>Other Users Online</h4>
              {user1OnlineName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span>👤 {user1OnlineName}</span>
                  <span className="presence-badge">
                    {user1Language ? LANGUAGES.find(l => l.code === user1Language)?.flag + ' ' + LANGUAGES.find(l => l.code === user1Language)?.name : 'Choosing language...'}
                  </span>
                </div>
              )}
              {user2OnlineName && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>👤 {user2OnlineName}</span>
                  <span className="presence-badge">
                    {user2Language ? LANGUAGES.find(l => l.code === user2Language)?.flag + ' ' + LANGUAGES.find(l => l.code === user2Language)?.name : 'Choosing language...'}
                  </span>
                </div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: 8, color: '#555' }}>
            {role === 'user1' && !user2OnlineName && 'Waiting for User 2 to join…'}
            {role === 'user1' && user2OnlineName && 'User 2 is online!'}
            {role === 'user2' && 'Connected with User 1.'}
            {role === 'spectator' && 'Spectator mode: read‑only view.'}
          </div>

          {myLanguage && (
            <button 
              className="start-chat-btn"
              onClick={() => {
                // Set the current sender based on role
                setCurrentSender(role === 'user1' ? 'user1' : 'user2');
              }}
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
      <div style={{background: 'red', color: 'white', padding: '10px', textAlign: 'center'}}>
        🚨 DEBUG: App is loading! If you see this, the app is working. (Version 2)
      </div>
      <EnvDebug />
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
          <span className="user-count">({totalUsers} online)</span>
          <span className={`connection-status ${connectionStatus}`}>
            {connectionStatus === 'connecting' && '🔄'}
            {connectionStatus === 'connected' && '🟢'}
            {connectionStatus === 'disconnected' && '🔴'}
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
            console.log('⌨️ Key pressed:', e.key);
            const ne = e as unknown as React.KeyboardEvent<HTMLInputElement> & { nativeEvent: any };
            if (ne.key === 'Enter' && !ne.shiftKey && !(ne.nativeEvent && ne.nativeEvent.isComposing)) {
              console.log('⌨️ Enter key detected, calling sendMessage');
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={`Type a message as ${currentSender === 'user1' ? 'User 1' : 'User 2'}...`}
          
        />
        <button 
          onClick={() => {
            console.log('🔘 Send button clicked');
            console.log('🔘 Button disabled?', !newMessage.trim() || !canSend);
            console.log('🔘 canSend:', canSend);
            sendMessage();
          }}
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
