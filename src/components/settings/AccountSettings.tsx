"use client";

import { useState, useEffect } from "react";
import { Button } from "@/src/components/ui/button";
import { useToast } from "@/src/components/ui/use-toast";
import { trpc } from "@/src/app/_trpc/client";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
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
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Loader2, Trash2, RefreshCw } from "lucide-react";
import { Textarea } from "../ui/text-area";
import { useRouter } from "next/navigation";

export function AccountSettings({ user }: { user: any }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const utils = trpc.useContext();

  const { data: deleteStatus } = trpc.user.canDeleteAccount.useQuery();

  // Show reactivation toast if account was just reactivated
  useEffect(() => {
    if (user?.wasReactivated) {
      toast({
        title: "Account Reactivated",
        description: "Welcome back! Your account has been successfully reactivated.",
      });
    }
  }, [user?.wasReactivated, toast]);

  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: async () => {
      setIsDeleting(false);
      toast({
        title: "Account Deactivated",
        description: "Your account has been deactivated. You have 30 days to log back in if you change your mind.",
      });
      // Redirect to Kinde's logout URL
      window.location.href = "/api/auth/logout";
    },
    onError: (error) => {
      setIsDeleting(false);
      toast({
        title: "Error",
        description: error.message || "Failed to delete account. Please contact support.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAccount = () => {
    deleteAccount.mutate({ reason: deletionReason });
  };

  return (
    <div className="space-y-6">
      {user?.wasReactivated && (
        <Alert>
          <RefreshCw className="h-4 w-4" />
          <AlertDescription>
            Your account has been reactivated. Welcome back! Your account settings and data have been restored.
          </AlertDescription>
        </Alert>
      )}

      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Danger Zone</CardTitle>
          <CardDescription>Account Deletion Settings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-red-500 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-900">Delete Account</p>
                  <div className="space-y-1 text-sm text-red-700">
                    <p>
                      Your account will be deactivated immediately, but you have options:
                    </p>
                    <ul className="list-disc list-inside pl-2 space-y-1">
                      <li>Log back in within 30 days to reactivate your account</li>
                      <li>After 30 days, your account will be permanently deleted</li>
                      <li>All data will be permanently removed after the 30-day period</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  disabled={!deleteStatus?.canDelete || isDeleting}
                  className="w-full sm:w-auto"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Deactivating Account...
                    </>
                  ) : (
                    "Delete Account"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="space-y-4">
                    <div className="space-y-3">
                      <p className="font-medium text-red-600">
                        Your account will be deactivated with a 30-day recovery period.
                      </p>
                      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <p className="text-sm text-yellow-800 font-medium">
                          You can reactivate your account by logging back in within 30 days.
                        </p>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Immediate deactivation of your account</li>
                        <li>30-day window to change your mind</li>
                        <li>Loss of access to groups and savings history</li>
                        <li>Cancellation of pending payments or transfers</li>
                        <li>Permanent deletion after 30 days</li>
                      </ul>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Please tell us why you&apos;re leaving (optional):
                      </label>
                      <Textarea
                        value={deletionReason}
                        onChange={(e) => setDeletionReason(e.target.value)}
                        placeholder="Your feedback helps us improve our service"
                        className="h-24"
                      />
                    </div>

                    {!deleteStatus?.canDelete && (
                      <p className="mt-4 text-sm font-medium text-red-600">
                        You cannot delete your account while you have active groups with started cycles. 
                        Please leave or close all groups first.
                      </p>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-red-500 hover:bg-red-600"
                    disabled={!deleteStatus?.canDelete}
                  >
                    Deactivate Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}