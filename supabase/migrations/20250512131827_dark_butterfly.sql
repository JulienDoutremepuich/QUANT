/*
  # Update user trigger function

  1. Changes
    - Modify handle_new_user function to set full_name to NULL by default
    - Keep role as 'employe' by default
  
  2. Security
    - Maintain existing RLS policies
    - Function remains security definer
*/

-- Update trigger function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name, role)
  VALUES (new.id, NULL, 'employe');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- No need to recreate the trigger as it already exists and points to this function
-- The function update will automatically apply to the existing trigger