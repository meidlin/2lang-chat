import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { translationService } from './services/translationService';
import { getOrCreateClientId } from './services/realtime';
import { supabaseChatService, TypingIndicator, ChatRoom } from './services/supabaseChat';
import ErrorBoundary from './ErrorBoundary';

interface Message {
  id: string;
  text: string;
  translatedText?: string;
  sender: 'user1' | 'user2';
  senderName: string;
  timestamp: Date;
  showOriginal?: boolean;
  isTranslating?: boolean;
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

// Utility function to generate unique user IDs
function generateUserId(): string {
  return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function AppContent() {
  console.log('🚀 App component is starting to render...');
  const [user1Language, setUser1Language] = useState<string>('');
  const [user2Language, setUser2Language] = useState<string>('');
  const [myLanguage, setMyLanguage] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [currentSender, setCurrentSender] = useState<'user1' | 'user2'>('user1');
  const [typingIndicator, setTypingIndicator] = useState<TypingIndicator | null>(null);
  const [role, setRole] = useState<'user1' | 'user2' | 'spectator' | ''>('');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  
  const [displayName, setDisplayName] = useState<string>('');
  const [pendingName, setPendingName] = useState<string>(() => displayName || '');
  const [user1OnlineName, setUser1OnlineName] = useState<string | null>(null);
  const [user2OnlineName, setUser2OnlineName] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [presenceDebug, setPresenceDebug] = useState<string>('');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<ChatRoom[]>([]);
  const [showRoomSelection, setShowRoomSelection] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load available rooms
  const loadRooms = async () => {
    try {
      const rooms = await supabaseChatService.getRooms();
      setAvailableRooms(rooms);
      console.log('📋 Loaded rooms:', rooms);
    } catch (error) {
      console.error('❌ Error loading rooms:', error);
    }
  };

  // Create a new room
  const createRoom = async () => {
    if (!newRoomName.trim()) return;
    
    try {
      const roomId = await supabaseChatService.createRoom(newRoomName.trim());
      console.log('✅ Created room:', roomId);
      setNewRoomName('');
      await loadRooms(); // Refresh room list
    } catch (error) {
      console.error('❌ Error creating room:', error);
      alert('Failed to create room. Please try again.');
    }
  };

  // Join a room
  const joinRoom = async (roomId: string) => {
    if (!displayName || !myLanguage) {
      alert('Please enter your name and select a language first.');
      return;
    }

    try {
      const userId = generateUserId();
      setCurrentUserId(userId);
      setCurrentRoomId(roomId);
      
      // Get current presence in the room to assign role
      const presence = await supabaseChatService.getPresence();
      const roomPresence = presence.filter(p => p.roomId === roomId);
      
      const user1Count = roomPresence.filter(p => p.role === 'user1').length;
      const user2Count = roomPresence.filter(p => p.role === 'user2').length;
      
      let newRole: 'user1' | 'user2' | 'spectator';
      if (user1Count === 0) {
        newRole = 'user1';
      } else if (user2Count === 0) {
        newRole = 'user2';
      } else {
        newRole = 'spectator';
      }
      
      setRole(newRole);
      if (newRole === 'user1' || newRole === 'user2') {
        setCurrentSender(newRole);
      }
      
      // Join the room
      await supabaseChatService.joinRoom(roomId, userId, displayName, newRole, myLanguage);
      setShowRoomSelection(false);
      console.log('✅ Joined room:', roomId, 'as', newRole);
    } catch (error) {
      console.error('❌ Error joining room:', error);
      alert('Failed to join room. Please try again.');
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  // Initialize shared chat service
  useEffect(() => {
    const initializeChat = async () => {
      const clientId = getOrCreateClientId();
      console.log('🔧 Initializing chat for clientId:', clientId);
      
      // Load available rooms
      await loadRooms();
      
      // For now, we'll show room selection after user enters name and language
      // The old role assignment logic will be handled when joining a room
    };

    initializeChat();

    // Subscribe to messages (only for current room)
    const unsubscribeMessages = supabaseChatService.subscribeToMessages((sharedMessages) => {
      const convertedMessages: Message[] = sharedMessages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      setMessages(convertedMessages);
      setConnectionStatus('connected');
    }, currentRoomId || undefined);

    // Subscribe to presence (only for current room)
    const unsubscribePresence = supabaseChatService.subscribeToPresence((presence) => {
      setTotalUsers(presence.length);
      
      const user1 = presence.find(p => p.role === 'user1');
      const user2 = presence.find(p => p.role === 'user2');
      
      setUser1OnlineName(user1?.name || null);
      setUser2OnlineName(user2?.name || null);
      
      // Extract language information from presence data
      console.log('🔍 Extracting language from presence:', {
        user1: user1 ? { name: user1.name, language: user1.language } : null,
        user2: user2 ? { name: user2.name, language: user2.language } : null
      });
      setUser1Language(user1?.language || '');
      setUser2Language(user2?.language || '');
      
      setPresenceDebug(`Supabase real-time: ${presence.length} users online in room ${currentRoomId}`);
      setConnectionStatus('connected');
    }, currentRoomId || undefined);

    // Subscribe to typing indicators
    const unsubscribeTyping = supabaseChatService.subscribeToTypingIndicator((typing) => {
      console.log('⌨️ Typing indicator update:', typing);
      setTypingIndicator(typing);
    });

    // Add cleanup when user closes the window or navigates away
    const handleBeforeUnload = async () => {
      if (displayName && role) {
        const clientId = getOrCreateClientId();
        try {
          await supabaseChatService.removePresence(clientId);
          console.log('🧹 Cleaned up presence on window close');
        } catch (error) {
          console.error('❌ Error cleaning up presence:', error);
        }
      }
    };

    // Also cleanup when page becomes hidden (tab switch, minimize, etc.)
    const handleVisibilityChange = async () => {
      if (document.hidden && displayName && role) {
        const clientId = getOrCreateClientId();
        try {
          await supabaseChatService.removePresence(clientId);
          console.log('🧹 Cleaned up presence on visibility change');
        } catch (error) {
          console.error('❌ Error cleaning up presence:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      unsubscribeMessages();
      unsubscribePresence();
      unsubscribeTyping();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [displayName, role]);

  // Update presence when displayName changes
  useEffect(() => {
    if (!displayName) return;
    const clientId = getOrCreateClientId();
    console.log('🔄 Updating presence with language:', { clientId, displayName, role, myLanguage });
    supabaseChatService.updatePresence(clientId, displayName, role as 'user1' | 'user2' | 'spectator', myLanguage);
  }, [displayName, role, myLanguage]);

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

  const getLocalizedTypingMessage = (user: 'user1' | 'user2', language: string): string => {
    const typingMessages: { [key: string]: { [key: string]: string } } = {
      'en': { 'user1': 'User 1 is typing...', 'user2': 'User 2 is typing...' },
      'es': { 'user1': 'Usuario 1 está escribiendo...', 'user2': 'Usuario 2 está escribiendo...' },
      'fr': { 'user1': 'Utilisateur 1 tape...', 'user2': 'Utilisateur 2 tape...' },
      'de': { 'user1': 'Benutzer 1 tippt...', 'user2': 'Benutzer 2 tippt...' },
      'it': { 'user1': 'Utente 1 sta scrivendo...', 'user2': 'Utente 2 sta scrivendo...' },
      'pt': { 'user1': 'Usuário 1 está digitando...', 'user2': 'Usuário 2 está digitando...' },
      'ru': { 'user1': 'Пользователь 1 печатает...', 'user2': 'Пользователь 2 печатает...' },
      'ja': { 'user1': 'ユーザー1が入力中...', 'user2': 'ユーザー2が入力中...' },
      'ko': { 'user1': '사용자 1이 입력 중...', 'user2': '사용자 2가 입력 중...' },
      'zh': { 'user1': '用户1正在输入...', 'user2': '用户2正在输入...' },
      'ar': { 'user1': 'المستخدم 1 يكتب...', 'user2': 'المستخدم 2 يكتب...' },
      'hi': { 'user1': 'उपयोगकर्ता 1 टाइप कर रहे हैं...', 'user2': 'उपयोगकर्ता 2 टाइप कर रहे हैं...' }
    };

    return typingMessages[language]?.[user] || typingMessages['en'][user];
  };

  const getAvatarForUser = (sender: 'user1' | 'user2', senderName: string): string => {
    // Use emoji avatars based on user role
    const avatars = {
      'user1': '👤',
      'user2': '👥'
    };
    
    return avatars[sender] || '👤';
  };

  const getAvatarColor = (sender: 'user1' | 'user2'): string => {
    // Different colors for each user
    const colors = {
      'user1': '#3b82f6', // Blue
      'user2': '#10b981'  // Green
    };
    
    return colors[sender] || '#6b7280';
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
      // Check if translation is needed first
      const needsTranslation = !!(user1OnlineName && user2OnlineName && user1Language && user2Language && user1Language !== user2Language);
      
      console.log('📤 Adding message to Supabase...');
      const messageData = {
        text: messageText,
        sender: currentSender,
        senderName: displayName || 'Anonymous',
        senderId: currentUserId || '',
        roomId: currentRoomId || '',
        showOriginal: false,
        isTranslating: needsTranslation // Mark as translating if translation is needed
      };
      console.log('📦 Message data:', messageData);
      
      const messageId = await supabaseChatService.addMessage(messageData);
      console.log('✅ Message added with ID:', messageId);

      // Message is now visible to sender immediately
      console.log('🎉 Message sent successfully - visible to sender immediately');

      if (needsTranslation) {
        console.log('🔄 Translation needed, starting background translation...');
        const targetLanguage = currentSender === 'user1' ? user2Language : user1Language;
        const sourceLanguage = myLanguage;

        // Set typing indicator to show the SENDER is typing (for the receiving user to see)
        await supabaseChatService.setTypingIndicator(currentSender, true);
        console.log('⏳ Setting typing indicator for sender:', currentSender);

        // Add a minimum typing duration for better UX
        const minTypingDuration = 1000; // 1 second minimum
        const typingStartTime = Date.now();

        // Do translation in background (don't await)
        translateText(messageText, sourceLanguage, targetLanguage)
          .then(async (translated) => {
            console.log('✅ Translation result:', translated);
            await supabaseChatService.updateMessage(messageId, { 
              translatedText: translated,
              isTranslating: false // Mark translation as complete
            });
            console.log('✅ Translation saved to message');
          })
          .catch((error) => {
            console.error('❌ Translation failed:', error);
            // Mark translation as complete even if it failed
            supabaseChatService.updateMessage(messageId, { isTranslating: false });
          })
          .finally(async () => {
            // Ensure minimum typing duration has passed
            const elapsed = Date.now() - typingStartTime;
            const remainingTime = Math.max(0, minTypingDuration - elapsed);
            
            setTimeout(async () => {
              await supabaseChatService.setTypingIndicator(currentSender, false);
              console.log('✅ Typing indicator cleared');
            }, remainingTime);
          });
      } else {
        console.log('ℹ️ No translation needed');
      }
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

  // Onboarding: ask for display name and language together
  if (!displayName) {
    return (
      <div className="language-selection">
        <div className="language-container">
          <h1>🌍 Multilingual Chat</h1>
          <p>Welcome! What should we call you and what language do you speak?</p>
          
          {/* Name Input */}
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Your name"
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              style={{ 
                padding: '12px 16px', 
                borderRadius: 8, 
                border: '1px solid #d1d5db', 
                width: '100%',
                fontSize: '16px',
                textAlign: 'center'
              }}
            />
          </div>

          {/* Language Selection */}
          <p style={{ marginBottom: '15px', fontSize: '14px', color: '#666' }}>Choose your language:</p>
          <div className="language-grid">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                className={`language-btn ${myLanguage === lang.code ? 'selected' : ''}`}
                onClick={() => setMyLanguage(lang.code)}
              >
                {lang.flag} {lang.name}
              </button>
            ))}
          </div>
          
          {/* Start Chat Button */}
          {pendingName.trim() && myLanguage && (
            <button 
              className="start-chat-btn"
              onClick={() => {
                const n = pendingName.trim();
                if (n) {
                  console.log('🚀 Starting chat with name:', n, 'and language:', myLanguage);
                  setDisplayName(n);
                  setShowRoomSelection(true);
                }
              }}
              style={{ marginTop: '20px' }}
            >
              Choose Room
            </button>
          )}
        </div>
      </div>
    );
  }

  // Room selection screen
  if (showRoomSelection) {
    return (
      <div className="language-selection">
        <div className="language-container">
          <h1>🏠 Choose a Chat Room</h1>
          <p>Welcome <strong>{displayName}</strong>! Select a room to join or create a new one.</p>
          
          {/* Create New Room */}
          <div style={{ marginBottom: '30px', padding: '20px', background: '#f8f9fa', borderRadius: '10px' }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Create New Room</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Room name (e.g., 'English-Japanese Chat')"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                style={{ 
                  flex: 1,
                  padding: '12px 16px', 
                  borderRadius: 8, 
                  border: '1px solid #d1d5db', 
                  fontSize: '16px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createRoom();
                  }
                }}
              />
              <button 
                onClick={createRoom}
                disabled={!newRoomName.trim()}
                style={{
                  padding: '12px 20px',
                  background: newRoomName.trim() ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  cursor: newRoomName.trim() ? 'pointer' : 'not-allowed',
                  fontWeight: '600'
                }}
              >
                Create
              </button>
            </div>
          </div>

          {/* Available Rooms */}
          <div>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Available Rooms</h3>
            {availableRooms.length === 0 ? (
              <p style={{ color: '#666', fontStyle: 'italic' }}>No rooms available. Create one above!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {availableRooms.map(room => (
                  <button
                    key={room.id}
                    onClick={() => joinRoom(room.id)}
                    style={{
                      padding: '15px 20px',
                      background: 'white',
                      border: '2px solid #e0e0e0',
                      borderRadius: 10,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = '#667eea';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = '#e0e0e0';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '16px', marginBottom: '5px' }}>
                        {room.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        Created {new Date(room.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ color: '#667eea', fontSize: '20px' }}>→</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Back Button */}
          <button 
            onClick={() => setShowRoomSelection(false)}
            style={{
              marginTop: '30px',
              padding: '10px 20px',
              background: 'transparent',
              color: '#666',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            ← Back to Setup
          </button>
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
            <h3>🌍 Your Language</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
              You're chatting in: <strong>{LANGUAGES.find(l => l.code === myLanguage)?.flag} {LANGUAGES.find(l => l.code === myLanguage)?.name}</strong>
            </p>
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

          <p style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
            Setting up your chat session... You'll be able to start chatting once your role is assigned.
          </p>
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
            {LANGUAGES.find(l => l.code === user1Language)?.flag} {user1OnlineName || 'User 1'}
          </span>
          <span className="separator">↔️</span>
          <span className="user2-lang">
            {LANGUAGES.find(l => l.code === user2Language)?.flag} {user2OnlineName || 'User 2'}
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
          <button className="clear-users-btn" onClick={async () => {
            try {
              // Clear all presence and messages
              await supabaseChatService.clearAllPresence();
              await supabaseChatService.clearChat();
              
              // Reset all state
              setMessages([]);
              setUser1OnlineName(null);
              setUser2OnlineName(null);
              setUser1Language('');
              setUser2Language('');
              setTypingIndicator(null);
              
              // Reset current user state to force re-onboarding
              setDisplayName('');
              setPendingName('');
              setMyLanguage('');
              setRole('');
              setCurrentSender('user1');
              
              alert('All users and messages cleared! You can start fresh.');
            } catch (error) {
              console.error('Error clearing users and messages:', error);
              alert('Failed to clear. Check console for details.');
            }
          }} aria-label="Clear all users and messages">Clear All</button>
        </div>
      </div>

      <div className="messages-container">
        {messages.map(message => {
          const isSentByCurrentUser = message.sender === currentSender;
          const hasTranslation = Boolean(message.translatedText);
          const showTranslation = !isSentByCurrentUser && hasTranslation && !message.showOriginal;
          
          // Hide message from receiver if it's still being translated
          const shouldHideMessage = !isSentByCurrentUser && message.isTranslating && !hasTranslation;
          
          if (shouldHideMessage) {
            return null; // Don't render the message for receiver while translating
          }

          return (
            <div key={message.id} className={`message ${isSentByCurrentUser ? 'sent' : 'received'}`}>
              <div className="message-avatar" style={{ backgroundColor: getAvatarColor(message.sender) }}>
                {getAvatarForUser(message.sender, message.senderName)}
              </div>
              <div className="message-content">
                {!isSentByCurrentUser && (
                  <div className="message-sender-name" style={{ 
                    fontSize: '12px', 
                    color: '#666', 
                    marginBottom: '4px',
                    fontWeight: '500'
                  }}>
                    {message.senderName}
                  </div>
                )}
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
        {typingIndicator && typingIndicator.isTyping && typingIndicator.user !== currentSender && (
          <div className="translating-indicator">
            <div className="message-avatar" style={{ backgroundColor: getAvatarColor(typingIndicator.user) }}>
              {getAvatarForUser(typingIndicator.user, '')}
            </div>
            <div className="typing-content">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>{getLocalizedTypingMessage(typingIndicator.user, myLanguage)}</span>
            </div>
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

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;
