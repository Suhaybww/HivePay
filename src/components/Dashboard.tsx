"use client"

import React from 'react';
import { Card } from '@/src/components/ui/card';
import { Bell, Users, Calendar, Wallet, TrendingUp, ChevronRight, CircleDollarSign, PiggyBank, BarChart3 } from 'lucide-react';
import { GroupModals } from './GroupModals';
import { trpc } from '../app/_trpc/client';
import { Skeleton } from '@/src/components/ui/skeleton';
import Link from 'next/link';
import { format } from 'date-fns';

interface DashboardProps {
  user: {
    firstName?: string;
    subscriptionStatus?: string;
    emailVerified?: boolean;
  };
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const { data: groups, isLoading: groupsLoading } = trpc.group.getAllGroups.useQuery();
  const { data: recentActivity, isLoading: activityLoading } = trpc.user.getRecentActivity.useQuery();
  const { data: savingsStats, isLoading: savingsLoading } = trpc.user.getSavingsStats.useQuery();
  const { data: paymentHistory, isLoading: paymentLoading } = trpc.user.getPaymentHistory.useQuery();
  const { data: userStats } = trpc.user.getUserStats.useQuery();

  // Format currency helper
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Get next contribution from groups
  const getNextContribution = () => {
    if (!groups?.length) return null;

    const upcomingContributions = groups
      .filter(group => group.nextContributionDate)
      .sort((a, b) => {
        const dateA = a.nextContributionDate ? new Date(a.nextContributionDate) : new Date();
        const dateB = b.nextContributionDate ? new Date(b.nextContributionDate) : new Date();
        return dateA.getTime() - dateB.getTime();
      });

    return upcomingContributions[0];
  };

  const nextContribution = getNextContribution();

  return (
    <div className="min-h-screen bg-gray-50/40">
      {/* Welcome Section */}
      <div className="border-b bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.firstName || 'Guest'} 👋
              </h1>
              <p className="mt-2 text-gray-500">
                Track your savings groups and upcoming contributions
              </p>
            </div>
            <GroupModals />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Active Circles */}
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
              ) : groups?.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-4">No savings groups yet</p>
                  <p className="text-sm text-gray-600">
                    Join a group to start saving together
                  </p>
                </div>
              ) : (
                groups?.map((group) => (
                  <Link href={`/groups/${group.id}`} key={group.id}>
                    <div className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{group.name}</h3>
                          <p className="text-sm text-gray-500">
                            {group._count?.groupMemberships || 0} members
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

          {/* Next Contribution */}
          <Card className="p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Next Contribution</h2>
              <Calendar className="w-5 h-5 text-yellow-400" />
            </div>
            <div className="space-y-4">
              {groupsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !nextContribution ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">No upcoming contributions</p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-100">
                  <p className="text-sm text-yellow-600 font-medium">
                    Due in {format(new Date(nextContribution.nextContributionDate!), 'PPP')}:
                  </p>
                  <p className="text-2xl font-bold text-yellow-700 mt-1">
                    {formatCurrency(Number(nextContribution.contributionAmount))}
                  </p>
                  <p className="text-sm text-yellow-600 mt-1">{nextContribution.name}</p>
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
              ) : !recentActivity?.length ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">No recent activity</p>
                </div>
              ) : (
                recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-yellow-100">
                      <Wallet className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {activity.description || 'Transaction'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatCurrency(Number(activity.amount))} in {activity.group.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {format(new Date(activity.createdAt), 'PPp')}
                      </p>
                    </div>
                  </div>
                ))
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

          {/* Circle Stats */}
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
                <span className="font-medium text-gray-900">
                  {groups?.reduce((sum, group) => sum + (group._count?.groupMemberships || 0), 0) || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Success Rate</span>
                <span className="font-medium text-green-600">
                  {paymentHistory?.successRate.toFixed(1)}%
                </span>
              </div>
            </div>
          </Card>

{/* Payment History Card (continuation) */}
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
                        : 'No payments'}
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