"use client";

import React, { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/src/app/_trpc/client';
import { Skeleton } from '@/src/components/ui/skeleton';
import { useToast } from '@/src/components/ui/use-toast';
import { GroupDetails } from '@/src/components/GroupDetails';
import { GroupAnalytics } from '@/src/components/GroupAnalytics';
import { GroupMessaging } from '@/src/components/GroupMessaging';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import GroupSettings from '@/src/components/GroupSettings';
import GroupAdmin from '@/src/components/GroupAdmin';

const defaultAnalyticsData = {
  contributions: [],
  memberActivity: [],
  payoutDistribution: [],
  metrics: {
    totalMembers: 0,
    memberGrowth: 0,
    averageContribution: 0,
    contributionGrowth: 0,
    retentionRate: 0,
    totalPaidOut: 0,
    onTimePaymentRate: 0,
    averagePayoutTime: 0,
  },
  paymentStatus: {
    onTime: 0,
    late: 0,
    missed: 0,
  },
};

export default function GroupPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('details');
  const utils = trpc.useContext();

  const groupId = params?.groupId as string;

  const { data: group, isLoading: isLoadingGroup } = trpc.group.getGroupById.useQuery(
    { groupId },
    {
      onError: (error) => {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to fetch group data',
        });
        router.push('/dashboard');
      },
    }
  );

  const { data: analyticsData, isLoading: isLoadingAnalytics } = trpc.group.getGroupAnalytics.useQuery(
    { groupId },
    {
      enabled: activeTab === 'analytics',
    }
  );

  const { data: messagesData, isLoading: isLoadingMessages } = trpc.group.getGroupMessages.useQuery(
    { groupId, limit: 50 },
    {
      enabled: activeTab === 'messaging',
    }
  );

  const sendMessageMutation = trpc.group.sendMessage.useMutation({
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to send message',
      });
    },
  });

  const handleSendMessage = async (content: string) => {
    await sendMessageMutation.mutateAsync({ groupId, content });
  };

  const handleLeaveGroup = useCallback(() => {
    router.push('/dashboard');
  }, [router]);

  const handleGroupUpdate = useCallback(() => {
    utils.group.getGroupById.invalidate({ groupId });
  }, [utils, groupId]);

  if (isLoadingGroup) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-6 w-3/4" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!group) return null;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-start mb-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text leading-tight">
            {group.name}
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl">
            {group.description}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="border-b border-gray-300 mb-6 flex space-x-4">
          <TabsTrigger
            value="details"
            className="px-6 py-3 text-gray-700 hover:text-yellow-400 transition-colors font-medium"
          >
            Details
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="px-6 py-3 text-gray-700 hover:text-yellow-400 transition-colors font-medium"
          >
            Analytics
          </TabsTrigger>
          <TabsTrigger
            value="messaging"
            className="px-6 py-3 text-gray-700 hover:text-yellow-400 transition-colors font-medium"
          >
            Messaging
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="px-6 py-3 text-gray-700 hover:text-yellow-400 transition-colors font-medium"
          >
            Settings
          </TabsTrigger>
          {group.isAdmin && ( // Show Admin tab only if user is admin
            <TabsTrigger
              value="admin"
              className="px-6 py-3 text-gray-700 hover:text-yellow-400 transition-colors font-medium"
            >
              Admin
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="details">
          <GroupDetails group={group} />
        </TabsContent>

        <TabsContent value="analytics">
          {isLoadingAnalytics ? (
            <div className="space-y-4">
              <Skeleton className="h-80 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
          ) : (
            <GroupAnalytics
              group={group}
              analyticsData={analyticsData || defaultAnalyticsData}
            />
          )}
        </TabsContent>

        <TabsContent value="messaging">
          {isLoadingMessages ? (
            <Skeleton className="h-[600px] w-full" />
          ) : (
            <GroupMessaging
              group={group}
              messages={messagesData?.messages || []}
              onSendMessage={handleSendMessage}
            />
          )}
        </TabsContent>

        <TabsContent value="settings">
          {group && (
            <GroupSettings
              group={group}
              onLeaveGroup={handleLeaveGroup}
              onGroupUpdate={handleGroupUpdate}
            />
          )}
        </TabsContent>

        {group.isAdmin && (
          <TabsContent value="admin">
            <GroupAdmin
              group={group}
              onGroupUpdate={handleGroupUpdate}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
