"use client"

import React, { useState } from "react"
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
  User2,
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
} from "lucide-react"
import { useToast } from "@/src/components/ui/use-toast"
import { trpc } from "@/src/app/_trpc/client"
import type { GroupWithStats } from "../types/groups"
import { Elements, PaymentElement } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import { Dialog, DialogContent } from "@/src/components/ui/dialog"
import { Input } from "@/src/components/ui/input"
import { Label } from "@/src/components/ui/label"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { DatePicker } from "@/src/components/ui/date-picker" // Adjust the path accordingly
import { cn } from "../lib/utils"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

interface GroupDetailsProps {
  group: GroupWithStats
}

interface StartCycleFormData {
  scheduleDate: Date;
  payoutDate: Date;
}


// Define form schema using zod
const StartCycleSchema = z.object({
  scheduleDate: z.date({
    required_error: "Schedule date is required",
  }),
  payoutDate: z.date({
    required_error: "Payout date is required",
  }),
});

const FemaleIcon = () => (
  <div className="relative w-5 h-5 text-red-500">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 13v8M9 18h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </div>
)

const MaleIcon = () => (
  <div className="relative w-5 h-5 text-blue-500">
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <circle cx="10" cy="14" r="5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M13.5 10.5l5-5M15 5h3.5V8.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  </div>
)

const GenderIcon = ({ gender }: { gender: string | null }) => {
  if (!gender) return <User2 className="w-5 h-5 text-gray-500" />

  switch (gender.toUpperCase()) {
    case "FEMALE":
      return <FemaleIcon />
    case "MALE":
      return <MaleIcon />
    default:
      return <User2 className="w-5 h-5 text-gray-500" />
  }
}

export function GroupDetails({ group }: GroupDetailsProps) {
  const [isStartCycleDialogOpen, setIsStartCycleDialogOpen] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [showBECSSetupDialog, setShowBECSSetupDialog] = useState(false)
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const utils = trpc.useContext()

  // Fetch current user's setup status
  const { data: userSetupStatus } = trpc.user.getUserSetupStatus.useQuery()

  // Fetch all group members' setup statuses
  const { data: groupMembersSetupStatus } = trpc.group.getGroupMembersSetupStatus.useQuery({
    groupId: group.id,
  })

  // Start Contribution Cycle Mutation
  const startCycleMutation = trpc.auth.startContributionCycle.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Contribution cycle has been started successfully.",
      })
      setIsStartCycleDialogOpen(false)
      // Optionally, refetch group data
      utils.group.getGroupDetails.invalidate()
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to start contribution cycle.",
      })
    },
    onSettled: () => {
      setIsStarting(false)
    },
  })

  // Create Stripe Account Mutation
  const createStripeAccount = trpc.auth.createStripeConnectAccount.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initiate Stripe onboarding. Please try again.",
      })
    },
  })

  // Setup BECS Direct Debit Mutation
  const setupBECSMutation = trpc.auth.setupBECSDirectDebit.useMutation({
    onSuccess: (data) => {
      setSetupIntentClientSecret(data.setupIntentClientSecret)
      setShowBECSSetupDialog(true)
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initiate BECS setup. Please try again.",
      })
    },
  })

   // Add updateGroupDates mutation
   const updateGroupDatesMutation = trpc.group.updateGroupDates.useMutation({
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Group dates have been updated successfully.",
      })
      // setIsEditingDates(false)
      // Refetch group data
      utils.group.getGroupDetails.invalidate()
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update group dates.",
      })
    },
  })

    // Form for date updates
    const dateUpdateForm = useForm({
      defaultValues: {
        scheduleDate: group.nextContributionDate ? new Date(group.nextContributionDate) : undefined,
        payoutDate: group.nextPayoutDate ? new Date(group.nextPayoutDate) : undefined,
      },
    })
  

  // Handle Stripe Onboarding
  const handleStripeOnboarding = async () => {
    await createStripeAccount.mutateAsync()
  }

  // Handle BECS Setup
  const handleBECSSetup = async () => {
    await setupBECSMutation.mutateAsync()
  }

  // Form setup using react-hook-form
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

// Update the onSubmit handler to use StartCycleFormData
const onSubmit = (data: StartCycleFormData) => {
  setIsStarting(true);
  startCycleMutation.mutate({
    groupId: group.id,
    scheduleDate: data.scheduleDate,
    payoutDate: data.payoutDate,
  });
};

