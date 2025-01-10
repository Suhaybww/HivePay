"use client"

import React, { useState } from 'react';
import { GroupWithStats, GroupMember } from '../types/groups';
import { useRouter } from 'next/navigation';
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
} from "@/src/components/ui/alert-dialog"
import { useToast } from '@/src/components/ui/use-toast';
import { Input } from '@/src/components/ui/input';
import { Textarea } from './ui/text-area';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Separator } from '@/src/components/ui/separator';
import { trpc } from '../app/_trpc/client';
import {
  Trash2,
  Edit,
  Users,
  GripVertical,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import { AdminInviteSection } from './AdminInviteSection';
import { PauseReason } from "@prisma/client"

interface GroupAdminProps {
  group: GroupWithStats;  // group now includes { pauseReason?: string; ... }
  onGroupUpdate: () => void;
}

const GroupAdmin: React.FC<GroupAdminProps> = ({ group, onGroupUpdate }) => {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useContext();

  const [name, setName] = useState<string>(group.name || '');
  const [description, setDescription] = useState<string>(group.description || '');
  const [members, setMembers] = useState<GroupMember[]>(group.members);
  const [newAdminId, setNewAdminId] = useState<string>('');

  const cycleStarted = group.cycleStarted;

  // 1) Save basic group settings
  const updateGroupMutation = trpc.group.updateGroupSettings.useMutation({
    onSuccess: () => {
      toast({
        title: 'Settings Saved',
        description: 'Your group settings have been updated successfully.',
      });
      // Re-fetch group data
      utils.group.getGroupById.invalidate({ groupId: group.id });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update group settings',
        variant: 'destructive',
      });
    },
  });

  // 2) Transfer admin
  const transferAdminMutation = trpc.group.transferAdminRole.useMutation({
    onSuccess: () => {
      toast({
        title: 'Admin Role Transferred',
        description: 'The admin role has been successfully transferred.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
      setNewAdminId('');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to transfer admin role',
        variant: 'destructive',
      });
    },
  });

  // 3) Remove member
  const removeMemberMutation = trpc.group.removeMember.useMutation({
    onSuccess: () => {
      toast({
        title: 'Member Removed',
        description: 'The member has been removed from the group.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
      onGroupUpdate();
    },
    onError: (error) => {
      // revert changes if error
      setMembers(group.members);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    },
  });

  // 4) Reorder (drag & drop) payout order
  const updatePayoutOrderMutation = trpc.group.updatePayoutOrder.useMutation({
    onSuccess: () => {
      toast({
        title: 'Order Updated',
        description: 'Member order has been updated successfully.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update payout order',
        variant: 'destructive',
      });
    },
  });

  // 5) Retry all payments if paused due to payment failures/refund
  const retryAllPaymentsMutation = trpc.cycle.retryAllPayments.useMutation({
    onSuccess: () => {
      toast({
        title: 'Retry Triggered',
        description: 'Attempting to re-collect payments. Group is now Active.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
      onGroupUpdate();
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to retry payments.',
        variant: 'destructive',
      });
    },
  });

  // 6) Delete group
  const deleteGroupMutation = trpc.group.deleteGroup.useMutation({
    onSuccess: () => {
      toast({
        title: 'Group Deleted',
        description: 'The group has been successfully deleted.',
      });
      router.push('/dashboard');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete group',
        variant: 'destructive',
      });
    },
  });

  // Handler: update group
  const handleSave = async () => {
    await updateGroupMutation.mutateAsync({
      groupId: group.id,
      name,
      description,
    });
    onGroupUpdate();
  };

  // Handler: remove member
  const handleRemoveMember = async (memberId: string) => {
    // optimistic
    setMembers((curr) => curr.filter((m) => m.id !== memberId));
    await removeMemberMutation.mutateAsync({ groupId: group.id, memberId });
  };

  // Handler: transfer admin
  const handleTransferAdmin = async () => {
    if (!newAdminId) {
      toast({
        title: 'Error',
        description: 'Please select a member to transfer admin role to.',
        variant: 'destructive',
      });
      return;
    }
    await transferAdminMutation.mutateAsync({ groupId: group.id, newAdminId });
    onGroupUpdate();
  };

  // Handler: drag & drop reorder
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const reordered = Array.from(members);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);

    setMembers(reordered);

    // now call mutation
    const memberOrders = reordered.map((mem, idx) => ({
      memberId: mem.id,
      newOrder: idx + 1,
    }));
    await updatePayoutOrderMutation.mutateAsync({
      groupId: group.id,
      memberOrders,
    });
    onGroupUpdate();
  };

  // Handler: delete group
  const handleDeleteGroup = async () => {
    try {
      await deleteGroupMutation.mutateAsync({ groupId: group.id });
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  // Handler: retry all payments
  const handleRetryPayments = () => {
    retryAllPaymentsMutation.mutate({ groupId: group.id });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Edit className="h-8 w-8 text-primary" />
            Admin Settings
          </CardTitle>
          <CardDescription className="text-lg">
            Manage your group preferences and members
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* 1) Basic Settings */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-base font-medium">Group Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter group name"
                className="w-full text-lg"
              />
            </div>

            <div className="space-y-2">
              <label className="text-base font-medium">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter group description"
                className="w-full min-h-[120px] text-lg"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} size="lg" className="px-8">
                Save Changes
              </Button>
            </div>
          </div>

          <Separator className="my-8" />

          {/* 2) Invitation and Member Management (only if cycle not started) */}
          {!cycleStarted && (
            <>
              <div className="space-y-4">
                <h3 className="text-xl font-medium flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  <span>Manage Members</span>
                </h3>

                {/* AdminInviteSection for inviting new members */}
                <AdminInviteSection groupId={group.id} />

                {/* Member Management */}
                <Alert className="bg-background">
                  <Users className="h-5 w-5" />
                  <AlertDescription className="text-sm text-muted-foreground">
                    Drag members to reorder them. Use the remove button to remove a member from the group.
                  </AlertDescription>
                </Alert>

                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="members">
                    {(provided) => (
                      <ScrollArea className="h-[400px] w-full rounded-lg border-2 border-muted">
                        <ul
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          className="p-4 space-y-3"
                        >
                          {members.map((member, index) => (
                            <Draggable key={member.id} draggableId={member.id} index={index}>
                              {(dragProvided, snapshot) => (
                                <li
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={`group flex justify-between items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                                    snapshot.isDragging
                                      ? 'bg-accent border-primary shadow-lg'
                                      : 'bg-background border-muted hover:border-primary/50'
                                  }`}
                                >
                                  {/* DRAG HANDLE */}
                                  <div className="flex items-center gap-4">
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      className="p-2 hover:bg-muted rounded-md transition-colors cursor-grab active:cursor-grabbing"
                                    >
                                      <GripVertical className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <span className="text-lg font-medium">{member.firstName}</span>
                                    {member.isAdmin && (
                                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-50 border border-yellow-200">
                                        <Crown className="h-4 w-4 text-yellow-500" />
                                        <span className="text-sm text-yellow-700">Admin</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {!member.isAdmin && (
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleRemoveMember(member.id)}
                                        className="flex items-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                </li>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </ul>
                      </ScrollArea>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>

              <Separator className="my-8" />
            </>
          )}

          {/* 3) Admin Transfer Section */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium flex items-center gap-2">
              <Crown className="h-6 w-6 text-yellow-500" />
              <span>Transfer Admin Role</span>
            </h3>

            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-base font-medium">Select New Admin</label>
                <Select value={newAdminId} onValueChange={setNewAdminId}>
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Choose member to make admin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Members</SelectLabel>
                      {members
                        .filter((m) => !m.isAdmin)
                        .map((m) => (
                          <SelectItem key={m.id} value={m.id} className="text-base">
                            {m.firstName}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleTransferAdmin} size="lg" className="px-8">
                Transfer Role
              </Button>
            </div>

            <Alert>
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-base font-medium">Note</AlertTitle>
              <AlertDescription className="text-sm text-gray-600">
                Transferring the admin role will make you a regular member and give all admin
                privileges to the selected member.
              </AlertDescription>
            </Alert>
          </div>

          {/*
            4) "Retry Payments" button if:
               group.status === 'Paused'
               AND (group.pauseReason === 'PAYMENT_FAILURES' || group.pauseReason === 'REFUND_ALL')
          */}
          {group.status === 'Paused' &&
            (group.pauseReason === 'PAYMENT_FAILURES' || group.pauseReason === 'REFUND_ALL') && (
              <>
                <Separator className="my-8" />
                <div className="space-y-4">
                  <h3 className="text-xl font-medium flex items-center gap-2">
                    <AlertTriangle className="h-6 w-6 text-yellow-700" />
                    <span>Group Paused</span>
                  </h3>
                  <Alert className="bg-yellow-50 border border-yellow-300">
                    <AlertTriangle className="h-5 w-5 text-yellow-800" />
                    <AlertTitle className="text-base font-medium">Group is Paused</AlertTitle>
                    <AlertDescription className="text-sm text-yellow-800">
                      Payments have failed or have been refunded. The group is currently paused.
                      You can retry payments to attempt collection again.
                    </AlertDescription>
                  </Alert>

                  <Button
                    onClick={handleRetryPayments}
                    size="lg"
                    variant="default"
                    className="bg-yellow-500 hover:bg-yellow-600 text-white transition-colors"
                  >
                    {retryAllPaymentsMutation.isLoading ? 'Retrying...' : 'Retry Payments'}
                  </Button>
                </div>
              </>
            )}

          {/* 5) Delete Group Section (only if cycle not started) */}
          {!cycleStarted && (
            <>
              <Separator className="my-8" />

              <div className="space-y-4">
                <h3 className="text-xl font-medium flex items-center gap-2 text-red-600">
                  <Trash2 className="h-6 w-6" />
                  <span>Delete Group</span>
                </h3>

                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-5 w-5" />
                    <h4 className="font-medium">Warning</h4>
                  </div>
                  <p className="text-red-700">
                    Deleting the group will permanently remove all group data, including member information,
                    payment history, and messages. This action cannot be undone.
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="lg"
                      className="w-full bg-rose-500 hover:bg-rose-600 transition-colors"
                    >
                      <Trash2 className="h-5 w-5 mr-2" />
                      Delete Group
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-red-600">Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        <p className="mb-2 text-gray-700">
                          This will permanently delete the group &ldquo;{group.name}&rdquo; and remove all associated data.
                          This action cannot be undone.
                        </p>
                        <p className="font-medium text-gray-900">
                          All members will be notified of this deletion.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteGroup}
                        className="bg-rose-500 hover:bg-rose-600 transition-colors text-white"
                      >
                        Yes, Delete Group
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-sm text-gray-600 mt-2">
                  Note: Groups can only be deleted before the savings cycle has started.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupAdmin;
