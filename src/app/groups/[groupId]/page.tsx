"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { trpc } from "@/src/app/_trpc/client";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useToast } from "@/src/components/ui/use-toast";
import { GroupDetails } from "@/src/components/GroupDetails";
import { GroupAnalytics } from "@/src/components/GroupAnalytics";
import { GroupMessaging } from "@/src/components/GroupMessaging";
import GroupSettings from "@/src/components/GroupSettings";
import GroupAdmin from "@/src/components/GroupAdmin";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";

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
  const searchParams = useSearchParams();
  const params = useParams();
  const { toast } = useToast();
  const utils = trpc.useContext();

  const groupId = params?.groupId as string;

  // 1) Wrap validTabs in useMemo so it never changes reference
  const validTabs = useMemo(
    () => ["details", "analytics", "messaging", "settings", "admin"],
    []
  );

  // Get the initial tab from the URL (or default to "details")
  const initialTab = searchParams.get("tab");
  const defaultTab = validTabs.includes(initialTab || "") ? initialTab : "details";

  const [activeSection, setActiveSection] = useState<string>(defaultTab || "details");

  // Keep local state (activeSection) in sync with query param changes
  useEffect(() => {
    const nextTab = searchParams.get("tab");
    if (nextTab && validTabs.includes(nextTab) && nextTab !== activeSection) {
      setActiveSection(nextTab);
    }
  }, [searchParams, activeSection, validTabs]);

  // Helper to switch tabs while also updating the query param
  const handleTabChange = useCallback(
    (tabName: string) => {
      setActiveSection(tabName);
      router.replace(`/groups/${groupId}?tab=${tabName}`);
    },
    [router, groupId]
  );

  // 1) Fetch group data
  const { data: group, isLoading: isLoadingGroup } = trpc.group.getGroupById.useQuery(
    { groupId },
    {
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to fetch group data",
        });
        router.push("/dashboard");
      },
    }
  );

  // 2) Possibly fetch analytics if user is on "analytics" tab
  const { data: analyticsData, isLoading: isLoadingAnalytics } =
    trpc.group.getGroupAnalytics.useQuery(
      { groupId },
      { enabled: activeSection === "analytics" }
    );

  // 3) Possibly fetch messages if on "messaging" tab
  const { data: messagesData, isLoading: isLoadingMessages } =
    trpc.group.getGroupMessages.useQuery(
      { groupId, limit: 50 },
      { enabled: activeSection === "messaging" }
    );

  // 4) Send message mutation
  const sendMessageMutation = trpc.group.sendMessage.useMutation({
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send message",
      });
    },
  });
  const handleSendMessage = async (content: string) => {
    await sendMessageMutation.mutateAsync({ groupId, content });
  };

  // 5) Callback for leaving group => push user to /dashboard
  const handleLeaveGroup = useCallback(() => {
    router.push("/dashboard");
  }, [router]);

  // 6) Refresh group data (e.g. after admin actions)
  const handleGroupUpdate = useCallback(() => {
    utils.group.getGroupById.invalidate({ groupId });
  }, [utils, groupId]);

  // 7) Fetch user’s setup status (Stripe, BECS)
  const { data: userSetupStatus } = trpc.user.getUserSetupStatus.useQuery();

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

  // Payment setups incomplete?
  const isStripeIncomplete = userSetupStatus?.stripeOnboardingStatus !== "Completed";
  const isBECsIncomplete = userSetupStatus?.becsSetupStatus !== "Completed";
  const isAnySetupIncomplete = isStripeIncomplete || isBECsIncomplete;

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold leading-tight">{group.name}</h1>
          <p className="text-lg text-gray-600 max-w-2xl">{group.description}</p>
        </div>
      </div>

      {/* Alert if user hasn't completed all payment setups */}
      {isAnySetupIncomplete && (
        <Alert
          variant="destructive"
          className="mb-6 bg-red-50 border border-red-200 text-red-900"
        >
          <AlertCircle className="h-5 w-5 text-red-500" />
          <div className="flex flex-col gap-1">
            <AlertTitle className="font-semibold text-red-900">Action Required</AlertTitle>
            <AlertDescription className="text-red-800">
              You have not completed all payment setups. Please visit{" "}
              <Button
                variant="link"
                className="p-0 h-auto inline-flex items-center font-semibold text-red-600 hover:text-red-700"
                onClick={() => handleTabChange("settings")}
              >
                Settings
              </Button>{" "}
              to finalize your Stripe onboarding for payouts or BECS Direct Debit configuration.
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Segmented Navigation */}
      <div className="border-b mb-8">
        <div className="flex flex-wrap -mb-px">
          <button
            onClick={() => handleTabChange("details")}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeSection === "details"
                  ? "border-yellow-400 text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Details
          </button>
          <button
            onClick={() => handleTabChange("analytics")}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeSection === "analytics"
                  ? "border-yellow-400 text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Analytics
          </button>
          <button
            onClick={() => handleTabChange("messaging")}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeSection === "messaging"
                  ? "border-yellow-400 text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Messaging
          </button>
          <button
            onClick={() => handleTabChange("settings")}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${
                activeSection === "settings"
                  ? "border-yellow-400 text-black"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
          >
            Settings
            {isAnySetupIncomplete && <AlertCircle className="ml-2 h-4 w-4 text-red-500" />}
          </button>
          {group.isAdmin && (
            <button
              onClick={() => handleTabChange("admin")}
              className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
                ${
                  activeSection === "admin"
                    ? "border-yellow-400 text-black"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
            >
              Admin
            </button>
          )}
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-6">
        {activeSection === "details" && <GroupDetails group={group} />}
        {activeSection === "analytics" && (
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
        {activeSection === "messaging" && (
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
        {activeSection === "settings" && group && (
          <GroupSettings
            group={group}
            onLeaveGroup={handleLeaveGroup}
            onGroupUpdate={handleGroupUpdate}
          />
        )}
        {activeSection === "admin" && group.isAdmin && (
          <GroupAdmin group={group} onGroupUpdate={handleGroupUpdate} />
        )}
      </div>
    </div>
  );
}
