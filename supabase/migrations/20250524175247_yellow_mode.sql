/*
  # Create versions table and update versioning system

  1. New Tables
    - `fiches_versions`
      - `id` (uuid, primary key)
      - `fiche_id` (uuid, references fiches)
      - `version` (integer)
      - `contenu` (text)
      - `statut` (fiche_status)
      - `created_at` (timestamptz)

  2. Changes
    - Update versioning trigger to store versions in fiches_versions
    - Add RLS policies for version history access
*/

-- Create fiches_versions table
CREATE TABLE IF NOT EXISTS fiches_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
  version integer NOT NULL,
  contenu text NOT NULL,
  statut fiche_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS fiches_versions_fiche_id_idx ON fiches_versions(fiche_id);
CREATE INDEX IF NOT EXISTS fiches_versions_version_idx ON fiches_versions(version);

-- Enable RLS
ALTER TABLE fiches_versions ENABLE ROW LEVEL SECURITY;

-- Create policies for fiches_versions
CREATE POLICY "Users can read versions of their own fiches"
  ON fiches_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fiches
      WHERE fiches.id = fiches_versions.fiche_id
      AND (fiches.auteur_id = auth.uid() OR fiches.statut = 'validee')
    )
  );

-- Update the versioning trigger function
CREATE OR REPLACE FUNCTION handle_fiche_versioning()
RETURNS trigger AS $$
BEGIN
  -- Store the old version in fiches_versions
  INSERT INTO fiches_versions (
    fiche_id,
    version,
    contenu,
    statut
  ) VALUES (
    OLD.id,
    OLD.version,
    OLD.contenu,
    OLD.statut
  );
  
  -- Update the version number in the main fiche
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;