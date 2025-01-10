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
  CircleDollarSign,
  CreditCard,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  InfoIcon,
  Loader2,
  PauseCircle,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react"
import { useToast } from "@/src/components/ui/use-toast"
import { trpc } from "@/src/app/_trpc/client"

// Import your new types
import type { GroupWithStats, GroupSchedule } from "../types/groups"

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

// ====== Extra Types ======
interface GroupDetailsProps {
  group: GroupWithStats
}

// We'll rename the form data to have just a single "cycleDate"
interface StartCycleFormData {
  cycleDate: Date
}

// If you have a "checkAndUpdateGroupStatus" returning something like:
interface GroupStatusResponse {
  status: string
  inactiveMembers?: Array<{
    id: string
    email: string
    name: string
    subscriptionStatus: SubscriptionStatus
  }>
}

// The single field form schema
const StartCycleSchema = z.object({
  cycleDate: z.date({ required_error: "Cycle date is required" }),
})

// A simple helper Avatar
const InitialsAvatar = ({
  firstName,
  lastName,
}: {
  firstName: string
  lastName: string
}) => (
  <Avatar className="h-8 w-8 bg-yellow-400 text-black font-bold">
    <AvatarFallback>
      {`${firstName?.[0] || ""}${lastName?.[0] || ""}`}
    </AvatarFallback>
  </Avatar>
)

// ====== Main GroupDetails Component ======

export function GroupDetails({ group }: GroupDetailsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const utils = trpc.useContext()

  const [isStartCycleDialogOpen, setIsStartCycleDialogOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)

  // Subscription details (if relevant)
  const { data: subscriptionDetails } = trpc.subscription.getUserSubscriptionDetails.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  )

  // Group schedule => typed as GroupSchedule
  const { data: groupSchedule, isLoading: isLoadingSchedule } = trpc.cycle.getGroupSchedule.useQuery<
    GroupSchedule
  >({ groupId: group.id }, { refetchInterval: 30_000 })

  // Periodically check group status if paused
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
              : "Group paused due to inactive subscriptions."
        })
      }
      utils.group.getGroupDetails.invalidate()
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to check group status"
      })
    },
  })

  const handleCheckStatus = () => {
    groupStatusCheck.mutate({ groupId: group.id })
  }

  // Reactivate group
  const { mutate: reactivateGroup } = trpc.subscription.reactivateGroup.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group reactivated successfully.",
      })
      utils.group.getGroupDetails.invalidate()
    },
    onError: (err: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to reactivate group"
      })
    },
    onSettled: () => {
      setIsReactivating(false)
    },
  })

  const handleReactivate = () => {
    // Check subscription
    if (!subscriptionDetails?.isActive) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You need an active subscription to reactivate the group."
      })
      return
    }
    setIsReactivating(true)
    reactivateGroup({ groupId: group.id })
  }

  useEffect(() => {
    if (group.status === "Paused") {
      const intervalId = setInterval(handleCheckStatus, 60_000)
      return () => clearInterval(intervalId)
    }
  }, [group.status])

  // For displaying how members are set up
  const { data: groupMembersSetupStatus } = trpc.group.getGroupMembersSetupStatus.useQuery({
    groupId: group.id,
  })

  // scheduleGroupCycles mutation
  const scheduleGroupCycles = trpc.cycle.scheduleGroupCycles.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group cycles scheduled successfully.",
      })
      setIsStartCycleDialogOpen(false)
      utils.group.getGroupDetails.invalidate()
      utils.cycle.getGroupSchedule.invalidate()
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to schedule group cycles."
      })
    },
    onSettled: () => {
      setIsStarting(false)
    },
  })

  // React Hook Form
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StartCycleFormData>({
    resolver: zodResolver(StartCycleSchema),
    defaultValues: { cycleDate: undefined },
  })

  const onSubmit = (data: StartCycleFormData) => {
    if (!subscriptionDetails?.isActive) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "You need an active subscription to start a cycle."
      })
      return
    }
    setIsStarting(true)
    scheduleGroupCycles.mutate({
      groupId: group.id,
      cycleDate: data.cycleDate,
    })
  }

  // Helpers
  const formatCurrency = (val: string | null | undefined) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "AUD",
    }).format(parseFloat(val || "0"))

  // Basic stats
  const formattedBalance = formatCurrency(group.currentBalance)
  const formattedAmount = formatCurrency(group.contributionAmount)
  const formattedTotal = formatCurrency(group.totalContributions)

  const progressPercentage =
    group.totalContributions === "0"
      ? 0
      : Math.min(
          (parseFloat(group.totalContributions) /
            (parseFloat(group.contributionAmount || "0") * group._count.groupMemberships)) *
            100,
          100
        )

  // Next in line for payout
  const nextInLine = group.members.find((m) => m.payoutOrder === 1)

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
                    This group is paused due to inactive subscriptions. All members need active
                    subs to resume.
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

      {/* Financial Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formattedBalance}</div>
            <p className="text-xs text-muted-foreground">Available for payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Contribution Amount</CardTitle>
            <CreditCard className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formattedAmount}</div>
            <p className="text-xs text-muted-foreground">
              {group.cycleFrequency?.toLowerCase() || "Not set"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next Payout</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {nextInLine ? (
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

      {/* Cycle info row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-yellow-500" />
              Next Cycle Date
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
                  <p className="text-sm font-medium text-muted-foreground">Upcoming Cycle</p>
                  <p className="text-sm font-semibold">
                    {groupSchedule.currentSchedule.nextCycleDate
                      ? new Date(groupSchedule.currentSchedule.nextCycleDate).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )
                      : "Not scheduled"}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {groupSchedule.currentSchedule.cycleFrequency || "Not set"}
                  </Badge>
                </div>

                {/* optional total contributions progress */}
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Total Contributions
                    </span>
                    <span className="text-sm font-medium text-green-600">
                      {formattedTotal}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-secondary rounded-full">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Failed to load schedule</p>
            )}
          </CardContent>
        </Card>

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
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {groupSchedule.currentSchedule.cycleFrequency || "Not set"}
                  </Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Failed to load payout schedule</p>
            )}
          </CardContent>
        </Card>
      </div>

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
            <div className="divide-y">
              {groupMembersSetupStatus.map((member: any) => (
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
                  <p>Please confirm the cycle details and pick the next cycle date/time.</p>
                </div>

                {/* Info row */}
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
                    Next Cycle Date/Time
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
                      <span className="font-semibold">{formattedAmount}</span> from each member,
                      according to your chosen <strong>cycle date</strong> and frequency.
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
  )
}
