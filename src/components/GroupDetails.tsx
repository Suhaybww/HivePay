"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Badge } from "@/src/components/ui/badge"
import { Button } from "@/src/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/src/components/ui/alert-dialog"
import {
  Users,
  Calendar as CalendarIcon,
  RefreshCw,
  CircleDollarSign,
  CreditCard,
  ArrowUpRight,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  InfoIcon,
  Loader2,
  PauseCircle,
} from "lucide-react"
import { useToast } from "@/src/components/ui/use-toast"
import { trpc } from "@/src/app/_trpc/client"
import type { GroupWithStats } from "../types/groups"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { DatePicker } from "@/src/components/ui/date-picker"
import { cn } from "../lib/utils"
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip"

import { SubscriptionStatus } from "@prisma/client"

interface GroupDetailsProps {
  group: GroupWithStats
}

interface StartCycleFormData {
  scheduleDate: Date
  payoutDate: Date
}

interface GroupStatusResponse {
  status: string;
  inactiveMembers?: Array<{
    id: string;
    email: string;
    name: string;
    subscriptionStatus: SubscriptionStatus;
  }>;
}

const StartCycleSchema = z.object({
  scheduleDate: z.date({
    required_error: "Schedule date is required",
  }),
  payoutDate: z.date({
    required_error: "Payout date is required",
  }),
})

const InitialsAvatar = ({ firstName, lastName }: { firstName: string; lastName: string }) => (
  <Avatar className="h-8 w-8 bg-yellow-400 text-black font-bold">
    <AvatarFallback>
      {`${firstName[0] || ""}${lastName[0] || ""}`}
    </AvatarFallback>
  </Avatar>
)

