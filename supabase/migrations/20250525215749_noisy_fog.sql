/*
  # Create action journal table

  1. New Tables
    - `journal_actions`
      - `id` (uuid, primary key)
      - `fiche_id` (uuid, references fiches)
      - `user_id` (uuid, references user_profiles)
      - `action_type` (text): 'validation', 'refus', 'commentaire'
      - `created_at` (timestamp)
      - `comment` (text, optional)

  2. Security
    - Enable RLS on `journal_actions` table
    - Add policies for:
      - Authenticated users can create entries
      - Users can read entries for fiches they have access to
*/

CREATE TABLE IF NOT EXISTS journal_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiche_id uuid REFERENCES fiches(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('validation', 'refus', 'commentaire')),
  created_at timestamptz DEFAULT now() NOT NULL,
  comment text
);

ALTER TABLE journal_actions ENABLE ROW LEVEL SECURITY;

-- Users can read journal entries for fiches they have access to
CREATE POLICY "Users can read journal entries" ON journal_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM fiches
      WHERE fiches.id = journal_actions.fiche_id
      AND (
        fiches.auteur_id = auth.uid()
        OR fiches.statut = 'validee'
        OR EXISTS (
          SELECT 1 FROM affectations
          WHERE (
            affectations.id_employe = fiches.auteur_id
            AND (
              affectations.id_coach = auth.uid()
              OR affectations.id_referent_projet = auth.uid()
            )
          )
        )
      )
    )
  );

-- Users can create journal entries for fiches they can access
CREATE POLICY "Users can create journal entries" ON journal_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM fiches
      WHERE fiches.id = journal_actions.fiche_id
      AND (
        fiches.auteur_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM affectations
          WHERE (
            affectations.id_employe = fiches.auteur_id
            AND (
              affectations.id_coach = auth.uid()
              OR affectations.id_referent_projet = auth.uid()
            )
          )
        )
      )
    )
  );

-- Create index for better performance
CREATE INDEX journal_actions_fiche_id_idx ON journal_actions(fiche_id);
CREATE INDEX journal_actions_user_id_idx ON journal_actions(user_id);