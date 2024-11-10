import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog";
import { 
  User2, Users, Calendar, Wallet, RefreshCw, 
  CircleDollarSign, CreditCard, ArrowUpRight, Play
} from 'lucide-react';
import { useToast } from "@/src/components/ui/use-toast";
import { trpc } from '@/src/app/_trpc/client';
import type { GroupWithStats } from '../types/groups';


interface GroupDetailsProps {
  group: GroupWithStats;
}

const FemaleIcon = () => (
  <div className="relative w-5 h-5 text-red-500">
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 13v8M9 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </div>
);

const MaleIcon = () => (
  <div className="relative w-5 h-5 text-blue-500">
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <circle cx="10" cy="14" r="5" stroke="currentColor" strokeWidth="2"/>
      <path d="M13.5 10.5l5-5M15 5h3.5V8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </div>
);

const GenderIcon = ({ gender }: { gender: string | null }) => {
  if (!gender) return <User2 className="w-5 h-5 text-gray-500" />;

  switch (gender.toUpperCase()) {
    case 'FEMALE':
      return <FemaleIcon />;
    case 'MALE':
      return <MaleIcon />;
    default:
      return <User2 className="w-5 h-5 text-gray-500" />;
  }
};

export function GroupDetails({ group }: GroupDetailsProps) {
  const [isStartCycleDialogOpen, setIsStartCycleDialogOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const { toast } = useToast();

  const startCycleMutation = trpc.auth.startContributionCycle.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contribution cycle has been started successfully.",
      });
      setIsStartCycleDialogOpen(false);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start contribution cycle.",
      });
    },
    onSettled: () => {
      setIsStarting(false);
    },
  });

  const handleStartCycle = async () => {
    setIsStarting(true);
    await startCycleMutation.mutateAsync({ groupId: group.id });
  };

  // Currency formatting helpers
  const formatCurrency = (value: string | null | undefined) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value || '0'));
  };

  // Formatted values
  const formattedBalance = formatCurrency(group.currentBalance);
  const formattedAmount = formatCurrency(group.contributionAmount);
  const formattedTotal = formatCurrency(group.totalContributions);

  // Calculate progress percentage
  const progressPercentage = group.totalContributions === '0' 
    ? 0 
    : Math.min(
        (parseFloat(group.totalContributions) / 
        (parseFloat(group.contributionAmount || '0') * group._count.groupMemberships)) * 100, 
        100
      );

  // Find next member in line
  const nextInLine = group.members.find(m => m.payoutOrder === 1);


  return (
    <div className="space-y-6">
{/* Header with Start Cycle button for admins */}
<div className="flex justify-between items-center">
  <h2 className="text-xl font-semibold">Group Details</h2>
  {group.isAdmin && (
    <Button
      onClick={() => setIsStartCycleDialogOpen(true)}
      className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-6 py-3 rounded-full text-lg font-semibold flex items-center shadow-lg transform transition-transform duration-200 hover:scale-105"
      disabled={isStarting}
    >
      {isStarting ? (
        <>
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
          Starting...
        </>
      ) : (
        <>
          <Play className="mr-2 h-5 w-5" />
          Start Contribution Cycle
        </>
      )}
    </Button>
  )}
</div>



      {/* Financial Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedBalance}</div>
            <p className="text-xs text-muted-foreground">
              Available for payouts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contribution Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formattedAmount}</div>
            <p className="text-xs text-muted-foreground">
              {group.contributionFrequency?.toLowerCase() || 'Not set'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {nextInLine ? (
              <>
                <div className="flex items-center gap-2">
                  <GenderIcon gender={nextInLine.gender} />
                  <div className="text-xl font-bold truncate">
                    {nextInLine.firstName} {nextInLine.lastName}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Next in line for payout
                </p>
              </>
            ) : (
              <>
                <div className="text-xl font-bold">Not Set</div>
                <p className="text-xs text-muted-foreground">
                  No members in queue
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Schedule Details Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-600" />
              Contribution Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Next Contribution</p>
              <p className="text-sm font-semibold">
                {group.nextContributionDate
                  ? new Date(group.nextContributionDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Not scheduled'}
              </p>
              <Badge variant="outline" className="w-fit mt-1">
                {group.contributionFrequency || 'Not set'}
              </Badge>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Total Contributions</span>
                <span className="text-sm font-medium text-green-600">{formattedTotal}</span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full">
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-purple-600" />
              Payout Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Next Payout</p>
              <p className="text-sm font-semibold">
                {group.nextPayoutDate
                  ? new Date(group.nextPayoutDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : 'Not scheduled'}
              </p>
              <Badge variant="outline" className="w-fit mt-1">
                {group.payoutFrequency || 'Not set'}
              </Badge>
            </div>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Payout Order Method</p>
              <p className="text-sm font-semibold">
                {group.payoutOrderMethod.split('_').join(' ')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members List Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-600" />
              Group Members
            </div>
            <Badge variant="secondary">
              {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {group.members.length > 0 ? (
            <div className="divide-y">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center p-4"
                >
                  <div className="flex items-center flex-1 min-w-0 gap-3">
                    <GenderIcon gender={member.gender} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {member.firstName} {member.lastName}
                        </p>
                        <div className="flex gap-1.5">
                          {member.isAdmin && (
                            <Badge variant="outline" className="text-xs">
                              Admin
                            </Badge>
                          )}
                          <Badge 
                            variant={member.payoutOrder === 1 ? "default" : "secondary"} 
                            className={`text-xs ${member.payoutOrder === 1 ? 'bg-purple-500' : ''}`}
                          >
                            #{member.payoutOrder} in line
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p>No members found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Start Cycle Confirmation Dialog */}
      <AlertDialog 
        open={isStartCycleDialogOpen} 
        onOpenChange={setIsStartCycleDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Contribution Cycle</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Please confirm that all group members are ready to start and the following details are correct:
              </p>
              <div className="bg-secondary p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Contribution Amount:</span>
                  <span className="font-medium">{formattedAmount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Frequency:</span>
                  <span className="font-medium">{group.contributionFrequency || 'Not set'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Members:</span>
                  <span className="font-medium">{group.members.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-medium">Stripe</span>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg mt-4">
                <p className="text-amber-700 text-sm font-medium">
                  ⚠️ Important: All members will be charged {formattedAmount} immediately upon confirmation.
                  Ensure all members have valid payment methods set up.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStartCycle}
              disabled={isStarting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isStarting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                'Start Cycle'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}

export default GroupDetails;
