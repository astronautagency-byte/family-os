-- FamAI conversation history
-- Stores chat sessions and messages for continuity across sessions

CREATE TABLE IF NOT EXISTS famai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS famai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES famai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  intent TEXT,
  actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies
ALTER TABLE famai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE famai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON famai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations"
  ON famai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON famai_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON famai_conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own messages"
  ON famai_messages FOR SELECT
  USING (conversation_id IN (SELECT id FROM famai_conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage own messages"
  ON famai_messages FOR ALL
  USING (conversation_id IN (SELECT id FROM famai_conversations WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_famai_conversations_user ON famai_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_famai_messages_conversation ON famai_messages(conversation_id, created_at);
