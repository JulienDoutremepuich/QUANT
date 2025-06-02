/*
  # Update user schema
  
  1. Changes
    - Drop user_roles table and related objects
    - Update trigger function to only use user_profiles
    - Ensure RLS policies are correctly set for user_profiles
  
  2. Security
    - Maintain RLS on user_profiles
    - Update policies for proper access control
*/

-- Drop the user_roles table and related objects
DROP TABLE IF EXISTS public.user_roles;

-- Update the trigger function to only handle user_profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'full_name', 'Utilisateur'), 'employe');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can read own profile') THEN
    DROP POLICY "Users can read own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
    DROP POLICY "Users can update own profile" ON public.user_profiles;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_profiles' AND policyname = 'Allow trigger to create profiles') THEN
    DROP POLICY "Allow trigger to create profiles" ON public.user_profiles;
  END IF;
END $$;

-- Recreate the policies
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Allow trigger to create profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);