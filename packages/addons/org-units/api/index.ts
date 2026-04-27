/**
 * Library-shape package: ships classes/configs only, no NestJS module.
 * The app composes its own OrgUnitsModule (mirrors users-as-library) and
 * places it in `extraImports`. The addon below carries the migration name
 * so the schema runs alongside the app's wrapper.
 */
export const orgUnitsAddon = {
  migration: '@packages/org-units',
} as const;

export { OrgUnitService } from './services/org-unit.service';
export { OrgUnitLevelService } from './services/org-unit-level.service';
export { OrgPositionService } from './services/org-position.service';
export { PositionScopeResolverService } from './services/position-scope-resolver.service';
export { OrgUnitController } from './controllers/org-unit.controller';
export { OrgUnitLevelController } from './controllers/org-unit-level.controller';
export { OrgPositionController } from './controllers/org-position.controller';
export {
  UnitScopeResolver,
  DescendantsScopeResolver,
} from './scope-resolvers/hierarchy.resolver';
export { OrgUnitHeadStrategy } from './automation-resolvers/org-unit-head.strategy';
export { ParentUnitHeadStrategy } from './automation-resolvers/parent-unit-head.strategy';
export { OrgUnitMembersStrategy } from './automation-resolvers/org-unit-members.strategy';
export { orgUnitLevels } from './schema/org-unit-levels';
export { orgUnits } from './schema/org-units';
export { orgUnitMembers } from './schema/org-unit-members';
export { orgPositions } from './schema/org-positions';
export { ORG_UNIT_PERMISSIONS } from './permissions';
export type {
  OrgUnitLevel,
  OrgUnit,
  OrgUnitMember,
  OrgUnitWithDetails,
  OrgUnitMemberDetail,
  OrgPosition,
} from './types';
