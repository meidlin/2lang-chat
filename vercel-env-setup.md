# Vercel Environment Variables Setup

## Current Supabase Credentials (from your .env.local):

```
REACT_APP_SUPABASE_URL=https://ywhaabtrozuyyjuzkhqy.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3aGFhYnRyb3p1eXlqdXpraHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjE0NjcsImV4cCI6MjA3MzQ5NzQ2N30.2I1-PWeOzIcrwhoutptSZ42ixA9Y3BmHVouH0TJxQpg
```

## Steps to Fix:

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard
2. **Find your project**: `2lang-chat`
3. **Go to Settings** → **Environment Variables**
4. **Add these two variables**:

### Variable 1:
- **Name**: `REACT_APP_SUPABASE_URL`
- **Value**: `https://ywhaabtrozuyyjuzkhqy.supabase.co`
- **Environment**: Production, Preview, Development (check all)

### Variable 2:
- **Name**: `REACT_APP_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl3aGFhYnRyb3p1eXlqdXpraHF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5MjE0NjcsImV4cCI6MjA3MzQ5NzQ2N30.2I1-PWeOzIcrwhoutptSZ42ixA9Y3BmHVouH0TJxQpg`
- **Environment**: Production, Preview, Development (check all)

5. **Save both variables**
6. **Redeploy**: Go to Deployments → click "..." → Redeploy

## Alternative: Get Fresh Credentials

If the above doesn't work, get fresh credentials from Supabase:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**
3. **Go to Settings** → **API**
4. **Copy the fresh Project URL and anon key**
5. **Update Vercel with the fresh values**
