-- Re-seed task-status workflow with transition permissions and reopen paths
-- The entity engine's seedWorkflows() skips existing definitions, so we delete
-- the old one and let bootstrap re-create it from the updated config.
-- Transition history is preserved (transitionId set to NULL via SET NULL FK).

DELETE FROM workflow_definitions WHERE slug = 'task-status' AND deleted_at IS NULL;
