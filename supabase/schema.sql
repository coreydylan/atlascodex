-- Supabase Schema for Atlas Codex

-- Users table (extends Supabase auth)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users PRIMARY KEY,
    api_key TEXT UNIQUE DEFAULT gen_random_uuid(),
    credits INTEGER DEFAULT 1000,
    plan TEXT DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    type TEXT NOT NULL, -- scrape, crawl, extract
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    params JSONB,
    result JSONB,
    error TEXT,
    credits_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Evidence table
CREATE TABLE evidence (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES jobs(id),
    url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    screenshot_url TEXT,
    html_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE usage_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    credits_used INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own jobs" ON jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create jobs" ON jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, api_key)
    VALUES (new.id, gen_random_uuid());
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();