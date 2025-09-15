import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

console.log('Environment variables:', {
  supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
  supabaseAnonKey: supabaseAnonKey ? 'SET' : 'MISSING',
  allEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
});

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type ChatEvent =
  | { type: 'message'; id: string; text: string; sender: 'user1' | 'user2'; timestamp: string }
  | { type: 'typing'; sender: 'user1' | 'user2'; isTyping: boolean };

export const getChannelName = (roomId: string) => `multilingual-chat-${roomId}`;

export function generateClientId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem('client_id');
    if (existing) return existing;
    const created = generateClientId();
    localStorage.setItem('client_id', created);
    return created;
  } catch {
    return generateClientId();
  }
}


