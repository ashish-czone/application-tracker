-- Drop legacy notification rules tables.
-- Rules are now managed by the automations package (automation_rules table).

DROP TABLE IF EXISTS "notification_sent_log";
DROP TABLE IF EXISTS "notification_scheduled";
DROP TABLE IF EXISTS "notification_rule_channels";
DROP TABLE IF EXISTS "notification_rules";
