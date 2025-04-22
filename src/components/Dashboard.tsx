"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { GroupModals } from "./GroupModals";

import {
  Bell,
  Users,
  Calendar,
  Wallet,
  ChevronRight,
  CircleDollarSign,
  PiggyBank,
  BarChart3,
  MessageSquare,
} from "lucide-react";

import { format } from "date-fns";
import * as Pusher from "pusher-js";
import { MembershipStatus, GroupStatus, Frequency } from "@prisma/client";
import { trpc } from "../app/_trpc/client";

// Type for your user prop
interface DashboardProps {
  user: {
    firstName?: string;
    subscriptionStatus?: string;
    emailVerified?: boolean;
  };
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const utils = trpc.useContext();

  // --- Query calls ---
  const { data: groups = [], isLoading: groupsLoading } = trpc.group.getAllGroups.useQuery();
  const { data: recentActivity = [], isLoading: activityLoading } = trpc.user.getRecentActivity.useQuery();
  const { data: savingsStats, isLoading: savingsLoading } = trpc.user.getSavingsStats.useQuery();
  const { data: paymentHistory, isLoading: paymentLoading } = trpc.user.getPaymentHistory.useQuery();
  const { data: userStats } = trpc.user.getUserStats.useQuery();
  const { data: newMessages = [], isLoading: newMessagesLoading } = trpc.group.getNewMessagesCount.useQuery();

  // For Pusher channels
  const pusherChannelsRef = useRef<Pusher.Channel[]>([]);

  // Helper: Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);

  // Previously you had a function getNextContribution -> changed to nextCycle
  // Return the group with the earliest nextCycleDate
  const getNextCycleGroup = () => {
    if (!groups?.length) return null;

    // Filter groups that have a nextCycleDate
    const upcomingGroups = groups
      .filter((g) => g.nextCycleDate) // changed from nextContributionDate
      .sort((a, b) => {
        const dateA = a.nextCycleDate ? new Date(a.nextCycleDate) : new Date();
        const dateB = b.nextCycleDate ? new Date(b.nextCycleDate) : new Date();
        return dateA.getTime() - dateB.getTime();
      });

    return upcomingGroups[0] || null;
  };

  const nextCycleGroup = getNextCycleGroup();

  // Sum total members across all groups
  const totalMembers = groups.reduce((sum, group) => sum + (group.members?.length || 0), 0);

