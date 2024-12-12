"use client";

import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import { useToast } from "@/src/components/ui/use-toast";
import { trpc } from "@/src/app/_trpc/client";
import Link from "next/link";
import { Loader2, Users2, FileCheck, Bell, CreditCard, BarChart4, CalendarClock } from "lucide-react";

export function BillingSettings({ user: initialUser }: { user: any }) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [userStatus, setUserStatus] = useState(initialUser.subscriptionStatus);
  const utils = trpc.useContext();

  // Mutation handlers remain the same...
  const { mutate: cancelSubscription } = trpc.subscription.cancelSubscription.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: () => {
      setIsLoading(false);
      setUserStatus("PendingCancel");
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription has been cancelled successfully. You'll have access until the end of your billing period.",
        variant: "default",
        className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
      });
      utils.subscription.checkSubscriptionStatus.invalidate();
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription. Please try again or contact support.",
        variant: "destructive",
        className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
      });
    },
  });

  const { mutate: reactivateSubscription } = trpc.subscription.reactivateSubscription.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: () => {
      setIsLoading(false);
      setUserStatus("Active");
      toast({
        title: "Subscription Reactivated",
        description: "Your subscription has been reactivated successfully.",
        variant: "default",
        className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
      });
      utils.subscription.checkSubscriptionStatus.invalidate();
    },
    onError: (error) => {
      setIsLoading(false);
      toast({
        title: "Error",
        description: error.message || "Failed to reactivate subscription",
        variant: "destructive",
        className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
      });
    },
  });

  const handleCancellation = () => {
    cancelSubscription();
  };

  const handleReactivation = () => {
    reactivateSubscription();
  };

  const proFeatures = [
    {
      icon: <Users2 className="h-4 w-4 text-yellow-500" />,
      title: "Unlimited Groups",
      description: "Create and join as many savings groups as you want"
    },
    {
      icon: <FileCheck className="h-4 w-4 text-yellow-500" />,
      title: "Smart Contracts",
      description: "Automated contracts for all group members"
    },
    {
      icon: <Bell className="h-4 w-4 text-yellow-500" />,
      title: "Automated System",
      description: "Smart reminders and automated payments/payouts"
    },
    {
      icon: <CreditCard className="h-4 w-4 text-yellow-500" />,
      title: "Secure Banking",
      description: "Bank-grade security and direct debit integration"
    },
    {
      icon: <BarChart4 className="h-4 w-4 text-yellow-500" />,
      title: "Advanced Analytics",
      description: "Detailed insights and financial reporting"
    }
  ];

  return (
    <div className="space-y-4">
      <Card className="border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-medium">Current Plan</CardTitle>
              <CardDescription>
                {userStatus === "Active" && (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Active Pro Plan
                  </span>
                )}
                {userStatus === "PendingCancel" && (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    Cancellation scheduled
                  </span>
                )}
                {userStatus !== "Active" && userStatus !== "PendingCancel" && (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-gray-300" />
                    Free Plan
                  </span>
                )}
              </CardDescription>
            </div>
            {(userStatus === "Active" || userStatus === "PendingCancel") && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="h-3 w-3" />
                <span>Next billing: {new Date(initialUser.stripeCurrentPeriodEnd).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {proFeatures.map((feature, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 rounded-md border bg-card p-3 transition-all ${
                  userStatus === "Active" || userStatus === "PendingCancel"
                    ? ""
                    : "opacity-60"
                }`}
              >
                <div className="mt-0.5">{feature.icon}</div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-medium leading-none">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-4 pt-4">
          {userStatus === "Active" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Cancel Subscription"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-2">
                    <p>Are you sure you want to cancel your subscription? This will:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Keep your access until the end of current billing period</li>
                      <li>Pause any active groups where members don't have active subscriptions</li>
                      <li>Limit your ability to create new groups</li>
                      <li>Remove access to premium features after billing period ends</li>
                    </ul>
                    <p className="mt-4">You can reactivate your subscription at any time.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancellation}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Cancel Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : userStatus === "PendingCancel" ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="default"
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Reactivating...
                    </>
                  ) : (
                    "Reactivate Subscription"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reactivate Subscription?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your subscription will continue and you won't lose access to any features. 
                    You'll continue to be billed on your regular billing date.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReactivation}
                    className="bg-yellow-500 hover:bg-yellow-600"
                  >
                    Reactivate Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Link href="/pricing">
              <Button 
                size="sm" 
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
              >
                Upgrade to Pro
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}