"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
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
  Users,
  Calendar as CalendarIcon,
  CreditCard,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info as InfoIcon,
  Loader2,
  PauseCircle,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/src/components/ui/use-toast";
import { trpc } from "@/src/app/_trpc/client";

import type { GroupWithStats, GroupSchedule } from "../types/groups";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DatePicker } from "@/src/components/ui/date-picker";
import { cn } from "../lib/utils";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { SubscriptionStatus } from "@prisma/client";

// ====== Types ======
interface GroupDetailsProps {
  group: GroupWithStats;
}

interface StartCycleFormData {
  cycleDate: Date;
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

// ====== Zod schema ======
const StartCycleSchema = z.object({
  cycleDate: z.date({ required_error: "Cycle date is required" }),
});

// ====== Helper Avatars ======
const InitialsAvatar = ({ firstName, lastName }: { firstName: string; lastName: string }) => (
  <Avatar className="h-8 w-8 bg-yellow-400 text-black font-bold">
    <AvatarFallback>
      {`${firstName?.[0] || ""}${lastName?.[0] || ""}`}
    </AvatarFallback>
  </Avatar>
);

export function GroupDetails({ group }: GroupDetailsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useContext();

  const [isStartCycleDialogOpen, setIsStartCycleDialogOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);

  // 1) Subscription details
  const { data: subscriptionDetails } = trpc.subscription.getUserSubscriptionDetails.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );

  // 2) Group schedule => typed as GroupSchedule
  const { data: groupSchedule, isLoading: isLoadingSchedule } =
    trpc.cycle.getGroupSchedule.useQuery<GroupSchedule>(
      { groupId: group.id },
      { refetchInterval: 30_000 }
    );

