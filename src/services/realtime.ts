import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://ywhaabtrozuyyjuzkhqy.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3aGFhYnRyb3p1eXlqdXpraHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjE0NjcsImV4cCI6MjA3MzQ5NzQ2N30.2I1-PWeOzIcrwhoutptSZ42ixA9Y3BmHVouH0TJxQpg';

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
    // Always generate a new client ID for each session
    // This ensures each new tab/incognito window = new user
    const created = generateClientId();
    // Store temporarily in sessionStorage instead of localStorage
    // so it persists during the session but not across browser restarts
    sessionStorage.setItem('client_id', created);
    return created;
  } catch {
    return generateClientId();
  }
}


