"use client";

import { useState } from "react";
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
import { Loader2, HelpCircle, Trash2 } from "lucide-react";
import { Textarea } from "../ui/text-area";
import { useRouter } from "next/navigation";
import { LogoutLink } from "@kinde-oss/kinde-auth-nextjs/server";

export function AccountSettings({ user }: { user: any }) {
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionReason, setDeletionReason] = useState("");
  const utils = trpc.useContext();

  const { data: deleteStatus } = trpc.user.canDeleteAccount.useQuery();

  const deleteAccount = trpc.user.deleteAccount.useMutation({
    onMutate: () => {
      setIsDeleting(true);
    },
    onSuccess: async () => {
      setIsDeleting(false);
      // Redirect to Kinde&apos;s logout URL
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
    <div className="space-y-4">
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Danger Zone</CardTitle>
          <CardDescription>Permanent account deletion</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-red-500 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-red-900">Delete Account</p>
                  <p className="text-sm text-red-700">
                    This action cannot be undone immediately. Your account will be deactivated and permanently deleted after 30 days.
                  </p>
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
                      Deleting Account...
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
                    <div>
                      <p className="font-medium text-red-600 mb-2">
                        This action will deactivate your account immediately. After 30 days, it will be permanently deleted.
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        <li>Your account will be deactivated immediately</li>
                        <li>You&apos;ll lose access to all groups and savings history</li>
                        <li>Any pending payments or transfers will be cancelled</li>
                        <li>After 30 days, all your data will be permanently deleted</li>
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
                    Delete Account
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