-- ═══════════════════════════════════════════════════════════════
-- SQL Supabase Schema for Reuniones (MeetFlow)
-- ═══════════════════════════════════════════════════════════════

-- Run this command in your Supabase SQL Editor to create the table structure

CREATE TABLE meetflow_reuniones (
    "id" text PRIMARY KEY,
    "title" text,
    "date" text,
    "time" text,
    "status" text,
    "participants" jsonb DEFAULT '[]'::jsonb,
    "topics" jsonb DEFAULT '[]'::jsonb,
    "tasks" jsonb DEFAULT '[]'::jsonb,
    "totalTime" int8 DEFAULT 0,
    "followupDate" text,
    "followupTime" text,
    "createdAt" timestamp with time zone,
    "completedAt" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT now(),
    "aiSummary" text
);

-- Enable Row Level Security (RLS) if you plan on adding authentication later
ALTER TABLE meetflow_reuniones ENABLE ROW LEVEL SECURITY;

-- Allow entirely public access for now since we are using anon public keys
CREATE POLICY "Public Access"
ON meetflow_reuniones
FOR ALL
USING (true)
WITH CHECK (true);
