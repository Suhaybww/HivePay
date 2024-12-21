import { router } from '../../trpc';
import { groupBaseRouter } from './group';
import { groupMembershipRouter } from './groupMembership';
import { groupSettingsRouter } from './groupSettings';
import { groupMessagesRouter } from './groupMessages';
import { groupAnalyticsRouter } from './groupAnalytics';
import { groupMembersSetupStatusRouter } from './groupMembersSetupStatus';

export const groupRouter = router({
  ...groupBaseRouter._def.record,
  ...groupMembershipRouter._def.record,
  ...groupSettingsRouter._def.record,
  ...groupMessagesRouter._def.record,
  ...groupAnalyticsRouter._def.record,
  ...groupMembersSetupStatusRouter._def.record,
});

export type GroupRouter = typeof groupRouter;
