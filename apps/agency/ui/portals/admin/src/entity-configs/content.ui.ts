import type { EntityUIConfig } from '@packages/entity-engine-ui';

const tabbed = (icon: string, navOrder: number): EntityUIConfig['presentation'] => ({
  icon,
  navGroup: 'Content',
  groupRenderMode: 'tabs',
  navOrder,
  createMode: 'modal',
});

export const CLIENT_LOGOS_UI_CONFIG: EntityUIConfig = { entityType: 'client-logos', presentation: tabbed('Building2', 50) };
export const FAQ_ITEMS_UI_CONFIG: EntityUIConfig = { entityType: 'faq-items', presentation: tabbed('HelpCircle', 20) };
export const SERVICES_UI_CONFIG: EntityUIConfig = { entityType: 'services', presentation: tabbed('Briefcase', 40) };
export const STATS_UI_CONFIG: EntityUIConfig = { entityType: 'stats', presentation: tabbed('BarChart3', 70) };
export const TEAM_MEMBERS_UI_CONFIG: EntityUIConfig = { entityType: 'team-members', presentation: tabbed('Users', 30) };
export const TESTIMONIALS_UI_CONFIG: EntityUIConfig = { entityType: 'testimonials', presentation: tabbed('MessageSquareQuote', 10) };
export const VALUE_PROPS_UI_CONFIG: EntityUIConfig = { entityType: 'value-props', presentation: tabbed('Sparkles', 60) };

export const contentEntityUIConfigs: EntityUIConfig[] = [
  CLIENT_LOGOS_UI_CONFIG,
  FAQ_ITEMS_UI_CONFIG,
  SERVICES_UI_CONFIG,
  STATS_UI_CONFIG,
  TEAM_MEMBERS_UI_CONFIG,
  TESTIMONIALS_UI_CONFIG,
  VALUE_PROPS_UI_CONFIG,
];
