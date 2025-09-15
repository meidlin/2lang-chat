// Shared chat service using localStorage and polling
// This allows multiple tabs to share the same chat room

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
  lastSeen: number;
}

const CHAT_STORAGE_KEY = 'multilingual_chat_messages';
const PRESENCE_STORAGE_KEY = 'multilingual_chat_presence';
const POLL_INTERVAL = 1000; // Poll every second

class SharedChatService {
  private listeners: Set<(messages: SharedMessage[]) => void> = new Set();
  private presenceListeners: Set<(presence: SharedPresence[]) => void> = new Set();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPolling();
  }

  private startPolling() {
    if (this.pollInterval) return;
    
    this.pollInterval = setInterval(() => {
      this.notifyListeners();
    }, POLL_INTERVAL);
  }

  private stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private getMessages(): SharedMessage[] {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private setMessages(messages: SharedMessage[]) {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Failed to save messages:', error);
    }
  }

  getPresence(): SharedPresence[] {
    try {
      const stored = localStorage.getItem(PRESENCE_STORAGE_KEY);
      const presence = stored ? JSON.parse(stored) : [];
      // Clean up old presence (older than 30 seconds)
      const now = Date.now();
      return presence.filter((p: SharedPresence) => now - p.lastSeen < 30000);
    } catch {
      return [];
    }
  }

  private setPresence(presence: SharedPresence[]) {
    try {
      localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(presence));
    } catch (error) {
      console.error('Failed to save presence:', error);
    }
  }

  addMessage(message: Omit<SharedMessage, 'id' | 'timestamp'>): string {
    const newMessage: SharedMessage = {
      ...message,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
    };

    const messages = this.getMessages();
    messages.push(newMessage);
    this.setMessages(messages);
    this.notifyListeners();
    
    return newMessage.id;
  }

  updateMessage(messageId: string, updates: Partial<SharedMessage>) {
    const messages = this.getMessages();
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      messages[index] = { ...messages[index], ...updates };
      this.setMessages(messages);
      this.notifyListeners();
    }
  }


  updatePresence(clientId: string, name: string, role: 'user1' | 'user2' | 'spectator') {
    const presence = this.getPresence();
    const existingIndex = presence.findIndex(p => p.clientId === clientId);
    
    const presenceData: SharedPresence = {
      clientId,
      name,
      role,
      lastSeen: Date.now(),
    };

    if (existingIndex !== -1) {
      presence[existingIndex] = presenceData;
    } else {
      presence.push(presenceData);
    }

    this.setPresence(presence);
    this.notifyPresenceListeners();
  }


  subscribeToMessages(callback: (messages: SharedMessage[]) => void) {
    this.listeners.add(callback);
    // Immediately call with current messages
    callback(this.getMessages());
    
    return () => {
      this.listeners.delete(callback);
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

  private notifyListeners() {
    const messages = this.getMessages();
    this.listeners.forEach(callback => callback(messages));
  }

  private notifyPresenceListeners() {
    const presence = this.getPresence();
    this.presenceListeners.forEach(callback => callback(presence));
  }

  clearChat() {
    this.setMessages([]);
    this.notifyListeners();
  }

  destroy() {
    this.stopPolling();
    this.listeners.clear();
    this.presenceListeners.clear();
  }
}

export const sharedChatService = new SharedChatService();
