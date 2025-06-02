/*
  # Clean up unused tables

  This migration removes tables that are not currently being used in the application
  while preserving essential user-related tables and their data.

  1. Tables to keep:
    - user_profiles
    - user_roles
    
  2. Tables to remove:
    - objectives
    - evaluations
    - activity_logs
    - workflow_steps
    - fiches
    - fiches_versions
*/

-- Drop tables in correct order to respect foreign key constraints
DROP TABLE IF EXISTS fiches_versions;
DROP TABLE IF EXISTS fiches;
DROP TABLE IF EXISTS workflow_steps;
DROP TABLE IF EXISTS activity_logs;
DROP TABLE IF EXISTS evaluations;
DROP TABLE IF EXISTS objectives;

-- Drop unused enums
DROP TYPE IF EXISTS fiche_type;
DROP TYPE IF EXISTS fiche_status;
DROP TYPE IF EXISTS workflow_status;