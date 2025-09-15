// Cross-tab communication service using BroadcastChannel API
// This allows multiple tabs to share data without localStorage

export interface SharedMessage {
  id: string;
  text: string;
  translatedText?: string;
  sender: 'user1' | 'user2';
  senderName: string;
  timestamp: number;
  showOriginal?: boolean;
}

export interface SharedPresence {
  clientId: string;
  name: string;
  role: 'user1' | 'user2' | 'spectator';
  language?: string;
  lastSeen: number;
}

interface CrossTabMessage {
  type: 'MESSAGE_ADDED' | 'MESSAGE_UPDATED' | 'PRESENCE_UPDATED' | 'CLEAR_CHAT';
  data: any;
}

class CrossTabService {
  private channel: BroadcastChannel;
  private messageListeners: Set<(messages: SharedMessage[]) => void> = new Set();
  private presenceListeners: Set<(presence: SharedPresence[]) => void> = new Set();
  private messages: SharedMessage[] = [];
  private presence: SharedPresence[] = [];

  constructor() {
    // Create a BroadcastChannel for cross-tab communication
    this.channel = new BroadcastChannel('multilingual-chat');
    
    // Listen for messages from other tabs
    this.channel.addEventListener('message', (event) => {
      this.handleCrossTabMessage(event.data);
    });

    // Clean up old presence records periodically
    setInterval(() => {
      this.cleanupOldPresence();
    }, 30000); // Every 30 seconds
  }

  private handleCrossTabMessage(message: CrossTabMessage) {
    switch (message.type) {
      case 'MESSAGE_ADDED':
        this.messages.push(message.data);
        this.notifyMessageListeners();
        break;
      
      case 'MESSAGE_UPDATED':
        const messageIndex = this.messages.findIndex(m => m.id === message.data.id);
        if (messageIndex !== -1) {
          this.messages[messageIndex] = { ...this.messages[messageIndex], ...message.data };
          this.notifyMessageListeners();
        }
        break;
      
      case 'PRESENCE_UPDATED':
        const presenceIndex = this.presence.findIndex(p => p.clientId === message.data.clientId);
        if (presenceIndex !== -1) {
          this.presence[presenceIndex] = message.data;
        } else {
          this.presence.push(message.data);
        }
        this.notifyPresenceListeners();
        break;
      
      case 'CLEAR_CHAT':
        this.messages = [];
        this.notifyMessageListeners();
        break;
    }
  }

  private cleanupOldPresence() {
    const now = Date.now();
    this.presence = this.presence.filter(p => now - p.lastSeen < 60000); // Keep for 1 minute
    this.notifyPresenceListeners();
  }

  private notifyMessageListeners() {
    this.messageListeners.forEach(listener => listener([...this.messages]));
  }

  private notifyPresenceListeners() {
    this.presenceListeners.forEach(listener => listener([...this.presence]));
  }

  // Message methods
  addMessage(message: Omit<SharedMessage, 'id' | 'timestamp'>): string {
    const newMessage: SharedMessage = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };

    this.messages.push(newMessage);
    
    // Broadcast to other tabs
    this.channel.postMessage({
      type: 'MESSAGE_ADDED',
      data: newMessage
    });

    this.notifyMessageListeners();
    return newMessage.id;
  }

  updateMessage(messageId: string, updates: Partial<SharedMessage>) {
    const messageIndex = this.messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      this.messages[messageIndex] = { ...this.messages[messageIndex], ...updates };
      
      // Broadcast to other tabs
      this.channel.postMessage({
        type: 'MESSAGE_UPDATED',
        data: { id: messageId, ...updates }
      });

      this.notifyMessageListeners();
    }
  }

  getMessages(): SharedMessage[] {
    return [...this.messages];
  }

  // Presence methods
  updatePresence(clientId: string, name: string, role: 'user1' | 'user2' | 'spectator', language?: string) {
    const presenceData: SharedPresence = {
      clientId,
      name,
      role,
      language,
      lastSeen: Date.now(),
    };

    const existingIndex = this.presence.findIndex(p => p.clientId === clientId);
    if (existingIndex !== -1) {
      this.presence[existingIndex] = presenceData;
    } else {
      this.presence.push(presenceData);
    }

    // Broadcast to other tabs
    this.channel.postMessage({
      type: 'PRESENCE_UPDATED',
      data: presenceData
    });

    this.notifyPresenceListeners();
  }

  getPresence(): SharedPresence[] {
    return [...this.presence];
  }

  // Subscription methods
  subscribeToMessages(callback: (messages: SharedMessage[]) => void) {
    this.messageListeners.add(callback);
    // Immediately call with current messages
    callback(this.getMessages());
    
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  subscribeToPresence(callback: (presence: SharedPresence[]) => void) {
    this.presenceListeners.add(callback);
    // Immediately call with current presence
    callback(this.getPresence());
    
    return () => {
      this.presenceListeners.delete(callback);
    };
  }

  clearChat() {
    this.messages = [];
    
    // Broadcast to other tabs
    this.channel.postMessage({
      type: 'CLEAR_CHAT',
      data: null
    });

    this.notifyMessageListeners();
  }

  destroy() {
    this.channel.close();
    this.messageListeners.clear();
    this.presenceListeners.clear();
  }
}

export const crossTabService = new CrossTabService();
