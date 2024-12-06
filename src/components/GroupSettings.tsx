"use client"

import React, { useState } from 'react';
import { GroupWithStats } from '../types/groups';
import { useToast } from '@/src/components/ui/use-toast';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import {
  LogOut,
  CircleDollarSign,
  CreditCard,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { trpc } from '../app/_trpc/client';
import { Badge } from '@/src/components/ui/badge';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/src/components/ui/select';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface GroupSettingsProps {
  group: GroupWithStats;
  onLeaveGroup: () => void;
  onGroupUpdate: () => void;
}

const GroupSettings: React.FC<GroupSettingsProps> = ({ group, onLeaveGroup, onGroupUpdate }) => {
  const { toast } = useToast();
  const utils = trpc.useContext();

  const isAdmin = group.isAdmin;

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [newAdminId, setNewAdminId] = useState<string>('');

  // New State Variables for Payment Setup Status
  const [isConnectingBank, setIsConnectingBank] = useState(false);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [showBECSSetupDialog, setShowBECSSetupDialog] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);

  // Fetch current user's setup status
  const { data: userSetupStatus } = trpc.user.getUserSetupStatus.useQuery();

  // TRPC Mutations
  const leaveGroupMutation = trpc.group.leaveGroup.useMutation({
    onSuccess: () => {
      toast({
        title: 'Left Group',
        description: 'You have successfully left the group.',
      });
      onLeaveGroup();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Payment Setup Mutations
  const createStripeAccount = trpc.auth.createStripeConnectAccount.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to initiate Stripe onboarding. Please try again.',
      });
    },
  });

  const setupBECSMutation = trpc.auth.setupBECSDirectDebit.useMutation({
    onSuccess: (data) => {
      setSetupIntentClientSecret(data.setupIntentClientSecret);
      setShowBECSSetupDialog(true);
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to initiate BECS setup. Please try again.',
      });
    },
  });

  // Payment Setup Handlers
  const handleStripeOnboarding = async () => {
    setIsConnectingBank(true);
    try {
      await createStripeAccount.mutateAsync();
    } finally {
      setIsConnectingBank(false);
    }
  };

  const handleBECSSetup = async () => {
    setIsAddingPayment(true);
    try {
      await setupBECSMutation.mutateAsync();
    } finally {
      setIsAddingPayment(false);
    }
  };

  const handleBECSSetupDone = () => {
    setShowBECSSetupDialog(false);
    utils.user.getUserSetupStatus.invalidate();
  };

  const handleLeaveGroup = async () => {
    if (isAdmin && !newAdminId) {
      toast({
        title: 'Error',
        description: 'Please select a new admin before leaving the group.',
        variant: 'destructive',
      });
      return;
    }

    await leaveGroupMutation.mutateAsync({
      groupId: group.id,
      newAdminId: isAdmin ? newAdminId : undefined,
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* Payment Setup Status Section */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Payment Setup Status</CardTitle>
            <Badge variant="outline" className="font-medium">
              2 of 2 required
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {/* Receive Payment Setup */}
          <div className="flex items-start space-x-4 rounded-lg bg-card/50 border p-4">
            <div className="rounded-full p-2 bg-background">
              {userSetupStatus?.stripeOnboardingStatus === 'Completed' ? (
                <CheckCircle className="text-green-500 w-5 h-5" />
              ) : (
                <CircleDollarSign className="text-muted-foreground w-5 h-5" />
              )}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">Receive Payment Setup</p>
                {userSetupStatus?.stripeOnboardingStatus === 'Completed' ? (
                  <Badge
                    variant="success"
                    className="bg-green-100 text-green-700 hover:bg-green-100"
                  >
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Required
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Connect your bank account to receive your payout when it's your turn
              </p>
              {userSetupStatus?.stripeOnboardingStatus !== 'Completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleStripeOnboarding}
                  disabled={isConnectingBank}
                  className="mt-2.5"
                >
                  {isConnectingBank ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-yellow-400" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CircleDollarSign className="mr-2 h-4 w-4" />
                      Connect Bank Account
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Payment Method Setup */}
          <div className="flex items-start space-x-4 rounded-lg bg-card/50 border p-4">
            <div className="rounded-full p-2 bg-background">
              {userSetupStatus?.becsSetupStatus === 'Completed' ? (
                <CheckCircle className="text-green-500 w-5 h-5" />
              ) : (
                <CreditCard className="text-muted-foreground w-5 h-5" />
              )}
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="font-medium">Payment Method Setup</p>
                {userSetupStatus?.becsSetupStatus === 'Completed' ? (
                  <Badge
                    variant="success"
                    className="bg-green-100 text-green-700 hover:bg-green-100"
                  >
                    Completed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Required
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Add a payment method for your recurring contributions to the group
              </p>
              {userSetupStatus?.becsSetupStatus !== 'Completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBECSSetup}
                  disabled={isAddingPayment}
                  className="mt-2.5"
                >
                  {isAddingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-yellow-400" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Add Payment Method
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
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
                  className="mt-6 w-full bg-yellow-400 hover:bg-yellow-500 text-white"
                  onClick={handleBECSSetupDone}
                >
                  Done
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </Elements>
      )}

      {/* Leave Group Section */}
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <LogOut className="h-8 w-8 text-red-600" />
            Leave Group
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isAdmin && (
            <Alert className="border border-red-200 bg-red-50">
              <AlertTitle className="text-lg font-semibold text-red-700">Admin Action Required</AlertTitle>
              <AlertDescription className="text-base mt-2 text-gray-900">
                As the group admin, you must select a new admin before leaving the group.
                This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}

          <Dialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="lg" className="px-8 font-medium">
                Leave Group
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="text-xl">Leave Group</DialogTitle>
                <DialogDescription className="text-base pt-2">
                  Are you sure you want to leave this group? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>

              {isAdmin && (
                <div className="space-y-3 py-4">
                  <label className="text-base font-medium">Select New Admin</label>
                  <Select value={newAdminId} onValueChange={setNewAdminId}>
                    <SelectTrigger className="text-base">
                      <SelectValue placeholder="Choose new admin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Members</SelectLabel>
                        {group.members
                          .filter((member) => !member.isAdmin)
                          .map((member) => (
                            <SelectItem key={member.id} value={member.id} className="text-base">
                              {member.firstName}
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setShowLeaveDialog(false)}
                  className="text-base px-8"
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleLeaveGroup} className="text-base px-8">
                  Leave Group
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupSettings;
