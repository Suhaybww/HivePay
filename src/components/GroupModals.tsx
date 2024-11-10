"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Users, ExternalLink } from 'lucide-react';
import { TRPCClientError } from '@trpc/client';
import { AppRouter } from '../trpc';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/src/components/ui/dialog";
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useToast } from './ui/use-toast';
import { trpc } from '../app/_trpc/client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

const frequencyOptions = ['Daily', 'Weekly', 'BiWeekly', 'Monthly', 'Custom'] as const;
const payoutOrderOptions = ['Admin_Selected', 'First_Come_First_Serve'] as const;
const genderOptions = ['Male', 'Female'] as const;

const newGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters'),
  description: z.string().optional(),
  contributionAmount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Please enter a valid amount',
  }),
  contributionFrequency: z.enum(frequencyOptions),
  payoutFrequency: z.enum(frequencyOptions),
  payoutOrderMethod: z.enum(payoutOrderOptions),
});

const joinGroupSchema = z.object({
  groupId: z.string().min(1, 'Please enter a group ID'),
});

const stripeAccountSetupSchema = z.object({
  phoneNumber: z.string().min(10, 'Please enter a valid phone number'),
  age: z.number().min(18, 'You must be at least 18').max(120, 'Please enter a valid age'),
  gender: z.enum(genderOptions),
});

type NewGroupFormData = z.infer<typeof newGroupSchema>;
type JoinGroupFormData = z.infer<typeof joinGroupSchema>;
type StripeAccountSetupFormData = z.infer<typeof stripeAccountSetupSchema>;

const toastStyles = {
  className:
    'group fixed bottom-4 left-1/2 -translate-x-1/2 w-[360px] rounded-lg border bg-white text-foreground shadow-lg',
  style: { zIndex: 50 },
  duration: 3000,
};