  // 3) groupStatusCheck mutation
  const groupStatusCheck = trpc.subscription.checkAndUpdateGroupStatus.useMutation({
    onSuccess: (res: GroupStatusResponse) => {
      if (res.status === "paused" && res.inactiveMembers) {
        toast({
          variant: "destructive",
          title: "Group Paused",
          description:
            res.inactiveMembers.length > 0
              ? `Group paused due to inactive subscriptions for: ${res.inactiveMembers
                  .map((m) => m.name)
                  .join(", ")}`
              : "Group paused due to inactive subscriptions.",
        });
      }
      utils.group.getGroupDetails.invalidate();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to check group status",
      });
    },
  });

  // 4) We wrap handleCheckStatus in useCallback for stable reference
  const handleCheckStatus = useCallback(() => {
    groupStatusCheck.mutate({ groupId: group.id });
  }, [group.id, groupStatusCheck]);

  // If the group is paused, poll every 60 seconds
  useEffect(() => {
    if (group.status === "Paused") {
      const intervalId = setInterval(handleCheckStatus, 60_000);
      return () => clearInterval(intervalId);
    }
  }, [group.status, handleCheckStatus]);

  // 5) Reactivate group
  const { mutate: reactivateGroup } = trpc.subscription.reactivateGroup.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group reactivated successfully.",
      });
      utils.group.getGroupDetails.invalidate();
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to reactivate group",
      });
    },
    onSettled: () => {
      setIsReactivating(false);
    },
  });

  const handleReactivate = () => {
    if (!subscriptionDetails?.isActive) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You need an active subscription to reactivate the group.",
      });
      return;
    }
    setIsReactivating(true);
    reactivateGroup({ groupId: group.id });
  };

  // 6) For displaying how members are set up
  const { data: groupMembersSetupStatus } = trpc.group.getGroupMembersSetupStatus.useQuery({
    groupId: group.id,
  });

  // 7) scheduleGroupCycles mutation
  const scheduleGroupCycles = trpc.cycle.scheduleGroupCycles.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group cycles scheduled successfully.",
      });
      setIsStartCycleDialogOpen(false);
      utils.group.getGroupDetails.invalidate();
      utils.cycle.getGroupSchedule.invalidate();
    },
    onError: (error) => {
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

  // 8) React Hook Form => scheduling the first cycle
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StartCycleFormData>({
    resolver: zodResolver(StartCycleSchema),
    defaultValues: { cycleDate: undefined },
  });

  const onSubmit = (data: StartCycleFormData) => {
    if (!subscriptionDetails?.isActive) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You need an active subscription to start a cycle.",
      });
      return;
    }
    setIsStarting(true);
    scheduleGroupCycles.mutate({
      groupId: group.id,
      cycleDate: data.cycleDate,
    });
  };

  // ====== Payment Tracking Logic ======
  const totalDebited =
    typeof group.totalDebitedAmount === "number"
      ? group.totalDebitedAmount
      : parseFloat(group.totalDebitedAmount || "0");
  const totalPending =
    typeof group.totalPendingAmount === "number"
      ? group.totalPendingAmount
      : parseFloat(group.totalPendingAmount || "0");
  const totalSuccess =
    typeof group.totalSuccessAmount === "number"
      ? group.totalSuccessAmount
      : parseFloat(group.totalSuccessAmount || "0");

  let paymentFlowStatus: React.ReactNode = null;
  if (totalPending > 0) {
    paymentFlowStatus = (
      <div className="flex items-center gap-2 text-sm font-medium text-yellow-600">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Payments are pending...</span>
      </div>
    );
  } else if (totalDebited > 0 && totalDebited === totalSuccess) {
    paymentFlowStatus = (
      <div className="flex items-center gap-2 text-sm font-medium text-green-600">
        <CheckCircle className="w-4 h-4" />
        <span>All contributions have succeeded!</span>
      </div>
    );
  } else {
    paymentFlowStatus = (
      <div className="text-sm font-medium text-muted-foreground">
        No direct debits yet.
      </div>
    );
  }

  // Next in line => first membership without hasBeenPaid, sorted by payoutOrder
  const nextInLine = [...group.members]
    .filter((m) => !m.hasBeenPaid)
    .sort((a, b) => a.payoutOrder - b.payoutOrder)[0];

  // Next cycle date => from schedule
  const { currentSchedule, futureCycleDates } = groupSchedule || {};
  let firstCycleDate: Date | null = null;
  if (futureCycleDates && futureCycleDates.length > 0) {
    firstCycleDate = new Date(futureCycleDates[0]);
  }

  const projectedPayoutDate = firstCycleDate
    ? new Date(firstCycleDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    : null;

  // total contributions => progress
  const totalContributionsNum = parseFloat(group.totalContributions || "0");
  const contributionAmountNum = parseFloat(group.contributionAmount || "0");
  const totalMembers = group._count.groupMemberships;

  let progressPercentage = 0;
  if (contributionAmountNum > 0 && totalMembers > 0) {
    const ratio = totalContributionsNum / (contributionAmountNum * totalMembers);
    progressPercentage = Math.min(ratio * 100, 100);
  }

  return (
    <div className="space-y-6">
      {/* Header + Admin Buttons */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Group Details</h2>
          {group.status === "Paused" && (
            <TooltipProvider>
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="px-2 py-1 cursor-help">
                    <PauseCircle className="w-4 h-4 mr-1" />
                    Paused
                  </Badge>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  align="center"
                  className="bg-destructive text-destructive-foreground px-3 py-2 text-sm max-w-[300px]"
                >
                  <p>
                    This group is paused due to inactive subscriptions. All members need active subs
                    to resume.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {group.isAdmin && group.status === "Active" && !group.cycleStarted && (
          <Button
            onClick={() => setIsStartCycleDialogOpen(true)}
            size="lg"
            className="bg-primary text-primary-foreground font-medium"
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
                Start cycle
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

      {/* Paused Notice */}
      {group.status === "Paused" && (
        <div className="mb-6 flex items-start space-x-2 bg-yellow-50 p-4 rounded-xl border border-yellow-200">
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-yellow-800">Group Currently Paused</p>
            <p className="text-sm text-yellow-700 mt-1">
              This group is paused due to inactive subscriptions. All members need active
              subscriptions to resume.
            </p>
          </div>
        </div>
      )}

      {/* Payment Flow Tracker */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Payment Flow */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Live Payment Flow</CardTitle>
            <RefreshCw className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-base font-semibold">
              Total Debited:{" "}
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "AUD",
              }).format(totalDebited)}
            </div>
            <p className="text-sm text-muted-foreground">
              Funds debited from members so far.
            </p>
            <div className="mt-4">{paymentFlowStatus}</div>
          </CardContent>
        </Card>

        {/* Contribution Amount */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contribution Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "AUD",
              }).format(parseFloat(group.contributionAmount || "0"))}
            </div>
            <p className="text-xs text-muted-foreground">
              {group.cycleFrequency?.toLowerCase() || "Not set"}
            </p>
          </CardContent>
        </Card>

        {/* Next in line */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next in line</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {!nextInLine ? (
              <>
                <div className="text-xl font-bold">Not Set</div>
                <p className="text-xs text-muted-foreground">No members in queue</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <InitialsAvatar
                    firstName={nextInLine.firstName}
                    lastName={nextInLine.lastName}
                  />
                  <div className="text-xl font-bold truncate">
                    {nextInLine.firstName} {nextInLine.lastName}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Who will receive the next payout
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Next Contribution & Payout => from first futureCycleDates item */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-yellow-500" />
            Next Contribution &amp; Payout
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSchedule ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
            </div>
          ) : !groupSchedule ? (
            <p className="text-sm text-muted-foreground">Failed to load schedule</p>
          ) : !firstCycleDate ? (
            <p className="text-sm text-muted-foreground">Not scheduled</p>
          ) : (
            <>
              {/* Next contribution date info */}
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Contribution Date</p>
                <p className="text-sm font-semibold">
                  {firstCycleDate.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <Badge variant="outline" className="mt-1">
                  {currentSchedule?.cycleFrequency || "Not set"}
                </Badge>
              </div>

              {/* total contributions progress */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Total Contributions
                  </span>
                  <span className="text-sm font-medium text-green-600">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "AUD",
                    }).format(totalContributionsNum)}
                  </span>
                </div>
                <div className="h-2 w-full bg-secondary rounded-full">
                  <div
                    className="h-full bg-green-600 rounded-full"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>

              {/* Projected payout date ~1 week after the first cycle date */}
              {projectedPayoutDate && (
                <div className="flex flex-col space-y-1 mt-4">
                  <p className="text-sm font-medium text-muted-foreground">Projected Payout Date</p>
                  <p className="text-sm font-semibold">
                    {projectedPayoutDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}

              <div className="mt-3 p-3 border border-blue-200 bg-blue-50 rounded-md text-sm text-blue-700">
                Please note that payouts typically occur about a week after the contribution date,
                allowing enough time to process contributions and address any potential payment issues.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Group Members */}
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
            <div className="space-y-2 p-4">
              {groupMembersSetupStatus.map((member: any) => (
                <div
                  key={member.id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-lg border bg-card"
                >
                  {/* Left side */}
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <Badge
                        variant={member.payoutOrder === 1 ? "default" : "secondary"}
                        className={cn(
                          "text-xs mb-1",
                          member.payoutOrder === 1 && "bg-yellow-500 text-black"
                        )}
                      >
                        #{member.payoutOrder}
                      </Badge>
                    </div>
                    <InitialsAvatar firstName={member.firstName} lastName={member.lastName} />

                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <p className="text-sm font-medium truncate leading-5">
                          {member.firstName} {member.lastName}
                        </p>
                        {member.isAdmin && (
                          <Badge variant="outline" className="text-xs">
                            Admin
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
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
                    {member.hasBeenPaid && (
                      <Badge variant="secondary" className="text-xs">
                        Paid
                      </Badge>
                    )}
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

      {/* Start Cycle Dialog */}
      <AlertDialog open={isStartCycleDialogOpen} onOpenChange={setIsStartCycleDialogOpen}>
        <AlertDialogContent className="max-w-[600px]">
          <form onSubmit={handleSubmit(onSubmit)}>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-2xl">
                <Play className="h-6 w-6 text-yellow-400" />
                Start Cycle
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-6 pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <InfoIcon className="h-4 w-4 text-blue-500" />
                  <p>Please confirm the cycle details and pick the first cycle date/time.</p>
                </div>

                {/* Info row */}
                <div className="grid grid-cols-2 gap-4 bg-secondary/50 p-6 rounded-xl">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Contribution Amount</p>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-green-500" />
                      <p className="text-lg font-semibold text-green-600">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "AUD",
                        }).format(parseFloat(group.contributionAmount || "0"))}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Frequency</p>
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-yellow-500" />
                      <p className="text-lg font-medium">{group.cycleFrequency || "Not set"}</p>
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

                {/* Single DatePicker input */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <CalendarIcon className="h-4 w-4 text-yellow-500" />
                    First Cycle Date/Time
                  </label>
                  <Controller
                    control={control}
                    name="cycleDate"
                    render={({ field }) => (
                      <DatePicker
                        selectedDate={field.value}
                        onDateChange={field.onChange}
                        placeholder="Pick date & time (AEDT)"
                        className={cn(
                          "w-full",
                          errors.cycleDate && "border-red-500 focus:ring-red-500"
                        )}
                      />
                    )}
                  />
                  {errors.cycleDate && (
                    <p className="flex items-center gap-1.5 text-xs text-red-500">
                      <XCircle className="h-3.5 w-3.5" />
                      {errors.cycleDate.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl mt-4">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-amber-800">Important Notice</p>
                    <p className="text-sm text-amber-700">
                      This will schedule automatic contributions of{" "}
                      <span className="font-semibold">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "AUD",
                        }).format(parseFloat(group.contributionAmount || "0"))}
                      </span>{" "}
                      from each member, according to your chosen <strong>cycle date</strong> and
                      frequency. Ensure all members have completed their BECS Direct Debit setup.
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
                className="bg-gradient-to-r from-yellow-500 to-yellow-500 text-white px-8 py-3 rounded-full text-base font-semibold flex items-center shadow-lg min-w-[140px] justify-center"
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
}
