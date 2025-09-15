import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// Simplified version - cross-tab code removed

// Use environment variables if available, otherwise fallback to hardcoded values
// Try both REACT_APP_ prefixed and standard Supabase variable names
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL || 'https://ywhaabtrozuyyjuzkhqy.supabase.co';
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3aGFhYnRyb3p1eXlqdXpraHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjE0NjcsImV4cCI6MjA3MzQ5NzQ2N30.2I1-PWeOzIcrwhoutptSZ42ixA9Y3BmHVouH0TJxQpg';

// Check if we're using environment variables or fallback
const usingEnvVars = !!(process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL);
const usingEnvKey = !!(process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY);

console.log('🔧 Realtime service initialization:');
console.log('🔧 Environment variables:', {
  supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
  supabaseAnonKey: supabaseAnonKey ? 'SET' : 'MISSING',
  allEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
});

console.log('🔍 Full environment check:');
console.log('🔍 REACT_APP_SUPABASE_URL from env:', process.env.REACT_APP_SUPABASE_URL);
console.log('🔍 REACT_APP_SUPABASE_ANON_KEY from env:', process.env.REACT_APP_SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING');
console.log('🔍 SUPABASE_URL from env:', process.env.SUPABASE_URL);
console.log('🔍 SUPABASE_ANON_KEY from env:', process.env.SUPABASE_ANON_KEY ? 'PRESENT' : 'MISSING');
console.log('🔍 Using fallback credentials:', !process.env.REACT_APP_SUPABASE_URL && !process.env.SUPABASE_URL);
console.log('🔍 Final supabaseUrl:', supabaseUrl);
console.log('🔍 Final supabaseAnonKey:', supabaseAnonKey ? 'PRESENT' : 'MISSING');

// Enhanced debugging for production
console.log('🚀 PRODUCTION DEBUG INFO:');
console.log('🚀 NODE_ENV:', process.env.NODE_ENV);
console.log('🚀 All REACT_APP_ vars:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
console.log('🚀 process.env keys count:', Object.keys(process.env).length);
console.log('🚀 Window location:', typeof window !== 'undefined' ? window.location.href : 'SSR');
console.log('🚀 Is production build?', process.env.NODE_ENV === 'production');

if (supabaseUrl && supabaseAnonKey) {
  console.log('✅ Creating Supabase client with URL:', supabaseUrl);
  console.log('✅ Anon key present:', supabaseAnonKey.substring(0, 10) + '...');
} else {
  console.error('❌ Missing Supabase environment variables!');
  console.error('❌ Supabase URL:', supabaseUrl);
  console.error('❌ Supabase Key:', supabaseAnonKey ? 'Present' : 'Missing');
  console.error('❌ Please set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in Vercel environment variables');
  console.error('❌ Current environment:', {
    NODE_ENV: process.env.NODE_ENV,
    isProduction: process.env.NODE_ENV === 'production',
    hasEnvVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')).length
  });
}

// Create Supabase client with error handling
let supabase: SupabaseClient | null = null;

// Re-enable Supabase with fresh credentials and database
try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client created successfully');
    console.log('🔍 Using environment variables:', { usingEnvVars, usingEnvKey });
    
    // Test the connection
    supabase.from('presence').select('count').limit(1).then(
      () => console.log('✅ Supabase connection test successful'),
      (error) => {
        console.error('❌ Supabase connection test failed:', error);
        console.warn('⚠️ Disabling Supabase due to authentication error');
        supabase = null; // Disable Supabase if auth fails
      }
    );
  } else {
    console.log('⚠️ Supabase credentials missing, using fallback mode');
  }
} catch (error) {
  console.error('❌ Error creating Supabase client:', error);
  supabase = null;
}

export { supabase };

console.log('🔧 Supabase client created:', !!supabase);

// Client-side debugging - this will run in the browser
if (typeof window !== 'undefined') {
  console.log('🌐 CLIENT-SIDE DEBUG:');
  console.log('🌐 Window location:', window.location.href);
  console.log('🌐 Is Vercel?', window.location.hostname.includes('vercel.app'));
  console.log('🌐 Supabase client available:', !!supabase);
  
  // Check if we can access the environment variables in the browser
  const clientEnvCheck = {
    hasSupabaseUrl: !!process.env.REACT_APP_SUPABASE_URL,
    hasSupabaseKey: !!process.env.REACT_APP_SUPABASE_ANON_KEY,
    supabaseUrlValue: process.env.REACT_APP_SUPABASE_URL,
    allReactAppVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'))
  };
  console.log('🌐 Client environment check:', clientEnvCheck);
}

export type ChatEvent =
  | { type: 'message'; id: string; text: string; sender: 'user1' | 'user2'; timestamp: string }
  | { type: 'typing'; sender: 'user1' | 'user2'; isTyping: boolean };

export const getChannelName = (roomId: string) => `multilingual-chat-${roomId}`;

export function generateClientId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// In-memory client ID storage (no localStorage/sessionStorage)
let currentClientId: string | null = null;

export function getOrCreateClientId(): string {
  try {
    if (!currentClientId) {
      // Generate a new client ID for this session
      currentClientId = generateClientId();
      console.log('🆕 Generated new client ID:', currentClientId);
    } else {
      console.log('♻️ Using existing client ID:', currentClientId);
    }
    
    return currentClientId;
  } catch (error) {
    console.error('❌ Error with client ID:', error);
    return generateClientId();
  }
}


