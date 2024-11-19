"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

const frequencyOptions = ['Daily', 'Weekly', 'BiWeekly', 'Monthly', 'Custom'] as const;
const payoutOrderOptions = ['Admin_Selected', 'First_Come_First_Serve'] as const;

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

type NewGroupFormData = z.infer<typeof newGroupSchema>;
type JoinGroupFormData = z.infer<typeof joinGroupSchema>;

const toastStyles = {
  className:
    'group fixed bottom-4 left-1/2 -translate-x-1/2 w-[360px] rounded-lg border bg-white text-foreground shadow-lg',
  style: { zIndex: 50 },
  duration: 3000,
};

export const GroupModals = () => {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useContext();

  const { data: subscriptionStatus } = trpc.subscription.checkSubscriptionStatus.useQuery();

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
      toast({
        ...toastStyles,
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Something went wrong. Please try again later.',
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
      toast({
        ...toastStyles,
        variant: 'destructive',
        title: 'Error',
        description: 'Please verify the group ID and try again.',
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
            <Link href="/pricing" className="text-sm text-yellow-400 hover:text-yellow-500 font-medium mt-1">
              View Plans →
            </Link>
          </div>
        ),
      });
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
            <Link href="/pricing" className="text-sm text-yellow-400 hover:text-yellow-500 font-medium mt-1">
              View Plans →
            </Link>
          </div>
        ),
      });
      return;
    }

    setJoinOpen(true);
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
      <Button className="bg-yellow-400 hover:bg-yellow-500 text-white" onClick={handleCreateClick}>
        <Plus className="w-4 h-4 mr-2" />
        New Group
      </Button>

      <Button variant="outline" className="border-yellow-400 text-yellow-500" onClick={handleJoinClick}>
        <Users className="w-4 h-4 mr-2" />
        Join Group
      </Button>

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
              <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-white">
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
              <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-white">
                Join Group
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
