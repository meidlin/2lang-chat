// Supabase-based real-time chat service
import { supabase } from './realtime';

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

export interface TypingIndicator {
  user: 'user1' | 'user2';
  isTyping: boolean;
  timestamp: number;
}

class SupabaseChatService {
  private messageListeners: Set<(messages: SharedMessage[]) => void> = new Set();
  private presenceListeners: Set<(presence: SharedPresence[]) => void> = new Set();
  private typingListeners: Set<(typing: TypingIndicator | null) => void> = new Set();
  private presenceCleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPresenceCleanup();
  }

  private startPresenceCleanup() {
    // Clean up old presence records every 30 seconds (more aggressive)
    this.presenceCleanupInterval = setInterval(() => {
      this.cleanupOldPresence();
    }, 30000);
  }

  async cleanupOldPresence() {
    if (!supabase) return;
    
    try {
      console.log('🧹 Cleaning up old presence records...');
      const { error } = await supabase
        .from('presence')
        .delete()
        .lt('last_seen', new Date(Date.now() - 1 * 60 * 1000).toISOString());
      
      if (error) {
        console.error('❌ Error cleaning up old presence:', error);
      } else {
        console.log('✅ Old presence records cleaned up');
      }
    } catch (error) {
      console.error('❌ Error cleaning up old presence:', error);
    }
  }

  // Message methods
  async addMessage(message: Omit<SharedMessage, 'id' | 'timestamp'>): Promise<string> {
    console.log('🔧 SupabaseChatService.addMessage called');
    console.log('🔧 Supabase client exists?', !!supabase);
    console.log('🔧 Environment check:', {
      supabaseUrl: process.env.REACT_APP_SUPABASE_URL ? 'SET' : 'MISSING',
      supabaseKey: process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'MISSING'
    });
    
    if (!supabase) {
      throw new Error('Supabase not available - cannot add message');
    }

    try {
      console.log('📤 Adding message to Supabase:', message);
      const insertData = {
        text: message.text,
        translated_text: message.translatedText,
        sender: message.sender,
        sender_name: message.senderName,
        show_original: message.showOriginal || false,
      };
      console.log('📦 Insert data:', insertData);
      
      const { data, error } = await supabase
        .from('messages')
        .insert(insertData)
        .select('id')
        .single();

      console.log('📊 Supabase response:', { data, error });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      console.log('✅ Message added successfully:', data.id);
      return data.id;
    } catch (error) {
      console.error('💥 Error adding message:', error);
      throw error;
    }
  }

  async updateMessage(messageId: string, updates: Partial<SharedMessage>) {
    if (!supabase) {
      throw new Error('Supabase not available - cannot update message');
    }

    try {
      const updateData: any = {};
      if (updates.translatedText !== undefined) updateData.translated_text = updates.translatedText;
      if (updates.showOriginal !== undefined) updateData.show_original = updates.showOriginal;

      const { error } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', messageId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating message:', error);
    }
  }

  async getMessages(): Promise<SharedMessage[]> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot get messages');
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return data.map(msg => ({
        id: msg.id,
        text: msg.text,
        translatedText: msg.translated_text,
        sender: msg.sender,
        senderName: msg.sender_name,
        timestamp: new Date(msg.created_at).getTime(),
        showOriginal: msg.show_original,
      }));
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  // Presence methods
  async updatePresence(clientId: string, name: string, role: 'user1' | 'user2' | 'spectator', language?: string) {
    if (!supabase) {
      throw new Error('Supabase not available - cannot update presence');
    }

    try {
      console.log('📝 Updating presence:', { clientId, name, role, language });
      const upsertData = {
        client_id: clientId,
        name,
        role,
        language,
        last_seen: new Date().toISOString(),
      };
      console.log('📦 Upsert data:', upsertData);
      const { error } = await supabase
        .from('presence')
        .upsert(upsertData, {
          onConflict: 'client_id'
        });

      if (error) {
        console.error('❌ Error updating presence:', error);
        throw error;
      }
      
      console.log('✅ Presence updated successfully');
    } catch (error) {
      console.error('💥 Error updating presence:', error);
    }
  }

  async removePresence(clientId: string) {
    if (!supabase) {
      throw new Error('Supabase not available - cannot remove presence');
    }

    try {
      console.log('🗑️ Removing presence for client:', clientId);
      const { error } = await supabase
        .from('presence')
        .delete()
        .eq('client_id', clientId);

      if (error) {
        console.error('❌ Error removing presence:', error);
        throw error;
      }
      
      console.log('✅ Presence removed successfully');
    } catch (error) {
      console.error('💥 Error removing presence:', error);
    }
  }

  async getPresence(): Promise<SharedPresence[]> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot get presence');
    }

    try {
      const { data, error } = await supabase
        .from('presence')
        .select('*')
        .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('last_seen', { ascending: false });

      if (error) throw error;

      console.log('📊 Raw presence data from DB:', data);
      const mappedData = data.map(p => ({
        clientId: p.client_id,
        name: p.name,
        role: p.role,
        language: p.language,
        lastSeen: new Date(p.last_seen).getTime(),
      }));
      console.log('📊 Mapped presence data:', mappedData);
      return mappedData;
    } catch (error) {
      console.error('Error fetching presence:', error);
      return [];
    }
  }

  // Subscription methods
  subscribeToMessages(callback: (messages: SharedMessage[]) => void) {
    this.messageListeners.add(callback);
    
    // Immediately call with current messages
    this.getMessages().then(callback);

    if (!supabase) {
      throw new Error('Supabase not available - cannot subscribe to messages');
    }

    // Set up real-time subscription
    const subscription = supabase
      .channel('messages')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          this.getMessages().then(messages => {
            this.messageListeners.forEach(listener => listener(messages));
          });
        }
      )
      .subscribe();

    return () => {
      this.messageListeners.delete(callback);
      if (this.messageListeners.size === 0) {
        subscription.unsubscribe();
      }
    };
  }

  subscribeToPresence(callback: (presence: SharedPresence[]) => void) {
    this.presenceListeners.add(callback);
    
    // Immediately call with current presence
    this.getPresence().then(callback);

    if (!supabase) {
      throw new Error('Supabase not available - cannot subscribe to presence');
    }

    // Set up real-time subscription
    const subscription = supabase
      .channel('presence')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'presence' },
        () => {
          this.getPresence().then(presence => {
            this.presenceListeners.forEach(listener => listener(presence));
          });
        }
      )
      .subscribe();

    return () => {
      this.presenceListeners.delete(callback);
      if (this.presenceListeners.size === 0) {
        subscription.unsubscribe();
      }
    };
  }

  async clearChat() {
    if (!supabase) {
      throw new Error('Supabase not available - cannot clear chat');
    }

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all messages

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  }

  async clearAllPresence() {
    if (!supabase) {
      throw new Error('Supabase not available - cannot clear presence');
    }

    try {
      console.log('🧹 Manually clearing all presence records...');
      const { error } = await supabase
        .from('presence')
        .delete()
        .neq('client_id', '00000000-0000-0000-0000-000000000000'); // Delete all presence

      if (error) {
        console.error('❌ Error clearing presence:', error);
        throw error;
      }

      console.log('✅ All presence records cleared successfully');
    } catch (error) {
      console.error('💥 Error clearing presence:', error);
      throw error;
    }
  }

  // Typing indicator methods
  async setTypingIndicator(user: 'user1' | 'user2', isTyping: boolean) {
    if (!supabase) {
      throw new Error('Supabase not available - cannot set typing indicator');
    }

    try {
      console.log('⌨️ Setting typing indicator:', { user, isTyping });
      const { error } = await supabase
        .from('typing_indicators')
        .upsert({
          "user": user,
          is_typing: isTyping,
          timestamp: new Date().toISOString()
        }, {
          onConflict: '"user"'
        });

      if (error) {
        console.error('❌ Error setting typing indicator:', error);
        throw error;
      }

      console.log('✅ Typing indicator set successfully');
    } catch (error) {
      console.error('💥 Error setting typing indicator:', error);
      throw error;
    }
  }

  async getTypingIndicator(): Promise<TypingIndicator | null> {
    if (!supabase) {
      throw new Error('Supabase not available - cannot get typing indicator');
    }

    try {
      const { data, error } = await supabase
        .from('typing_indicators')
        .select('*')
        .eq('is_typing', true)
        .gt('timestamp', new Date(Date.now() - 10 * 1000).toISOString()) // Only recent indicators
        .order('timestamp', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      if (!data) return null;

      return {
        user: data["user"],
        isTyping: data.is_typing,
        timestamp: new Date(data.timestamp).getTime()
      };
    } catch (error) {
      console.error('Error fetching typing indicator:', error);
      return null;
    }
  }

  subscribeToTypingIndicator(callback: (typing: TypingIndicator | null) => void) {
    this.typingListeners.add(callback);
    
    // Immediately call with current typing indicator
    this.getTypingIndicator().then(callback);

    if (!supabase) {
      throw new Error('Supabase not available - cannot subscribe to typing indicator');
    }

    // Set up real-time subscription
    const subscription = supabase
      .channel('typing_indicators')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'typing_indicators' },
        () => {
          this.getTypingIndicator().then(typing => {
            this.typingListeners.forEach(listener => listener(typing));
          });
        }
      )
      .subscribe();

    return () => {
      this.typingListeners.delete(callback);
      if (this.typingListeners.size === 0) {
        subscription.unsubscribe();
      }
    };
  }

  destroy() {
    if (this.presenceCleanupInterval) {
      clearInterval(this.presenceCleanupInterval);
    }
    this.messageListeners.clear();
    this.presenceListeners.clear();
    this.typingListeners.clear();
  }
}

export const supabaseChatService = new SupabaseChatService();
