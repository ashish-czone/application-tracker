export const TASK_TEAM_MEMBERS_READER = 'TASK_TEAM_MEMBERS_READER';

export interface TaskTeamMembersReader {
  getMemberIds(unitId: string): Promise<string[]>;
}