  // Pusher real-time subscription
  useEffect(() => {
    const pusher = new Pusher.default(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      forceTLS: true,
    });

    const subscribeToGroup = (groupId: string) => {
      const channel = pusher.subscribe(`group-${groupId}`);
      channel.bind("new-message", (data: any) => {
        utils.group.getNewMessagesCount.invalidate();
        utils.user.getRecentActivity.invalidate();
      });
      pusherChannelsRef.current.push(channel);
    };

    groups.forEach((g) => {
      subscribeToGroup(g.id);
    });

    return () => {
      pusherChannelsRef.current.forEach((channel) => {
        pusher.unsubscribe(channel.name);
      });
      pusherChannelsRef.current = [];
      pusher.disconnect();
    };
  }, [groups, utils.group, utils.user]);

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.firstName || "Guest"} 👋
              </h1>
              <p className="mt-2 text-gray-500">Track your savings groups and upcoming cycles</p>
            </div>
            <GroupModals />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Active Groups */}
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Active Groups</h2>
              <Users className="w-5 h-5 text-yellow-400" />
            </div>

            <div className="space-y-4">
              {groupsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : groups.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-4">No savings groups yet</p>
                  <p className="text-sm text-gray-600">Join a group to start saving together</p>
                </div>
              ) : (
                groups.map((g) => (
                  <Link href={`/groups/${g.id}`} key={g.id}>
                    <div className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{g.name}</h3>
                          <p className="text-sm text-gray-500">
                            {g.members?.length || 0} members
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Next Cycle (Previously Next Contribution) */}
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Next Cycle</h2>
              <Calendar className="w-5 h-5 text-yellow-400" />
            </div>

            <div className="space-y-4">
              {groupsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !nextCycleGroup ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">No upcoming cycle dates</p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100">
                  <p className="text-sm text-yellow-600 font-medium">
                    Due on{" "}
                    {nextCycleGroup.nextCycleDate
                      ? format(new Date(nextCycleGroup.nextCycleDate), "PPP")
                      : "N/A"}
                    :
                  </p>
                  <p className="text-2xl font-bold text-yellow-700 mt-1">
                    {formatCurrency(Number(nextCycleGroup.contributionAmount))}
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">{nextCycleGroup.name}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <Bell className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-4">
              {activityLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : recentActivity.length > 0 ? (
                recentActivity.slice(0, 3).map((act) => { 
                  const activityDate = new Date(act.createdAt);
                  const now = new Date();
                  const diffInHours = Math.floor(
                    (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60)
                  );

                  let timeDisplay;
                  if (diffInHours < 1) {
                    timeDisplay = "Just now";
                  } else if (diffInHours < 24) {
                    timeDisplay = `${diffInHours}h ago`;
                  } else if (diffInHours < 48) {
                    timeDisplay = "Yesterday";
                  } else {
                    timeDisplay = format(activityDate, "MMM d");
                  }

                  // Default icon
                  let Icon = Bell;
                  let bgColor = "bg-gray-100";
                  let iconColor = "text-gray-600";

                  // Adjust icon, colors, etc. based on activity.type
                  if (act.type === "PAYOUT") {
                    Icon = CircleDollarSign;
                    bgColor = "bg-green-100";
                    iconColor = "text-green-600";
                  } else if (act.type === "MEMBERSHIP") {
                    Icon = Users;
                    bgColor = "bg-blue-100";
                    iconColor = "text-blue-600";
                  } else if (act.type === "MESSAGE") {
                    Icon = MessageSquare;
                    bgColor = "bg-yellow-100";
                    iconColor = "text-yellow-600";
                  }

                  let message = "";
                  if (act.type === "PAYOUT") {
                    message = `Payout: ${formatCurrency(Number(act.amount))}`;
                  } else if (act.type === "MEMBERSHIP") {
                    message =
                      act.status === MembershipStatus.Active
                        ? "New member joined"
                        : "Member left";
                  } else if (act.type === "MESSAGE") {
                    message = "New message";
                  }

                  return (
                    <div key={act.id} className="flex items-start gap-3">
                      <div className={`p-2 rounded-full ${bgColor} shrink-0`}>
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[150px]">
                            {act.groupName}
                          </p>
                          <span className="text-xs text-gray-400 shrink-0">{timeDisplay}</span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">{message}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">No recent activity</p>
                </div>
              )}
            </div>
          </Card>

          {/* Savings Overview */}
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Savings Overview</h2>
              <PiggyBank className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-6">
              {savingsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Contributed</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(savingsStats?.totalContributed || 0)}
                    </p>
                    <p className="text-sm text-gray-600">Across all circles</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Expected Payout</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(savingsStats?.expectedPayout || 0)}
                    </p>
                    <p className="text-sm text-gray-600">From active groups</p>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Group Stats */}
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Group Stats</h2>
              <CircleDollarSign className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active Groups</span>
                <span className="font-medium text-gray-900">{userStats?.groupCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Members</span>
                <span className="font-medium text-gray-900">{totalMembers}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-medium text-green-600">
                  {paymentHistory?.successRate?.toFixed(1) || 0}%
                </span>
              </div>
            </div>
          </Card>

          {/* Payment History */}
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Payment History</h2>
              <BarChart3 className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-4">
              {paymentLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Last Payment</span>
                    <span className="font-medium text-gray-900">
                      {paymentHistory?.payments[0]
                        ? formatCurrency(Number(paymentHistory.payments[0].amount))
                        : "No payments"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Monthly Average</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(paymentHistory?.averageMonthlyPayment || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Payments</span>
                    <span className="font-medium text-gray-900">
                      {paymentHistory?.payments.length || 0}
                    </span>
                  </div>
                </>
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