export function GroupDetails({ group }: GroupDetailsProps) {
  const [isStartCycleDialogOpen, setIsStartCycleDialogOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const utils = trpc.useContext()

  // Subscription status monitoring
  const { data: subscriptionDetails } = trpc.subscription.getUserSubscriptionDetails.useQuery(
    undefined,
    {
      refetchInterval: 30000,
    }
  );

   // Add these new hooks
   const { data: groupSchedule, isLoading: isLoadingSchedule } = trpc.auth.getGroupSchedule.useQuery(
    { groupId: group.id },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

// Updated mutation
const groupStatusCheck = trpc.subscription.checkAndUpdateGroupStatus.useMutation({
  onSuccess: (data: GroupStatusResponse) => {
    if (data.status === 'paused' && data.inactiveMembers) {
      toast({
        // Use destructive instead of warning since it's not a supported variant
        variant: "destructive",
        title: "Group Paused",
        description: data.inactiveMembers.length > 0
          ? `Group has been paused due to inactive subscriptions for: ${data.inactiveMembers.map(member => member.name).join(', ')}`
          : "Group has been paused due to inactive subscriptions."
      });
    }
    utils.group.getGroupDetails.invalidate();
  },
  onError: (error) => {
    toast({
      variant: "destructive",
      title: "Error",
      description: error.message || "Failed to check group status"
    });
  }
});

  // Reactivation mutation
  const { mutate: reactivateGroup } = trpc.subscription.reactivateGroup.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group has been reactivated successfully.",
      });
      utils.group.getGroupDetails.invalidate();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reactivate group",
      });
    },
    onSettled: () => {
      setIsReactivating(false);
    },
  });

  // Status check handler
  const handleCheckStatus = () => {
    groupStatusCheck.mutate({ groupId: group.id });
  };

  // Reactivation handler
  const handleReactivate = () => {
    if (!subscriptionDetails?.isActive) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You need an active subscription to reactivate the group."
      });
      return;
    }
    setIsReactivating(true);
    reactivateGroup({ groupId: group.id });
  };

  // Periodic status check for paused groups
  useEffect(() => {
    if (group.status === "Paused") {
      const interval = setInterval(handleCheckStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [group.status]);

  // Fetch members setup status
  const { data: groupMembersSetupStatus } = trpc.group.getGroupMembersSetupStatus.useQuery({
    groupId: group.id,
  });

  // Start cycle mutation
  const startCycleMutation = trpc.auth.startContributionCycle.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contribution cycle has been started successfully.",
      });
      setIsStartCycleDialogOpen(false);
      utils.group.getGroupDetails.invalidate();
    },
    onError: (error:any) => {
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

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StartCycleFormData>({
    resolver: zodResolver(StartCycleSchema),
    defaultValues: {
      scheduleDate: undefined,
      payoutDate: undefined,
    },
  });

// Update the onSubmit function
const onSubmit = (data: StartCycleFormData) => {
  if (!subscriptionDetails?.isActive) {
    toast({
      variant: "destructive",
      title: "Error",
      description: "You need an active subscription to start a cycle."
    });
    return;
  }
  setIsStarting(true);
  scheduleGroupCycles.mutate({
    groupId: group.id,
    contributionDate: data.scheduleDate,
    payoutDate: data.payoutDate
  });
};

  const formatCurrency = (value: string | null | undefined) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AUD",
    }).format(parseFloat(value || "0"));
  };

  const formattedBalance = formatCurrency(group.currentBalance);
  const formattedAmount = formatCurrency(group.contributionAmount);
  const formattedTotal = formatCurrency(group.totalContributions);

  const progressPercentage =
    group.totalContributions === "0"
      ? 0
      : Math.min(
          (parseFloat(group.totalContributions) /
            (parseFloat(group.contributionAmount || "0") * group._count.groupMemberships)) *
            100,
          100
        );

  const nextInLine = group.members.find((m) => m.payoutOrder === 1);

  const scheduleGroupCycles = trpc.auth.scheduleGroupCycles.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group cycles have been scheduled successfully.",
      });
      setIsStartCycleDialogOpen(false);
      utils.group.getGroupDetails.invalidate();
      utils.auth.getGroupSchedule.invalidate();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to schedule group cycles.",
      });
    },
    onSettled: () => {
      setIsStarting(false);
    },
  });

  const pauseGroupCycles = trpc.auth.pauseGroupCycles.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group cycles have been paused successfully.",
      });
      utils.group.getGroupDetails.invalidate();
      utils.auth.getGroupSchedule.invalidate();
    },
    onError: (error:any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to pause group cycles.",
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header with Cycle Controls */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Group Details</h2>
          {group.status === "Paused" && (
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="destructive"
                    className="px-2 py-1 cursor-help"
                  >
                    <PauseCircle className="w-4 h-4 mr-1" />
                    Paused
                  </Badge>
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  align="center"
                  className="bg-destructive text-destructive-foreground px-3 py-2 text-sm max-w-[300px]"
                >
                  <p>This group is currently paused due to inactive subscriptions. All members need active subscriptions to resume group activities.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {group.isAdmin && group.status === "Active" && !group.cycleStarted && (
          <Button
            onClick={() => setIsStartCycleDialogOpen(true)}
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            disabled={isStarting}
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting cycle...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Start contribution cycle
              </>
            )}
          </Button>
        )}
        {group.isAdmin && group.status === "Active" && group.cycleStarted && (
          <Button
            onClick={() => pauseGroupCycles.mutate({ groupId: group.id })}
            size="lg"
            variant="outline"
            className="text-red-600 border-red-600 hover:bg-red-50"
            disabled={pauseGroupCycles.isLoading}
          >
            {pauseGroupCycles.isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Pausing cycles...
              </>
            ) : (
              <>
                <PauseCircle className="mr-2 h-4 w-4" />
                Pause cycles
              </>
            )}
          </Button>
        )}
        {group.isAdmin && group.status === "Paused" && (
          <Button
            onClick={handleReactivate}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white font-medium"
            disabled={isReactivating}
          >
            {isReactivating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reactivating...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Reactivate Group
              </>
            )}
          </Button>
        )}
      </div>
  
      {/* Status Warning for Paused Groups */}
      {group.status === "Paused" && (
        <div className="mb-6 flex items-start space-x-2 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">Group Currently Paused</p>
            <p className="text-sm text-yellow-700 mt-1">
              This group is currently paused due to inactive subscriptions. All members need active subscriptions to resume group activities.
            </p>
          </div>
        </div>
      )}
  
