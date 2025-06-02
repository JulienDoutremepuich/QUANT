/*
  # Add workflow steps and automation

  1. Changes
    - Add etape_actuelle enum and column to fiches table
    - Add trigger function for workflow automation
    - Update existing triggers to handle workflow steps

  2. Security
    - Maintain existing RLS policies
    - Add validation for workflow transitions
*/

-- Create workflow step enum
CREATE TYPE workflow_step AS ENUM (
  'employe',
  'referent_projet',
  'coach_rh',
  'direction'
);

-- Add etape_actuelle to fiches table
ALTER TABLE fiches 
ADD COLUMN etape_actuelle workflow_step NOT NULL DEFAULT 'employe';

-- Create function to get next workflow step
CREATE OR REPLACE FUNCTION get_next_workflow_step(
  fiche_type fiche_type,
  current_step workflow_step
) RETURNS workflow_step AS $$
BEGIN
  CASE fiche_type
    WHEN 'annuelle' THEN
      CASE current_step
        WHEN 'employe' THEN RETURN 'coach_rh';
        WHEN 'coach_rh' THEN RETURN 'direction';
        ELSE RETURN NULL;
      END CASE;
    WHEN 'projet' THEN
      CASE current_step
        WHEN 'employe' THEN RETURN 'referent_projet';
        WHEN 'referent_projet' THEN RETURN 'direction';
        ELSE RETURN NULL;
      END CASE;
    WHEN 'evaluation' THEN
      CASE current_step
        WHEN 'employe' THEN RETURN 'coach_rh';
        ELSE RETURN NULL;
      END CASE;
  END CASE;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate workflow transition
CREATE OR REPLACE FUNCTION validate_workflow_transition(
  user_role user_role,
  fiche_type fiche_type,
  current_step workflow_step
) RETURNS boolean AS $$
BEGIN
  -- Check if user has permission for current step
  RETURN CASE
    WHEN user_role = 'employe' AND current_step = 'employe' THEN true
    WHEN user_role = 'referent_projet' AND current_step = 'referent_projet' THEN true
    WHEN user_role = 'coach_rh' AND current_step = 'coach_rh' THEN true
    WHEN user_role = 'direction' AND current_step = 'direction' THEN true
    ELSE false
  END;
END;
$$ LANGUAGE plpgsql;

-- Update trigger function to handle workflow steps
CREATE OR REPLACE FUNCTION handle_fiche_workflow()
RETURNS trigger AS $$
DECLARE
  next_step workflow_step;
  user_role user_role;
BEGIN
  -- Get user role
  SELECT role::user_role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();

  -- If status is changing to en_validation
  IF NEW.statut = 'en_validation' AND OLD.statut = 'brouillon' THEN
    -- Move to first validation step based on fiche type
    CASE NEW.type
      WHEN 'annuelle' THEN NEW.etape_actuelle := 'coach_rh';
      WHEN 'projet' THEN NEW.etape_actuelle := 'referent_projet';
      WHEN 'evaluation' THEN NEW.etape_actuelle := 'coach_rh';
    END CASE;
  -- If status is changing to validee
  ELSIF NEW.statut = 'validee' AND OLD.statut = 'en_validation' THEN
    -- Verify user has permission
    IF NOT validate_workflow_transition(user_role, NEW.type, OLD.etape_actuelle) THEN
      RAISE EXCEPTION 'Unauthorized workflow transition';
    END IF;
    
    -- Get next step
    next_step := get_next_workflow_step(NEW.type, OLD.etape_actuelle);
    
    -- If there's no next step, the fiche is fully validated
    IF next_step IS NULL THEN
      NEW.statut := 'validee';
    ELSE
      NEW.etape_actuelle := next_step;
      -- Keep status as en_validation if there are more steps
      NEW.statut := 'en_validation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for workflow
CREATE TRIGGER handle_fiche_workflow
  BEFORE UPDATE ON fiches
  FOR EACH ROW
  EXECUTE FUNCTION handle_fiche_workflow();

-- Update policies to check workflow step
DROP POLICY IF EXISTS "Authors can update their draft fiches" ON fiches;
CREATE POLICY "Authors can update their draft fiches"
  ON fiches
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = auteur_id AND statut = 'brouillon') OR
    (validate_workflow_transition(
      (SELECT role::user_role FROM user_profiles WHERE id = auth.uid()),
      type,
      etape_actuelle
    ))
  )
  WITH CHECK (
    (auth.uid() = auteur_id AND statut = 'brouillon') OR
    (validate_workflow_transition(
      (SELECT role::user_role FROM user_profiles WHERE id = auth.uid()),
      type,
      etape_actuelle
    ))
  );