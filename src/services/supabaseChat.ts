// Supabase-based real-time chat service
import { supabase } from './realtime';
import { crossTabService } from './crossTabService';

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

class SupabaseChatService {
  private messageListeners: Set<(messages: SharedMessage[]) => void> = new Set();
  private presenceListeners: Set<(presence: SharedPresence[]) => void> = new Set();
  private presenceCleanupInterval: NodeJS.Timeout | null = null;
  private messages: SharedMessage[] = [];
  private presence: SharedPresence[] = [];

  constructor() {
    this.startPresenceCleanup();
  }

  private startPresenceCleanup() {
    // Clean up old presence records every 2 minutes
    this.presenceCleanupInterval = setInterval(() => {
      this.cleanupOldPresence();
    }, 120000);
  }

  async cleanupOldPresence() {
    if (!supabase) return;
    
    try {
      console.log('🧹 Cleaning up old presence records...');
      const { error } = await supabase
        .from('presence')
        .delete()
        .lt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
      
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
      console.warn('⚠️ Supabase not available - using cross-tab communication');
      return crossTabService.addMessage(message);
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
      crossTabService.updateMessage(messageId, updates);
      return;
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
      console.warn('⚠️ Supabase not available - using cross-tab communication');
      return crossTabService.getMessages();
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
  async updatePresence(clientId: string, name: string, role: 'user1' | 'user2' | 'spectator') {
    if (!supabase) {
      console.warn('⚠️ Supabase not available - using cross-tab communication for presence');
      crossTabService.updatePresence(clientId, name, role);
      return;
    }

    try {
      console.log('📝 Updating presence:', { clientId, name, role });
      const { error } = await supabase
        .from('presence')
        .upsert({
          client_id: clientId,
          name,
          role,
          last_seen: new Date().toISOString(),
        }, {
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

  async getPresence(): Promise<SharedPresence[]> {
    if (!supabase) {
      console.warn('⚠️ Supabase not available - using cross-tab communication for presence');
      return crossTabService.getPresence();
    }

    try {
      const { data, error } = await supabase
        .from('presence')
        .select('*')
        .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .order('last_seen', { ascending: false });

      if (error) throw error;

      return data.map(p => ({
        clientId: p.client_id,
        name: p.name,
        role: p.role,
        lastSeen: new Date(p.last_seen).getTime(),
      }));
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
      console.warn('Supabase not initialized, using cross-tab communication');
      return crossTabService.subscribeToMessages(callback);
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
      console.warn('Supabase not initialized, using cross-tab communication');
      return crossTabService.subscribeToPresence(callback);
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
      crossTabService.clearChat();
      return;
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

  destroy() {
    if (this.presenceCleanupInterval) {
      clearInterval(this.presenceCleanupInterval);
    }
    this.messageListeners.clear();
    this.presenceListeners.clear();
  }
}

export const supabaseChatService = new SupabaseChatService();
