/*
  # Create assignments table and related functions

  1. New Tables
    - `affectations`
      - `id` (uuid, primary key)
      - `id_employe` (uuid, references user_profiles)
      - `id_coach` (uuid, references user_profiles)
      - `id_referent_projet` (uuid, references user_profiles)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `affectations` table
    - Add policies for:
      - Direction can manage all assignments
      - Users can read their own assignments
*/

-- Create assignments table
CREATE TABLE IF NOT EXISTS affectations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_employe uuid NOT NULL REFERENCES user_profiles(id),
  id_coach uuid REFERENCES user_profiles(id),
  id_referent_projet uuid REFERENCES user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id_employe)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS affectations_employe_idx ON affectations(id_employe);
CREATE INDEX IF NOT EXISTS affectations_coach_idx ON affectations(id_coach);
CREATE INDEX IF NOT EXISTS affectations_referent_idx ON affectations(id_referent_projet);

-- Enable RLS
ALTER TABLE affectations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Direction can manage assignments"
  ON affectations
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'direction'
  )
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'direction'
  );

CREATE POLICY "Users can read their own assignments"
  ON affectations
  FOR SELECT
  TO authenticated
  USING (
    id_employe = auth.uid() OR
    id_coach = auth.uid() OR
    id_referent_projet = auth.uid()
  );

-- Create trigger for updated_at
CREATE TRIGGER update_affectations_updated_at
  BEFORE UPDATE ON affectations
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- Update fiche workflow to use assignments
CREATE OR REPLACE FUNCTION get_fiche_validators(
  p_employe_id uuid,
  p_fiche_type fiche_type
) RETURNS TABLE (
  validator_id uuid,
  validator_role user_role
) AS $$
BEGIN
  CASE p_fiche_type
    WHEN 'annuelle' THEN
      RETURN QUERY
        SELECT a.id_coach as validator_id, 'coach_rh'::user_role
        FROM affectations a
        WHERE a.id_employe = p_employe_id
        UNION ALL
        SELECT up.id, 'direction'::user_role
        FROM user_profiles up
        WHERE up.role = 'direction'
        LIMIT 1;
    WHEN 'projet' THEN
      RETURN QUERY
        SELECT a.id_referent_projet as validator_id, 'referent_projet'::user_role
        FROM affectations a
        WHERE a.id_employe = p_employe_id
        UNION ALL
        SELECT up.id, 'direction'::user_role
        FROM user_profiles up
        WHERE up.role = 'direction'
        LIMIT 1;
    WHEN 'evaluation' THEN
      RETURN QUERY
        SELECT a.id_coach as validator_id, 'coach_rh'::user_role
        FROM affectations a
        WHERE a.id_employe = p_employe_id;
  END CASE;
END;
$$ LANGUAGE plpgsql;