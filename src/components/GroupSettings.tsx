import React, { useState } from 'react';
import { GroupWithStats, GroupMember } from '../types/groups';
import { useToast } from '@/src/components/ui/use-toast';
import { Input } from '@/src/components/ui/input';
import { Textarea } from './ui/text-area';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/src/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/src/components/ui/dialog';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { ScrollArea } from '@/src/components/ui/scroll-area';
import { Separator } from '@/src/components/ui/separator';
import { trpc } from '../app/_trpc/client';
import { 
  Trash2, 
  Edit, 
  UserMinus,
  Users, 
  LogOut, 
  GripVertical,
  Crown, 
  AlertTriangle 
} from 'lucide-react';

interface GroupSettingsProps {
  group: GroupWithStats;
  onLeaveGroup: () => void;  // Add this
  onGroupUpdate: () => void;

}


const GroupSettings: React.FC<GroupSettingsProps> = ({ group, onLeaveGroup, onGroupUpdate }) => {
  const { toast } = useToast();
  const utils = trpc.useContext();
  
  const isAdmin = group.isAdmin;
  const cycleStarted = group.cycleStarted;
  
  const [name, setName] = useState<string>(group.name || '');
  const [description, setDescription] = useState<string>(group.description || '');
  const [members, setMembers] = useState<GroupMember[]>(group.members);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [newAdminId, setNewAdminId] = useState<string>('');
  
  // TRPC Mutations
  const updateGroupMutation = trpc.group.updateGroupSettings.useMutation({
    onSuccess: () => {
      toast({
        title: 'Settings Saved',
        description: 'Your group settings have been updated successfully.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const transferAdminMutation = trpc.group.transferAdminRole.useMutation({
    onSuccess: () => {
      toast({
        title: 'Admin Role Transferred',
        description: 'The admin role has been successfully transferred.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
      setNewAdminId('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const removeMemberMutation = trpc.group.removeMember.useMutation({
    onSuccess: () => {
      toast({
        title: 'Member Removed',
        description: 'The member has been removed from the group.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const leaveGroupMutation = trpc.group.leaveGroup.useMutation({
    onSuccess: () => {
      toast({
        title: 'Left Group',
        description: 'You have successfully left the group.',
      });
      onLeaveGroup(); // Use the passed function instead of direct router usage
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });


  const updatePayoutOrderMutation = trpc.group.updatePayoutOrder.useMutation({
    onSuccess: () => {
      toast({
        title: 'Order Updated',
        description: 'Member order has been updated successfully.',
      });
      utils.group.getGroupById.invalidate({ groupId: group.id });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleSave = async () => {
    await updateGroupMutation.mutateAsync({
      groupId: group.id,
      name,
      description,
    });
  };

  const handleRemoveMember = async (memberId: string) => {
    await removeMemberMutation.mutateAsync({
      groupId: group.id,
      memberId,
    });
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

  const handleTransferAdmin = async () => {
    if (!newAdminId) {
      toast({
        title: 'Error',
        description: 'Please select a member to transfer admin role to.',
        variant: 'destructive',
      });
      return;
    }

    await transferAdminMutation.mutateAsync({
      groupId: group.id,
      newAdminId,
    });
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const reorderedMembers = Array.from(members);
    const [moved] = reorderedMembers.splice(result.source.index, 1);
    reorderedMembers.splice(result.destination.index, 0, moved);

    // Update local state immediately for better UX
    setMembers(reorderedMembers);

    // Prepare the new order for the backend
    const memberOrders = reorderedMembers.map((member, index) => ({
      memberId: member.id,
      newOrder: index + 1,
    }));

    // Update the backend
    await updatePayoutOrderMutation.mutateAsync({
      groupId: group.id,
      memberOrders,
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Edit className="h-8 w-8 text-primary" />
            Group Settings
          </CardTitle>
          <CardDescription className="text-lg">
            Manage your group preferences and members
          </CardDescription>
        </CardHeader>
  
        <CardContent className="space-y-8">
          {isAdmin && (
            <>
              {/* Basic Settings */}
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
  
              {/* Unified Member Management */}
              {!cycleStarted && (
                <div className="space-y-4">
                  <h3 className="text-xl font-medium flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    <span>Manage Members</span>
                  </h3>
  
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
                                {(provided, snapshot) => (
                                  <li
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`group flex justify-between items-center p-4 rounded-lg border-2 transition-all duration-200 ${
                                      snapshot.isDragging 
                                        ? 'bg-accent border-primary shadow-lg' 
                                        : 'bg-background border-muted hover:border-primary/50'
                                    }`}
                                  >
                                    <div className="flex items-center gap-4">
                                      <div 
                                        {...provided.dragHandleProps}
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
              )}
            </>
          )}
  
          {/* Admin Transfer Section */}
          {isAdmin && (
            <>
              <Separator className="my-8" />
              
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
                            .filter(member => !member.isAdmin)
                            .map(member => (
                              <SelectItem key={member.id} value={member.id} className="text-base">
                                {member.firstName}
                              </SelectItem>
                            ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                onClick={handleTransferAdmin}
                size="lg"
                className="px-8"
              >
                Transfer Role
              </Button>
                </div>
  
                <Alert>
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle className="text-base font-medium">
                    Note
                  </AlertTitle>
                  <AlertDescription className="text-sm text-gray-600">
                    Transferring the admin role will make you a regular member and give all admin privileges to the selected member.
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}
  
          <Separator className="my-8" />
          
          {/* Leave Group Section */}
          <div className="space-y-6">
            <h3 className="text-xl font-semibold flex items-center gap-2">
              <LogOut className="h-6 w-6 text-red-600" />
              <span className="text-red-600">Leave Group</span>
            </h3>
  
            {isAdmin && (
              <Alert className="border border-red-200 bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-lg font-semibold text-red-700">
                  Admin Action Required
                </AlertTitle>
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
                          {members
                            .filter(member => !member.isAdmin)
                            .map(member => (
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
                  <Button
                    variant="destructive"
                    onClick={handleLeaveGroup}
                    className="text-base px-8"
                  >
                    Leave Group
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GroupSettings;