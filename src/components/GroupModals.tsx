"use client"

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { trpc } from '../app/_trpc/client';
import { useToast } from './ui/use-toast';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const newGroupSchema = z.object({
  name: z.string().min(3, 'Group name must be at least 3 characters'),
  description: z.string().optional(),
  contributionAmount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: 'Please enter a valid amount',
  }),
  contributionFrequency: z.enum(['Daily', 'Weekly', 'BiWeekly', 'Monthly', 'Custom']),
  payoutFrequency: z.enum(['Daily', 'Weekly', 'BiWeekly', 'Monthly', 'Custom']),
  payoutOrderMethod: z.enum(['Admin_Selected', 'First_Come_First_Serve'])
});

const joinGroupSchema = z.object({
  groupId: z.string().min(1, 'Please enter a group ID')
});

type NewGroupFormData = z.infer<typeof newGroupSchema>;
type JoinGroupFormData = z.infer<typeof joinGroupSchema>;

const toastStyles = {
  className: "group fixed bottom-4 left-1/2 -translate-x-1/2 w-[360px] rounded-lg border bg-white text-foreground shadow-lg",
  style: { zIndex: 50 },
  duration: 3000,
};

export const GroupModals = () => {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useContext();

  const { data: subscriptionStatus } = trpc.checkSubscriptionStatus.useQuery();

  const createGroup = trpc.createGroup.useMutation({
    onSuccess: (data) => {
      toast({
        ...toastStyles,
        title: "Success",
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">🎉 Group Created!</span>
            <span className="text-sm text-muted-foreground">Your savings group has been created successfully.</span>
          </div>
        ),
      });
      setCreateOpen(false);
      utils.getAllGroups.invalidate();
      router.push(`/groups/${data.group.id}`);
    },
    onError: (error) => {
      console.error('Create group error:', error);
      toast({
        ...toastStyles,
        variant: "destructive",
        title: "Error",
        description: "Something went wrong. Please try again later.",
      });
    },
  });

  const joinGroup = trpc.joinGroup.useMutation({
    onSuccess: (data) => {
      toast({
        ...toastStyles,
        title: "Success",
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">🎉 Successfully Joined!</span>
            <span className="text-sm text-muted-foreground">Welcome to the group.</span>
          </div>
        ),
      });
      setJoinOpen(false);
      utils.getAllGroups.invalidate();
      router.push(`/groups/${data.membership.groupId}`);
    },
    onError: (error) => {
      console.error('Join group error:', error);
      toast({
        ...toastStyles,
        variant: "destructive",
        title: "Error",
        description: "Please verify the group ID and try again.",
      });
    },
  });

  const {
    register: registerNewGroup,
    handleSubmit: handleNewGroupSubmit,
    formState: { errors: newGroupErrors },
    reset: resetNewGroupForm,
  } = useForm<NewGroupFormData>({
    resolver: zodResolver(newGroupSchema),
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
        title: "Subscription Required",
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">✨ Premium Feature</span>
            <span className="text-sm text-muted-foreground">
              You need an active subscription to create groups.
            </span>
            <Link 
              href="/pricing" 
              className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-1"
            >
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
        title: "Subscription Required",
        description: (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">✨ Premium Feature</span>
            <span className="text-sm text-muted-foreground">
              You need an active subscription to join groups.
            </span>
            <Link 
              href="/pricing" 
              className="text-sm text-purple-600 hover:text-purple-700 font-medium mt-1"
            >
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
      <Button 
        className="bg-purple-600 hover:bg-purple-700 text-white"
        onClick={handleCreateClick}
      >
        <Plus className="w-4 h-4 mr-2" />
        New Group
      </Button>

      <Button 
        variant="outline" 
        className="border-purple-600 text-purple-600"
        onClick={handleJoinClick}
      >
        <Users className="w-4 h-4 mr-2" />
        Join Group
      </Button>

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
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  {...registerNewGroup('description')}
                  className="mt-1"
                  placeholder="Describe your group"
                />
              </div>

              <div>
                <Label htmlFor="contributionAmount">Contribution Amount</Label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="contributionAmount"
                    {...registerNewGroup('contributionAmount')}
                    className="pl-7"
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                  />
                </div>
                {newGroupErrors.contributionAmount && (
                  <p className="text-sm text-red-500 mt-1">{newGroupErrors.contributionAmount.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contributionFrequency">Contribution Frequency</Label>
                  <Select
                    onValueChange={(value) =>
                      registerNewGroup('contributionFrequency').onChange({
                        target: { value },
                      })
                    }>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="BiWeekly">Bi-Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="payoutFrequency">Payout Frequency</Label>
                  <Select
                    onValueChange={(value) =>
                      registerNewGroup('payoutFrequency').onChange({
                        target: { value },
                      })
                    }>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Daily">Daily</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="BiWeekly">Bi-Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="payoutOrderMethod">Payout Order Method</Label>
                <Select
                  onValueChange={(value) =>
                    registerNewGroup('payoutOrderMethod').onChange({
                      target: { value },
                    })
                  }>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin_Selected">Admin Selected</SelectItem>
                    <SelectItem value="First_Come_First_Serve">First Come First Serve</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" disabled={createGroup.isLoading}>
                {createGroup.isLoading ? 'Creating...' : 'Create Group'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

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
                  placeholder="Enter group ID"
                />
                {joinGroupErrors.groupId && (
                  <p className="text-sm text-red-500 mt-1">{joinGroupErrors.groupId.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={joinGroup.isLoading}>
                {joinGroup.isLoading ? 'Joining...' : 'Join Group'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};