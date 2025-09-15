import React from 'react';

const EnvDebug: React.FC = () => {
  const envVars = {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL ? 'SET' : 'MISSING',
    REACT_APP_SUPABASE_ANON_KEY: process.env.REACT_APP_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    SUPABASE_URL: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
    REACT_APP_OPENAI_API_KEY: process.env.REACT_APP_OPENAI_API_KEY ? 'SET' : 'MISSING',
    allReactAppVars: Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')),
    allSupabaseVars: Object.keys(process.env).filter(key => key.includes('SUPABASE')),
    totalEnvVars: Object.keys(process.env).length,
    isProduction: process.env.NODE_ENV === 'production',
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'SSR',
    isVercel: typeof window !== 'undefined' ? window.location.hostname.includes('vercel.app') : false
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: '#f0f0f0',
      padding: '10px',
      border: '2px solid #ff0000',
      zIndex: 9999,
      fontSize: '12px',
      fontFamily: 'monospace'
    }}>
      <h4>🔧 Environment Debug Info:</h4>
      <pre>{JSON.stringify(envVars, null, 2)}</pre>
    </div>
  );
};

export default EnvDebug;
