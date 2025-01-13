import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from "@/src/components/ui/dialog";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { useToast } from "@/src/components/ui/use-toast";
import { Badge } from "@/src/components/ui/badge";
import { trpc } from "@/src/app/_trpc/client";
import { 
  UserPlus, 
  Mail, 
  Loader2, 
  AlertTriangle,
} from "lucide-react";

interface PendingInvitation {
  id: string;
  email: string;
  status: string;
  createdAt: string; 
  groupId: string;
  expiresAt: string;
  invitedById: string;
  invitedBy: {
    email: string;
    firstName: string;
    lastName: string;
  };
}

export function AdminInviteSection({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useContext();

  // Fetch pending invitations
  const { data: pendingInvitations, isLoading: isInvitationsLoading } = trpc.invitation.getGroupInvitations.useQuery(
    { groupId },
    {
      refetchInterval: 30000, // Refetch every 30 seconds
    }
  );

  const { mutate: sendInvitation } = trpc.invitation.sendInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: "Invitation sent",
        description: "The member has been invited to join the group.",
      });
      setEmail("");
      setOpen(false);
      utils.invitation.getGroupInvitations.invalidate({ groupId });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to send invitation",
      });
    },
    onSettled: () => {
      setIsLoading(false);
    },
  });

  const { mutate: cancelInvitation } = trpc.invitation.cancelInvitation.useMutation({
    onSuccess: () => {
      toast({
        title: "Invitation cancelled",
        description: "The invitation has been cancelled.",
      });
      utils.invitation.getGroupInvitations.invalidate({ groupId });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to cancel invitation",
      });
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    sendInvitation({ email, groupId });
  };

  const handleCancelInvitation = (invitationId: string) => {
    cancelInvitation({ invitationId });
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-yellow-500" />
            Invite Members
          </CardTitle>
          <Button
            onClick={() => setOpen(true)}
            variant="outline"
            className="gap-2 text-yellow-600 border-yellow-200 hover:bg-yellow-50"
          >
            <UserPlus className="h-4 w-4" />
            New Invite
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isInvitationsLoading ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
          </div>
        ) : pendingInvitations?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <UserPlus className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p>No pending invitations</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingInvitations?.map((invitation: PendingInvitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card/50"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full p-2 bg-yellow-50">
                    <Mail className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium">{invitation.email}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited on {new Date(invitation.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1.5"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Pending
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(invitation.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex gap-2 items-center">
                <UserPlus className="h-5 w-5 text-yellow-500" />
                Invite New Member
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleInvite} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter member's email"
                  required
                  className="w-full"
                  disabled={isLoading}
                />
              </div>

              <Alert className="bg-yellow-50 border-yellow-100 text-yellow-800">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-sm">
                  The invited member must have an active subscription to join the group.
                </AlertDescription>
              </Alert>

              <DialogFooter className="gap-3 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="gap-2 bg-yellow-500 hover:bg-yellow-600"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
