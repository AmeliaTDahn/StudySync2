-- Begin transaction
BEGIN;

-- First, disable RLS to cleanly remove all policies
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "System can create user profiles" ON public.profiles;

-- Create new policies
CREATE POLICY "profiles_select_policy" 
ON public.profiles FOR SELECT
USING (true);

CREATE POLICY "profiles_insert_policy"
ON public.profiles FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    (role = 'student' AND hourly_rate IS NULL) OR
    (role = 'tutor' AND hourly_rate IS NOT NULL)
  )
);

CREATE POLICY "profiles_update_policy"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Re-enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON public.profiles TO service_role;
GRANT ALL ON public.profiles TO postgres;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- End transaction
COMMIT; 