// Also update the handleDateUpdate function
const handleDateUpdate = (data: any) => {
  updateGroupDatesMutation.mutate({
    groupId: group.id,
    scheduleDate: data.scheduleDate instanceof Date ? data.scheduleDate.toISOString() : data.scheduleDate,
    payoutDate: data.payoutDate instanceof Date ? data.payoutDate.toISOString() : data.payoutDate,
  });
};


  // Currency formatting helpers
  const formatCurrency = (value: string | null | undefined) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(value || "0"))
  }

  // Formatted values
  const formattedBalance = formatCurrency(group.currentBalance)
  const formattedAmount = formatCurrency(group.contributionAmount)
  const formattedTotal = formatCurrency(group.totalContributions)

  // Calculate progress percentage
  const progressPercentage =
    group.totalContributions === "0"
      ? 0
      : Math.min(
          (parseFloat(group.totalContributions) /
            (parseFloat(group.contributionAmount || "0") * group._count.groupMemberships)) *
            100,
          100
        )

  // Find next member in line
  const nextInLine = group.members.find((m) => m.payoutOrder === 1)

  // Handle BECS Setup Dialog Submission
  const handleBECSSetupDone = () => {
    setShowBECSSetupDialog(false)
    utils.user.getUserSetupStatus.invalidate()
    utils.group.getGroupMembersSetupStatus.invalidate()
  }

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

      {/* User Setup Status Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Your Setup Status</h3>
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-2">
            {userSetupStatus?.stripeOnboardingStatus === "Completed" ? (
              <CheckCircle className="text-green-500 w-6 h-6" />
            ) : (
              <XCircle className="text-red-500 w-6 h-6" />
            )}
            <span>Receive Payment Setup</span>
            {userSetupStatus?.stripeOnboardingStatus !== "Completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStripeOnboarding}
                className="ml-2"
              >
                Complete Setup
              </Button>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {userSetupStatus?.becsSetupStatus === "Completed" ? (
              <CheckCircle className="text-green-500 w-6 h-6" />
            ) : (
              <XCircle className="text-red-500 w-6 h-6" />
            )}
            <span>Direct Debit Setup</span>
            {userSetupStatus?.becsSetupStatus !== "Completed" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBECSSetup}
                className="ml-2"
              >
                Complete Setup
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Current Balance Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <CircleDollarSign className="h-4 w-4 text-purple-600" />
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
            <CreditCard className="h-4 w-4 text-green-600" />
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
        <CalendarIcon className="h-4 w-4 text-purple-600" />
        Contribution Schedule
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="flex flex-col space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Next Contribution</p>
        <p className="text-sm font-semibold">
          {group.nextContributionDate
            ? new Date(group.nextContributionDate).toLocaleDateString("en-US", {
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
          <span className="text-sm font-medium text-muted-foreground">
            Total Contributions
          </span>
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

  {/* Payout Schedule Card */}
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
            ? new Date(group.nextPayoutDate).toLocaleDateString("en-US", {
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
        <p className="text-sm font-medium text-muted-foreground">Payout Order Method</p>
        <p className="text-sm font-semibold">
          {group.payoutOrderMethod.split("_").join(" ")}
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
              {group.members.length} {group.members.length === 1 ? "member" : "members"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {groupMembersSetupStatus && groupMembersSetupStatus.length > 0 ? (
            <div className="divide-y">
              {groupMembersSetupStatus.map((member) => (
                <div key={member.id} className="flex items-center p-4">
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
                            className={`text-xs ${
                              member.payoutOrder === 1 ? "bg-purple-500" : ""
                            }`}
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
                          <span className="text-xs">Stripe Onboarding</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {member.becsSetupStatus === "Completed" ? (
                            <CheckCircle className="text-green-500 w-4 h-4" />
                          ) : (
                            <XCircle className="text-red-500 w-4 h-4" />
                          )}
                          <span className="text-xs">BECS Setup</span>
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

      {/* BECS Setup Dialog */}
      {setupIntentClientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret: setupIntentClientSecret }}>
          <Dialog open={showBECSSetupDialog} onOpenChange={setShowBECSSetupDialog}>
            <DialogContent className="max-w-lg">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-4">Set Up BECS Direct Debit</h2>
                <PaymentElement />
                <Button
                  className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={handleBECSSetupDone}
                >
                  Done
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </Elements>
      )}

{/* Start Cycle Confirmation Dialog */}
<AlertDialog open={isStartCycleDialogOpen} onOpenChange={setIsStartCycleDialogOpen}>
  <AlertDialogContent className="max-w-[600px]">
    <form onSubmit={handleSubmit(onSubmit)}>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2 text-2xl">
          <Play className="h-6 w-6 text-purple-500" />
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
                <RefreshCw className="h-4 w-4 text-purple-500" />
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
                <p className="text-lg font-medium">Stripe</p>
              </div>
            </div>
          </div>

          {/* Date Selection Section */}
          <div className="space-y-6">
            {/* Schedule Date Picker */}
            <div className="space-y-2">
              <Label htmlFor="scheduleDate" className="flex items-center gap-2 text-sm font-medium">
                <CalendarIcon className="h-4 w-4 text-purple-500" />
                First Contribution Schedule Date
              </Label>
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
              <Label htmlFor="payoutDate" className="flex items-center gap-2 text-sm font-medium">
                <ArrowUpRight className="h-4 w-4 text-purple-500" />
                First Payout Date
              </Label>
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
                All members will be charged <span className="font-semibold">{formattedAmount}</span> immediately upon
                confirmation. Please ensure all members have valid payment methods set up.
              </p>
            </div>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>

      <AlertDialogFooter className="mt-8 gap-3">
        <AlertDialogCancel 
          disabled={isStarting}
          className="rounded-full"
        >
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          type="submit"
          disabled={isStarting}
          className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white px-8 py-3 rounded-full text-base font-semibold flex items-center shadow-lg transform transition-transform duration-200 hover:scale-105 min-w-[140px] justify-center"
        >
          {isStarting ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Starting...
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
export default GroupDetails
