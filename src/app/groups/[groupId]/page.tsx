"use client";

import React, { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { trpc } from '@/src/app/_trpc/client';
import { Skeleton } from '@/src/components/ui/skeleton';
import { useToast } from '@/src/components/ui/use-toast';
import { GroupDetails } from '@/src/components/GroupDetails';
import { GroupAnalytics } from '@/src/components/GroupAnalytics';
import { GroupMessaging } from '@/src/components/GroupMessaging';
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
  const [activeSection, setActiveSection] = useState('details');  // Changed from activeTab
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
      enabled: activeSection === 'analytics',
    }
  );

  const { data: messagesData, isLoading: isLoadingMessages } = trpc.group.getGroupMessages.useQuery(
    { groupId, limit: 50 },
    {
      enabled: activeSection === 'messaging',
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
      {/* Header Section */}
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

      {/* Segmented Navigation */}
      <div className="border-b mb-8">
        <div className="flex flex-wrap -mb-px">
          <button
            onClick={() => setActiveSection('details')}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeSection === 'details' 
                ? 'border-yellow-400 text-black' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveSection('analytics')}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeSection === 'analytics' 
                ? 'border-yellow-400 text-black' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Analytics
          </button>
          <button
            onClick={() => setActiveSection('messaging')}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeSection === 'messaging' 
                ? 'border-yellow-400 text-black' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Messaging
          </button>
          <button
            onClick={() => setActiveSection('settings')}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeSection === 'settings' 
                ? 'border-yellow-400 text-black' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Settings
          </button>
          {group.isAdmin && (
            <button
              onClick={() => setActiveSection('admin')}
              className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
                ${activeSection === 'admin' 
                  ? 'border-yellow-400 text-black' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-6">

{/* Details Section */}
{activeSection === 'details' && (
          <GroupDetails group={group} />
        )}

        {/* Analytics Section */}
        {activeSection === 'analytics' && (
          <>
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
          </>
        )}

        {/* Messaging Section */}
        {activeSection === 'messaging' && (
          <>
            {isLoadingMessages ? (
              <Skeleton className="h-[600px] w-full" />
            ) : (
              <GroupMessaging
                group={group}
                messages={messagesData?.messages || []}
                onSendMessage={handleSendMessage}
              />
            )}
          </>
        )}

        {/* Settings Section */}
        {activeSection === 'settings' && group && (
          <GroupSettings
            group={group}
            onLeaveGroup={handleLeaveGroup}
            onGroupUpdate={handleGroupUpdate}
          />
        )}

        {/* Admin Section */}
        {activeSection === 'admin' && group.isAdmin && (
          <GroupAdmin
            group={group}
            onGroupUpdate={handleGroupUpdate}
          />
        )}
      </div>
    </div>
  );
}