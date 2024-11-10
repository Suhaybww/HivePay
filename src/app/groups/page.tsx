"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '../_trpc/client';
import { Badge } from '@/src/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { GroupModals } from '@/src/components/GroupModals';
import { useToast } from '@/src/components/ui/use-toast';
import {
  MoreHorizontal,
  Users,
  Calendar,
  AlertCircle,
  Settings,
  LogOut,
  ArrowRight,
  DollarSign,
  Repeat,
} from 'lucide-react';
import type { GroupWithStats } from '@/src/types/groups';

export default function GroupsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const { data: groups, isLoading, isError } = trpc.group.getAllGroups.useQuery(undefined, {
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch groups.',
      });
    },
  });

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const GroupCard = ({ group }: { group: GroupWithStats }) => (
    <Card className="group hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            {group.name}
          </CardTitle>
          <div>
            <Badge 
              variant={group.isAdmin ? "default" : "secondary"}
              className={group.isAdmin ? "bg-purple-100 text-purple-700 hover:bg-purple-100" : ""}
            >
              {group.isAdmin ? 'Admin' : 'Member'}
            </Badge>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem className="text-red-600 flex items-center">
              <LogOut className="mr-2 h-4 w-4" />
              Leave Group
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-center text-muted-foreground">
            <Users className="mr-2 h-4 w-4" />
            {group._count.groupMemberships} member{group._count.groupMemberships !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center text-muted-foreground">
            <DollarSign className="mr-2 h-4 w-4" />
            {group.contributionAmount ? (
              <span>
                {formatCurrency(group.contributionAmount)}
                {group.contributionFrequency && 
                  <span className="text-muted-foreground/60"> / {group.contributionFrequency.toLowerCase()}</span>
                }
              </span>
            ) : (
              'No contribution set'
            )}
          </div>
          {group.nextContributionDate && (
            <div className="flex items-center text-muted-foreground">
              <Calendar className="mr-2 h-4 w-4" />
              Next: {formatDate(group.nextContributionDate)}
            </div>
          )}
        </div>

        <div className="pt-4 border-t grid grid-cols-2 gap-4">
          <div>
            <p className="text-[0.8rem] font-medium text-muted-foreground mb-1">
              Total Contributions
            </p>
            <p className="text-base font-semibold">
              {formatCurrency(group.totalContributions)}
            </p>
          </div>
          <div>
            <p className="text-[0.8rem] font-medium text-muted-foreground mb-1">
              Current Balance
            </p>
            <p className="text-base font-semibold">
              {formatCurrency(group.currentBalance)}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-2 group-hover:bg-purple-50 group-hover:text-purple-700"
          onClick={() => router.push(`/groups/${group.id}`)}
        >
          View Details
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">My Groups</h1>
          <p className="text-sm text-muted-foreground">
            Manage your savings groups and contributions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GroupModals />
        </div>
      </div>

      {isLoading ? (
        <div className="h-60 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="h-60 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load groups</p>
          </div>
        </div>
      ) : groups?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <Card className="h-60">
          <CardContent className="h-full flex flex-col items-center justify-center text-center p-6">
            <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground font-medium mb-1">No groups found</p>
            <p className="text-sm text-muted-foreground/60">
              Create or join a group to get started
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
