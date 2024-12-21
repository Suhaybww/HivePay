"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '../_trpc/client';
import { Badge } from '@/src/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { GroupModals } from '@/src/components/GroupModals';
import { useToast } from '@/src/components/ui/use-toast';
import {
  Users,
  Calendar,
  AlertCircle,
  ArrowRight,
  DollarSign,
  PlusCircle,
} from 'lucide-react';
import type { GroupWithStats } from '@/src/types/groups';

export default function GroupsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useContext();

  const { data: groups, isLoading, isError } = trpc.group.getAllGroups.useQuery(undefined, {
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to fetch groups.',
      });
    },
  });

  // Subscribe to admin status changes
  useEffect(() => {
    // Set up event listeners for admin changes
    const handleAdminChange = () => {
      utils.group.getAllGroups.invalidate();
    };

    window.addEventListener('adminStatusChanged', handleAdminChange);

    // Cleanup
    return () => {
      window.removeEventListener('adminStatusChanged', handleAdminChange);
    };
  }, [utils.group]);

  // Function to refresh groups data
  const refreshGroups = () => {
    utils.group.getAllGroups.invalidate();
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'AUD',
    }).format(parseFloat(amount));
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const GroupCard = ({ group }: { group: GroupWithStats }) => {
    // Get active member count from the members array
    const activeMemberCount = group.members.length;

    return (
      <Card className="overflow-hidden border border-border/50 hover:border-yellow-200 transition-all duration-200">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <div className="space-y-1.5">
            <CardTitle className="text-lg font-semibold">
              {group.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              <span>{activeMemberCount} member{activeMemberCount !== 1 ? 's' : ''}</span>
            </CardDescription>
          </div>
          {group.isAdmin && (
            <Badge 
              variant="secondary"
              className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
            >
              Admin
            </Badge>
          )}
        </CardHeader>
        <CardContent className="pb-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
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
                <div className="flex items-center text-sm text-muted-foreground">
                  <Calendar className="mr-2 h-4 w-4" />
                  Next contribution: {formatDate(group.nextContributionDate)}
                </div>
              )}
            </div>
    
            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Total Contributions
                </p>
                <p className="text-base font-semibold">
                  {formatCurrency(group.totalContributions)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Current Balance
                </p>
                <p className="text-base font-semibold">
                  {formatCurrency(group.currentBalance)}
                </p>
              </div>
            </div>
    
            <Button 
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-white mt-4"
              onClick={() => router.push(`/groups/${group.id}`)}
            >
              Enter Group
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Groups</h1>
          <p className="text-muted-foreground mt-1">
            Manage your savings circles
          </p>
        </div>
        <GroupModals onGroupCreated={refreshGroups} />
      </div>

      {isLoading ? (
        <div className="h-60 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="h-60 flex items-center justify-center text-center">
          <div>
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Failed to load groups</p>
          </div>
        </div>
      ) : groups?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="h-60 flex flex-col items-center justify-center text-center p-6">
            <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
              <PlusCircle className="h-6 w-6 text-yellow-600" />
            </div>
            <h3 className="font-semibold mb-1">No groups yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create or join a savings circle to start your group saving journey
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}