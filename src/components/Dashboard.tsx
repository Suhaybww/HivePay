"use client"

import React from 'react';
import { Card } from './ui/card';
import { Bell, Users, Calendar, Wallet, AlertCircle, ChevronRight } from 'lucide-react';
import { GroupModals } from './GroupModals';
import { trpc } from '../app/_trpc/client';
import { Skeleton } from './ui/skeleton';
import Link from 'next/link';
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
  const { data: userStats } = trpc.user.getUserStats.useQuery();

  return (
    <div className="min-h-screen">
      {/* Welcome Section */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.firstName || 'Guest'}! 👋
              </h1>
              <p className="mt-1 text-gray-500">
                Here's what's happening with your savings groups
              </p>
            </div>
            <GroupModals />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Current Groups */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Current Groups</h2>
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="space-y-4">
              {groupsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : groups?.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm mb-4">No groups joined yet</p>
                  <p className="text-sm text-gray-600">
                    Create or join a group to get started
                  </p>
                </div>
              ) : (
                groups?.map((group: { id: string; name: string; _count?: { groupMemberships?: number } }) => (
                  <Link href={`/groups/${group.id}`} key={group.id}>
                    <div className="p-4 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
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

          {/* Upcoming Contributions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Upcoming Contributions</h2>
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div className="space-y-4">
              {groupsLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !groups?.length ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 text-sm">No upcoming contributions</p>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                  <p className="text-sm text-purple-600 font-medium">Next contribution due in:</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">5 days</p>
                  <p className="text-sm text-purple-600 mt-1">Family Savings Group</p>
                </div>
              )}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <Bell className="w-5 h-5 text-purple-600" />
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
                <>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-green-100">
                      <Wallet className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Contribution Received</p>
                      <p className="text-sm text-gray-500">Sarah contributed $500</p>
                      <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-blue-100">
                      <Users className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">New Member Joined</p>
                      <p className="text-sm text-gray-500">John joined Family Savings</p>
                      <p className="text-xs text-gray-400 mt-1">5 hours ago</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Account Overview */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Account Overview</h2>
              <AlertCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Status</span>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  user?.subscriptionStatus === 'Active' 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {user?.subscriptionStatus}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Email Verified</span>
                <span className={`px-2 py-1 rounded-full text-sm ${
                  user?.emailVerified
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {user?.emailVerified ? 'Verified' : 'Unverified'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Groups Joined</span>
                <span className="font-medium text-gray-900">
                  {userStats?.groupCount || 0}/
                  {user?.subscriptionStatus === 'Active' ? '10' : '5'}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;