export const GroupModals = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboardingStatus = searchParams.get('onboarding');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useContext();

  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);

  // Using trpc.user.getCurrentUser.useQuery()
  const { data: user, isLoading: isUserLoading } = trpc.user.getCurrentUser.useQuery();
  const { data: subscriptionStatus } = trpc.subscription.checkSubscriptionStatus.useQuery();
  const { data: userStatus } = trpc.user.getCurrentUser.useQuery();

  const setupBECSMutation = trpc.auth.setupBECSDirectDebit.useMutation({
    onSuccess: (data) => {
      setSetupIntentClientSecret(data.setupIntentClientSecret);
      setIsSetupDialogOpen(true);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to initiate BECS setup.",
      });
    },
  });

  const handleSetupBECS = async () => {
    if (!user || !user.id) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "User information is missing.",
      });
      return;
    }

    await setupBECSMutation.mutateAsync({ userId: user.id });
  };

  useEffect(() => {
    if (onboardingStatus === 'completed' && !isUserLoading && user && user.id) {
      handleSetupBECS();
    }
  }, [onboardingStatus, isUserLoading, user]);

  const createStripeAccount = trpc.auth.createStripeConnectAccount.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error) => {
      toast({
        ...toastStyles,
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to set up Stripe account. Please try again.',
      });
    },
  });

  // Custom type guard to check if error has redirectUrl
  function isStripeRedirectError(
    error: unknown
  ): error is TRPCClientError<AppRouter> & { message: string; data: { cause: { redirectUrl: string } } } {
    return (
      error instanceof TRPCClientError &&
      'message' in error &&
      (error.data as any)?.cause?.redirectUrl !== undefined
    );
  }

  const createGroup = trpc.group.createGroup.useMutation({
    onSuccess: (data) => {
      toast({
        ...toastStyles,
        title: 'Success',
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">🎉 Group Created!</span>
            <span className="text-sm text-muted-foreground">
              Your savings group has been created successfully.
            </span>
          </div>
        ),
      });
      setCreateOpen(false);
      utils.group.getAllGroups.invalidate();
      router.push(`/groups/${data.group.id}`);
    },
    onError: (error) => {
      console.error('Create group error:', error);
      if (isStripeRedirectError(error)) {
        setShowConnectDialog(true);
        if (error.data.cause.redirectUrl) {
          window.location.href = error.data.cause.redirectUrl;
        }
        return;
      }

      toast({
        ...toastStyles,
        variant: 'destructive',
        title: 'Error',
        description:
          error.message === 'Stripe account setup required'
            ? 'Please complete your Stripe account setup first.'
            : error.message || 'Something went wrong. Please try again later.',
      });
    },
  });

  const joinGroup = trpc.group.joinGroup.useMutation({
    onSuccess: (data) => {
      toast({
        ...toastStyles,
        title: 'Success',
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">🎉 Successfully Joined!</span>
            <span className="text-sm text-muted-foreground">Welcome to the group.</span>
          </div>
        ),
      });
      setJoinOpen(false);
      utils.group.getAllGroups.invalidate();
      router.push(`/groups/${data.membership.groupId}`);
    },
    onError: (error) => {
      console.error('Join group error:', error);
      if (isStripeRedirectError(error)) {
        setShowConnectDialog(true);
        if (error.data.cause.redirectUrl) {
          window.location.href = error.data.cause.redirectUrl;
        }
        return;
      }

      toast({
        ...toastStyles,
        variant: 'destructive',
        title: 'Error',
        description:
          error.message === 'Stripe account setup required'
            ? 'Please complete your Stripe account setup first.'
            : 'Please verify the group ID and try again.',
      });
    },
  });

  const {
    register: registerNewGroup,
    control,
    handleSubmit: handleNewGroupSubmit,
    formState: { errors: newGroupErrors },
    reset: resetNewGroupForm,
  } = useForm<NewGroupFormData>({
    resolver: zodResolver(newGroupSchema),
    defaultValues: {
      contributionFrequency: undefined,
      payoutFrequency: undefined,
      payoutOrderMethod: undefined,
    },
  });

  const {
    register: registerJoinGroup,
    handleSubmit: handleJoinGroupSubmit,
    formState: { errors: joinGroupErrors },
    reset: resetJoinGroupForm,
  } = useForm<JoinGroupFormData>({
    resolver: zodResolver(joinGroupSchema),
  });

  const {
    register: registerStripeSetup,
    control: controlStripeSetup,
    handleSubmit: handleStripeSetupSubmit,
    formState: { errors: stripeSetupErrors },
    reset: resetStripeSetupForm,
  } = useForm<StripeAccountSetupFormData>({
    resolver: zodResolver(stripeAccountSetupSchema),
  });

  const handleCreateClick = () => {
    if (!subscriptionStatus?.isSubscribed) {
      toast({
        ...toastStyles,
        title: 'Subscription Required',
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">✨ Premium Feature</span>
            <span className="text-sm text-muted-foreground">
              You need an active subscription to create groups.
            </span>
            <Link href="/pricing" className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-1">
              View Plans →
            </Link>
          </div>
        ),
      });
      return;
    }

    if (!userStatus?.stripeAccountId) {
      setShowConnectDialog(true);
      return;
    }

    setCreateOpen(true);
  };

  const handleJoinClick = () => {
    if (!subscriptionStatus?.isSubscribed) {
      toast({
        ...toastStyles,
        title: 'Subscription Required',
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">✨ Premium Feature</span>
            <span className="text-sm text-muted-foreground">
              You need an active subscription to join groups.
            </span>
            <Link href="/pricing" className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-1">
              View Plans →
            </Link>
          </div>
        ),
      });
      return;
    }

    if (!userStatus?.stripeAccountId) {
      setShowConnectDialog(true);
      return;
    }

    setJoinOpen(true);
  };

  const onStripeSetup = async (data: StripeAccountSetupFormData) => {
    try {
      await createStripeAccount.mutateAsync(data);
    } catch (error) {
      console.error('Failed to initiate Stripe setup:', error);
    }
    resetStripeSetupForm();
  };

  const onCreateGroup = async (data: NewGroupFormData) => {
    await createGroup.mutateAsync(data);
    resetNewGroupForm();
  };

  const onJoinGroup = async (data: JoinGroupFormData) => {
    await joinGroup.mutateAsync(data);
    resetJoinGroupForm();
  };

  return (
    <div className="flex gap-3">
      <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={handleCreateClick}>
        <Plus className="w-4 h-4 mr-2" />
        New Group
      </Button>

      <Button variant="outline" className="border-purple-600 text-purple-600" onClick={handleJoinClick}>
        <Users className="w-4 h-4 mr-2" />
        Join Group
      </Button>

      {/* BECS Setup Dialog */}
      {setupIntentClientSecret && (
        <Elements stripe={stripePromise} options={{ clientSecret: setupIntentClientSecret }}>
          <Dialog open={isSetupDialogOpen}>
            {/* Overlay with blurry background */}
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>
            <DialogContent
              className="fixed inset-0 flex items-center justify-center"
              // Prevent closing the dialog when clicking outside or pressing Esc
              onEscapeKeyDown={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => e.preventDefault()}
            >
              <div className="bg-white rounded-lg p-6 max-w-md mx-auto">
                <DialogHeader>
                  <DialogTitle>Set Up BECS Direct Debit</DialogTitle>
                </DialogHeader>
                <DialogDescription>
                  <p>Please enter your bank details to set up BECS Direct Debit.</p>
                  <div className="mt-4">
                    <PaymentElement />
                  </div>
                </DialogDescription>
                <DialogFooter>
                  {/* Remove Cancel button to prevent closing */}
                  {/* You can include a Done button if necessary */}
                  <Button onClick={() => {/* handle submission */}} className="bg-green-600 hover:bg-green-700 text-white">
                    Done
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </Elements>
      )}

      {/* Stripe Connect Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Set Up Payments</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleStripeSetupSubmit(onStripeSetup)} className="space-y-4">
            <p className="text-sm text-gray-600">
              To participate in savings groups, you need to set up your payment account. Please provide the following information to continue.
            </p>
            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                {...registerStripeSetup('phoneNumber')}
                className="mt-1"
                placeholder="Enter your phone number"
              />
              {stripeSetupErrors.phoneNumber && (
                <p className="text-sm text-red-500 mt-1">{stripeSetupErrors.phoneNumber.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                {...registerStripeSetup('age', { valueAsNumber: true })}
                className="mt-1"
                placeholder="Enter your age"
                type="number"
                min={18}
                max={120}
              />
              {stripeSetupErrors.age && (
                <p className="text-sm text-red-500 mt-1">{stripeSetupErrors.age.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Controller
                control={controlStripeSetup}
                name="gender"
                defaultValue={undefined}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {genderOptions.map((gender) => (
                        <SelectItem key={gender} value={gender}>
                          {gender}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {stripeSetupErrors.gender && (
                <p className="text-sm text-red-500 mt-1">{stripeSetupErrors.gender.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white">
              <ExternalLink className="w-4 h-4 mr-2" />
              Set Up Stripe Account
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create New Group Dialog */}
      {subscriptionStatus?.isSubscribed && (
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Savings Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleNewGroupSubmit(onCreateGroup)} className="space-y-4">
              <div>
                <Label htmlFor="name">Group Name</Label>
                <Input
                  id="name"
                  {...registerNewGroup('name')}
                  className="mt-1"
                  placeholder="Enter group name"
                />
                {newGroupErrors.name && (
                  <p className="text-sm text-red-500 mt-1">{newGroupErrors.name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...registerNewGroup('description')}
                  className="mt-1"
                  placeholder="Enter group description (optional)"
                />
              </div>
              <div>
                <Label htmlFor="contributionAmount">Contribution Amount</Label>
                <Input
                  id="contributionAmount"
                  {...registerNewGroup('contributionAmount')}
                  className="mt-1"
                  placeholder="Enter amount"
                />
                {newGroupErrors.contributionAmount && (
                  <p className="text-sm text-red-500 mt-1">{newGroupErrors.contributionAmount.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="contributionFrequency">Contribution Frequency</Label>
                <Controller
                  control={control}
                  name="contributionFrequency"
                  defaultValue={undefined}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {newGroupErrors.contributionFrequency && (
                  <p className="text-sm text-red-500 mt-1">{newGroupErrors.contributionFrequency.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="payoutFrequency">Payout Frequency</Label>
                <Controller
                  control={control}
                  name="payoutFrequency"
                  defaultValue={undefined}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map((freq) => (
                          <SelectItem key={freq} value={freq}>
                            {freq}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {newGroupErrors.payoutFrequency && (
                  <p className="text-sm text-red-500 mt-1">{newGroupErrors.payoutFrequency.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="payoutOrderMethod">Payout Order Method</Label>
                <Controller
                  control={control}
                  name="payoutOrderMethod"
                  defaultValue={undefined}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                      <SelectContent>
                        {payoutOrderOptions.map((method) => (
                          <SelectItem key={method} value={method}>
                            {method}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {newGroupErrors.payoutOrderMethod && (
                  <p className="text-sm text-red-500 mt-1">{newGroupErrors.payoutOrderMethod.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                Create Group
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Join Group Dialog */}
      {subscriptionStatus?.isSubscribed && (
        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Join a Savings Group</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleJoinGroupSubmit(onJoinGroup)} className="space-y-4">
              <div>
                <Label htmlFor="groupId">Group ID</Label>
                <Input
                  id="groupId"
                  {...registerJoinGroup('groupId')}
                  className="mt-1"
                  placeholder="Enter the Group ID"
                />
                {joinGroupErrors.groupId && (
                  <p className="text-sm text-red-500 mt-1">{joinGroupErrors.groupId.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                Join Group
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
