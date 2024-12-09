"use client";

import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { useToast } from "@/src/components/ui/use-toast";
import { trpc } from "@/src/app/_trpc/client";
import Link from "next/link";

export function BillingSettings({ user }: { user: any }) {
  const { toast } = useToast();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Plan & Billing</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            You are currently on the {user.subscriptionStatus === 'Active' ? 'Pro' : 'Free'} plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {user.subscriptionStatus === 'Active' ? (
            <div className="text-sm">
              <p>Next billing date: {new Date(user.stripeCurrentPeriodEnd).toLocaleDateString()}</p>
              <p className="mt-2">Plan features:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Create up to 5 savings groups</li>
                <li>Join unlimited groups</li>
                <li>Advanced analytics</li>
                <li>Priority support</li>
              </ul>
            </div>
          ) : (
            <div className="text-sm">
              <p>Upgrade to Pro to access premium features:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Create multiple savings groups</li>
                <li>Join unlimited groups</li>
                <li>Advanced analytics</li>
                <li>Priority support</li>
              </ul>
            </div>
          )}
        </CardContent>
        <CardFooter>
          {user.subscriptionStatus === 'Active' ? (
            <Button
              variant="outline"
              onClick={() => {
                toast({
                  title: "Contact Support",
                  description: "Please contact support to cancel your subscription.",
                  className: "fixed bottom-4 left-1/2 transform -translate-x-1/2 w-[360px]",
                });
              }}
            >
              Cancel Subscription
            </Button>
          ) : (
            <Link href="/pricing">
              <Button className="bg-yelllow-400 hover:bg-yellow-500">
                Upgrade to Pro
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No payment history available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}