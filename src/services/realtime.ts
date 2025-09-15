import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

console.log('🔧 Realtime service initialization:');
console.log('🔧 Environment variables:', {
  supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
  supabaseAnonKey: supabaseAnonKey ? 'SET' : 'MISSING',
  allEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
});

if (supabaseUrl && supabaseAnonKey) {
  console.log('✅ Creating Supabase client with URL:', supabaseUrl);
  console.log('✅ Anon key present:', supabaseAnonKey.substring(0, 10) + '...');
} else {
  console.error('❌ Missing Supabase environment variables!');
  console.error('❌ Supabase URL:', supabaseUrl);
  console.error('❌ Supabase Key:', supabaseAnonKey ? 'Present' : 'Missing');
  console.error('❌ Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel environment variables');
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

console.log('🔧 Supabase client created:', !!supabase);

export type ChatEvent =
  | { type: 'message'; id: string; text: string; sender: 'user1' | 'user2'; timestamp: string }
  | { type: 'typing'; sender: 'user1' | 'user2'; isTyping: boolean };

export const getChannelName = (roomId: string) => `multilingual-chat-${roomId}`;

export function generateClientId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getOrCreateClientId(): string {
  try {
    // Check if we already have a client ID for this session
    let clientId = sessionStorage.getItem('client_id');
    
    if (!clientId) {
      // Generate a new client ID for this session
      clientId = generateClientId();
      sessionStorage.setItem('client_id', clientId);
      console.log('🆕 Generated new client ID:', clientId);
    } else {
      console.log('♻️ Using existing client ID:', clientId);
    }
    
    return clientId;
  } catch (error) {
    console.error('❌ Error with client ID:', error);
    return generateClientId();
  }
}


