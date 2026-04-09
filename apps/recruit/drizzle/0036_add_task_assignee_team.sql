-- Add assignee_team_id column to tasks for team-based task assignment
ALTER TABLE tasks ADD COLUMN assignee_team_id TEXT REFERENCES org_units(id);
CREATE INDEX tasks_assignee_team_id_idx ON tasks (assignee_team_id);
