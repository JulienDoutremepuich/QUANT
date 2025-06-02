/*
  # Create Fiches Table with Versioning

  1. New Tables
    - `fiches`
      - `id` (uuid, primary key)
      - `type` (enum: annuelle, projet, évaluation)
      - `statut` (enum: brouillon, en_validation, validée, refusée)
      - `contenu` (text)
      - `auteur_id` (uuid, references user_profiles)
      - `version` (integer)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `fiches` table
    - Add policies for:
      - Authors can create and read their own fiches
      - Authors can update their fiches in draft status
      - All authenticated users can read validated fiches
*/

-- Create enums for fiche type and status
CREATE TYPE fiche_type AS ENUM ('annuelle', 'projet', 'evaluation');
CREATE TYPE fiche_status AS ENUM ('brouillon', 'en_validation', 'validee', 'refusee');

-- Create fiches table
CREATE TABLE IF NOT EXISTS fiches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type fiche_type NOT NULL,
  statut fiche_status NOT NULL DEFAULT 'brouillon',
  contenu text NOT NULL,
  auteur_id uuid NOT NULL REFERENCES user_profiles(id),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS fiches_auteur_id_idx ON fiches(auteur_id);
CREATE INDEX IF NOT EXISTS fiches_type_idx ON fiches(type);
CREATE INDEX IF NOT EXISTS fiches_statut_idx ON fiches(statut);

-- Enable RLS
ALTER TABLE fiches ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authors can create their own fiches"
  ON fiches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = auteur_id);

CREATE POLICY "Authors can read their own fiches"
  ON fiches
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = auteur_id OR
    statut = 'validee'
  );

CREATE POLICY "Authors can update their draft fiches"
  ON fiches
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = auteur_id AND
    statut = 'brouillon'
  )
  WITH CHECK (
    auth.uid() = auteur_id AND
    statut = 'brouillon'
  );

-- Create trigger function to handle versioning
CREATE OR REPLACE FUNCTION handle_fiche_versioning()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.contenu != NEW.contenu) THEN
    -- Insert a new version with incremented version number
    INSERT INTO fiches (
      type,
      statut,
      contenu,
      auteur_id,
      version,
      created_at
    ) VALUES (
      NEW.type,
      NEW.statut,
      NEW.contenu,
      NEW.auteur_id,
      NEW.version + 1,
      now()
    );
    RETURN NULL;  -- Don't perform the update
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for versioning
CREATE TRIGGER handle_fiche_version
  BEFORE UPDATE ON fiches
  FOR EACH ROW
  EXECUTE FUNCTION handle_fiche_versioning();

-- Create trigger for updated_at
CREATE TRIGGER update_fiches_updated_at
  BEFORE UPDATE ON fiches
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();