{/* Financial Overview Cards */}
<div className="grid gap-4 md:grid-cols-3">
      {/* Current Balance Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
          <CircleDollarSign className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formattedBalance}</div>
          <p className="text-xs text-muted-foreground">Available for payouts</p>
        </CardContent>
      </Card>

      {/* Contribution Amount Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Contribution Amount</CardTitle>
          <CreditCard className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formattedAmount}</div>
          <p className="text-xs text-muted-foreground">
            {group.contributionFrequency?.toLowerCase() || "Not set"}
          </p>
        </CardContent>
      </Card>

      {/* Next Payout Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          {nextInLine ? (
            <>
              <div className="flex items-center gap-2">
                <InitialsAvatar firstName={nextInLine.firstName} lastName={nextInLine.lastName} />
                <div className="text-xl font-bold truncate">
                  {nextInLine.firstName} {nextInLine.lastName}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Next in line for payout</p>
            </>
          ) : (
            <>
              <div className="text-xl font-bold">Not Set</div>
              <p className="text-xs text-muted-foreground">No members in queue</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Schedule Details Section */}
    <div className="grid gap-4 md:grid-cols-2">
      {/* Contribution Schedule Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-yellow-500" />
            Contribution Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSchedule ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            </div>
          ) : groupSchedule ? (
            <>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Next Contribution</p>
                <p className="text-sm font-semibold">
                  {groupSchedule.currentSchedule.nextContributionDate
                    ? new Date(groupSchedule.currentSchedule.nextContributionDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not scheduled"}
                </p>
                <Badge variant="outline" className="w-fit mt-1">
                  {group.contributionFrequency || "Not set"}
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

              {/* Upcoming Contributions List */}
              {groupSchedule.upcomingContributions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Upcoming Contributions</h4>
                  <div className="space-y-2">
                    {groupSchedule.upcomingContributions.map((contribution: any) => (
                      <div
                        key={contribution.id}
                        className="flex justify-between items-center p-2 bg-secondary/50 rounded-lg"
                      >
                        <span className="text-sm">
                          {new Date(contribution.scheduledFor).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                        <Badge variant="outline">{formattedAmount}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load schedule</p>
          )}
        </CardContent>
      </Card>
{/* Payout Schedule Card */}
<Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-yellow-500" />
            Payout Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSchedule ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            </div>
          ) : groupSchedule ? (
            <>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Next Payout</p>
                <p className="text-sm font-semibold">
                  {groupSchedule.currentSchedule.nextPayoutDate
                    ? new Date(groupSchedule.currentSchedule.nextPayoutDate).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Not scheduled"}
                </p>
                <Badge variant="outline" className="w-fit mt-1">
                  {group.payoutFrequency || "Not set"}
                </Badge>
              </div>

              <div className="flex flex-col space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">Payout Order</p>
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <InfoIcon className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent 
                        side="top" 
                        align="start"
                        className="bg-popover px-3 py-1.5 text-xs max-w-[200px] text-muted-foreground"
                      >
                        <p>Payout order can be rearranged by admin before the cycle starts</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Upcoming Payouts List */}
                {groupSchedule.upcomingPayouts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Upcoming Payouts</h4>
                    <div className="space-y-2">
                      {groupSchedule.upcomingPayouts.map((payout: any) => (
                        <div
                          key={payout.id}
                          className="flex justify-between items-center p-2 bg-secondary/50 rounded-lg"
                        >
                          <span className="text-sm">
                            {new Date(payout.scheduledFor).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              To: {nextInLine ? `${nextInLine.firstName} ${nextInLine.lastName}` : "TBD"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {group.isAdmin && group.status === "Active" && (
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pauseGroupCycles.mutate({ groupId: group.id })}
                    disabled={pauseGroupCycles.isLoading}
                    className="w-full"
                  >
                    {pauseGroupCycles.isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Pausing cycles...
                      </>
                    ) : (
                      <>
                        <PauseCircle className="mr-2 h-4 w-4" />
                        Pause All Cycles
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Failed to load schedule</p>
          )}
        </CardContent>
      </Card>
    </div>

    {/* Members List Section */}
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-yellow-500" />
            Group Members
          </div>
          <Badge variant="secondary">
            {group.members.length} {group.members.length === 1 ? "member" : "members"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {groupMembersSetupStatus && groupMembersSetupStatus.length > 0 ? (
          <div className="divide-y">
            {groupMembersSetupStatus.map((member:any) => (
              <div key={member.id} className="flex items-center p-4">
                <div className="flex items-center flex-1 min-w-0 gap-3">
                  <InitialsAvatar firstName={member.firstName} lastName={member.lastName} />
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
                          className={`text-xs ${member.payoutOrder === 1 ? "bg-yellow-500" : ""}`}
                        >
                          #{member.payoutOrder} in line
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                    {/* Setup Status Indicators */}
                    <div className="flex items-center space-x-4 mt-2">
                      <div className="flex items-center space-x-1">
                        {member.onboardingStatus === "Completed" ? (
                          <CheckCircle className="text-green-500 w-4 h-4" />
                        ) : (
                          <XCircle className="text-red-500 w-4 h-4" />
                        )}
                        <span className="text-xs">Receive Payment Setup</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {member.becsSetupStatus === "Completed" ? (
                          <CheckCircle className="text-green-500 w-4 h-4" />
                        ) : (
                          <XCircle className="text-red-500 w-4 h-4" />
                        )}
                        <span className="text-xs">Direct Debit Setup</span>
                      </div>
                    </div>
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
<AlertDialog open={isStartCycleDialogOpen} onOpenChange={setIsStartCycleDialogOpen}>
      <AlertDialogContent className="max-w-[600px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-2xl">
              <Play className="h-6 w-6 text-yellow-400" />
              Start Contribution Cycle
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-6 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <InfoIcon className="h-4 w-4 text-blue-500" />
                <p>Please confirm the cycle details and select your contribution dates.</p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 bg-secondary/50 p-6 rounded-xl">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Contribution Amount</p>
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4 text-green-500" />
                    <p className="text-lg font-semibold text-green-600">{formattedAmount}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Frequency</p>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-yellow-500" />
                    <p className="text-lg font-medium">{group.contributionFrequency || "Not set"}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Members</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <p className="text-lg font-medium">{group.members.length}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Payment Method</p>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-slate-500" />
                    <p className="text-lg font-medium">BECS Direct Debit</p>
                  </div>
                </div>
              </div>

              {/* Date Selection Section */}
              <div className="space-y-6">
                {/* Schedule Date Picker */}
                <div className="space-y-2">
                  <label
                    htmlFor="scheduleDate"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <CalendarIcon className="h-4 w-4 text-yellow-500" />
                    First Contribution Schedule Date
                  </label>
                  <Controller
                    control={control}
                    name="scheduleDate"
                    render={({ field }) => (
                      <DatePicker
                        selectedDate={field.value}
                        onDateChange={field.onChange}
                        placeholder="Select contribution date"
                        className={cn(
                          "w-full",
                          errors.scheduleDate && "border-red-500 focus:ring-red-500"
                        )}
                      />
                    )}
                  />
                  {errors.scheduleDate && (
                    <p className="flex items-center gap-1.5 text-xs text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                      {errors.scheduleDate.message}
                    </p>
                  )}
                </div>

                {/* Payout Date Picker */}
                <div className="space-y-2">
                  <label
                    htmlFor="payoutDate"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <ArrowUpRight className="h-4 w-4 text-yellow-500" />
                    First Payout Date
                  </label>
                  <Controller
                    control={control}
                    name="payoutDate"
                    render={({ field }) => (
                      <DatePicker
                        selectedDate={field.value}
                        onDateChange={field.onChange}
                        placeholder="Select payout date"
                        className={cn(
                          "w-full",
                          errors.payoutDate && "border-red-500 focus:ring-red-500"
                        )}
                      />
                    )}
                  />
                  {errors.payoutDate && (
                    <p className="flex items-center gap-1.5 text-xs text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                      {errors.payoutDate.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Important Notice */}
              <div className="flex gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-800">Important Notice</p>
                  <p className="text-sm text-amber-700">
                    This will schedule automatic contributions of{" "}
                    <span className="font-semibold">{formattedAmount}</span> from each member.
                    Ensure all members have completed their BECS Direct Debit setup.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-8 gap-3">
            <AlertDialogCancel disabled={isStarting} className="rounded-full">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={isStarting}
              className="bg-gradient-to-r from-yellow-500 to-yellow-500 hover:from-yellow-500 hover:to-yellow-500 text-white px-8 py-3 rounded-full text-base font-semibold flex items-center shadow-lg transform transition-transform duration-200 hover:scale-105 min-w-[140px] justify-center"
            >
              {isStarting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Cycle
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);
};
