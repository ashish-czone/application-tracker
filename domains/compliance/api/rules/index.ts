/**
 * Public API for the rules module.
 *
 * Cross-module callers MUST import from `../rules` (this barrel), not from
 * individual files inside the folder. The barrel is the contract; everything
 * else is internal and free to be reorganised without breaking callers.
 *
 * Internals NOT exported (intentionally):
 * - `RULES_ENTITY`       — entity-engine config, wired only by rules.module
 * - `RULES_WORKFLOW`     — workflow definition, wired only by rules.module
 *                          via WorkflowsModule.forFeature
 * - `rules.dto.*`        — request DTOs and the URL query schema, internal
 *                          to the controller
 * - `rules.schema.*`     — Drizzle table; re-exported via the schema barrel
 *                          for drizzle-kit, not by this index
 */

export { ComplianceRulesModule } from './rules.module';

export {
  ComplianceRulesService,
  type ComplianceRule,
  type ComplianceRuleStatus,
  type Occurrence,
  type DeprecationPreview,
  type DeprecationResult,
  type RulesSummary,
  InvalidFrequencyError,
  ImmutableRuleFieldError,
  NoDefaultHandlerError,
  AmbiguousHandlerError,
  LawHandlerRequiredError,
  IMMUTABLE_RULE_IDENTITY_FIELDS,
  type ImmutableRuleIdentityField,
} from './rules.service';
