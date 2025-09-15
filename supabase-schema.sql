-- Supabase Database Schema for Multilingual Chat PWA
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  translated_text TEXT,
  sender VARCHAR(10) NOT NULL CHECK (sender IN ('user1', 'user2')),
  sender_name VARCHAR(100) NOT NULL,
  show_original BOOLEAN DEFAULT FALSE,
  is_translating BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create presence table for user tracking
CREATE TABLE IF NOT EXISTS presence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user1', 'user2', 'spectator')),
  language VARCHAR(10),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create typing indicators table
CREATE TABLE IF NOT EXISTS typing_indicators (
  "user" VARCHAR(10) PRIMARY KEY CHECK ("user" IN ('user1', 'user2')),
  is_typing BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_presence_client_id ON presence(client_id);
CREATE INDEX IF NOT EXISTS idx_presence_last_seen ON presence(last_seen);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a public chat app)
CREATE POLICY "Allow public read access to messages" ON messages
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to messages" ON messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to messages" ON messages
  FOR UPDATE USING (true);

CREATE POLICY "Allow public read access to presence" ON presence
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to presence" ON presence
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to presence" ON presence
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to presence" ON presence
  FOR DELETE USING (true);

CREATE POLICY "Allow public read access to typing indicators" ON typing_indicators
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to typing indicators" ON typing_indicators
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to typing indicators" ON typing_indicators
  FOR UPDATE USING (true);

-- Enable real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE presence;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;

-- Create function to clean up old presence records
CREATE OR REPLACE FUNCTION cleanup_old_presence()
RETURNS void AS $$
BEGIN
  DELETE FROM presence 
  WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
