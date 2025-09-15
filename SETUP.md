# 🚀 Supabase Setup Instructions

## 1. Database Setup

1. **Go to your Supabase project dashboard**
2. **Navigate to SQL Editor**
3. **Run the SQL schema** (copy and paste the contents of `supabase-schema.sql`)

## 2. Environment Variables

Create a `.env` file in your project root with:

```bash
# Supabase Configuration
REACT_APP_SUPABASE_URL=your_supabase_project_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key

# OpenAI API Key (Optional - for better translations)
REACT_APP_OPENAI_API_KEY=your_openai_api_key
```

## 3. Get Supabase Credentials

1. **Project URL**: Go to Settings → API → Project URL
2. **Anon Key**: Go to Settings → API → Project API keys → anon/public

## 4. Deploy to Vercel

1. **Push your changes to GitHub**
2. **In Vercel dashboard**, add the environment variables:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `REACT_APP_OPENAI_API_KEY` (optional)

## 5. Test Multi-Device

1. **Open the app in two different browsers/devices**
2. **Verify real-time messaging works**
3. **Check that presence tracking works**

## 🎉 You're Done!

Your multilingual chat PWA now has:
- ✅ Real-time messaging via Supabase
- ✅ Multi-device support
- ✅ User presence tracking
- ✅ Translation services
- ✅ PWA capabilities
