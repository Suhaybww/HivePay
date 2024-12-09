'use client';

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogHeader, DialogTitle } from "@/src/components/ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { useToast } from "./ui/use-toast";
import { trpc } from "../app/_trpc/client";
import TermsOfService from '@/src/components/TermsOfService';

const frequencyOptions = ["Daily", "Weekly", "BiWeekly", "Monthly", "Custom"] as const;
const payoutOrderOptions = ["Admin_Selected", "First_Come_First_Serve"] as const;

const newGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().optional(),
  contributionAmount: z.string().refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Please enter a valid amount",
  }),
  contributionFrequency: z.enum(frequencyOptions),
  payoutFrequency: z.enum(frequencyOptions),
  payoutOrderMethod: z.enum(payoutOrderOptions),
  acceptedTOS: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions to proceed.",
  }),
});

const joinGroupSchema = z.object({
  groupId: z.string().min(1, "Please enter a group ID"),
  acceptedTOS: z.boolean().refine((val) => val === true, {
    message: "You must accept the Terms and Conditions to proceed.",
  }),
});

const contractSigningSchema = z.object({
  fullName: z.string().min(3, "Please enter your full legal name"),
  hasRead: z.boolean().refine((val) => val === true, {
    message: "You must read the entire contract before signing",
  }),
  acceptContract: z.boolean().refine((val) => val === true, {
    message: "You must accept the contract to proceed",
  }),
});

type NewGroupFormData = z.infer<typeof newGroupSchema>;
type JoinGroupFormData = z.infer<typeof joinGroupSchema>;
type ContractSigningFormData = z.infer<typeof contractSigningSchema>;


const toastStyles = {
  className:
    "group fixed bottom-4 left-1/2 -translate-x-1/2 w-[360px] rounded-lg border bg-white text-foreground shadow-lg",
  style: { zIndex: 50 },
  duration: 3000,
};

export const GroupModals = () => {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const { toast } = useToast();
  const utils = trpc.useContext();
  const [showContract, setShowContract] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const { data: subscriptionStatus } = trpc.subscription.checkSubscriptionStatus.useQuery();

  const createGroup = trpc.group.createGroup.useMutation({
    onSuccess: (data) => {
      toast({
        ...toastStyles,
        title: "Success",
        description: "Your savings group has been created successfully.",
      });
      setCreateOpen(false);
      utils.group.getAllGroups.invalidate();
      router.push(`/groups/${data.group.id}`);
    },
    onError: (error) => {
      toast({
        ...toastStyles,
        variant: "destructive",
        title: "Error",
        description: error.message || "Something went wrong. Please try again later.",
      });
    },
  });

  const joinGroup = trpc.group.joinGroup.useMutation({
    onSuccess: (data) => {
      if (data.requiresContract) {
        setSelectedGroupId(data.membership.groupId);
        setShowContract(true);
      } else {
        toast({
          ...toastStyles,
          title: "Success",
          description: "Welcome to the group.",
        });
        setJoinOpen(false);
        utils.group.getAllGroups.invalidate();
        router.push(`/groups/${data.membership.groupId}`);
      }
    },
    onError: (error) => {
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
    control,
    handleSubmit: handleNewGroupSubmit,
    formState: { errors: newGroupErrors },
    reset: resetNewGroupForm,
  } = useForm<NewGroupFormData>({
    resolver: zodResolver(newGroupSchema),
  });

  const {
    register: registerJoinGroup,
    control: joinGroupControl, // Add this line to get the joinGroupControl
    handleSubmit: handleJoinGroupSubmit,
    formState: { errors: joinGroupErrors },
    reset: resetJoinGroupForm,
  } = useForm<JoinGroupFormData>({
    resolver: zodResolver(joinGroupSchema),
  });

  const signContract = trpc.contract.signGroupContract.useMutation({
    onSuccess: () => {
      toast({
        ...toastStyles,
        title: "Success",
        description: "Contract signed successfully. Welcome to the group!",
      });
      setShowContract(false);
      utils.group.getAllGroups.invalidate();
      if (selectedGroupId) {
        router.push(`/groups/${selectedGroupId}`);
      }
    },
    onError: (error) => {
      toast({
        ...toastStyles,
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to sign contract. Please try again.",
      });
    },
  });

  const {
    register: registerContract,
    control: contractControl,
    handleSubmit: handleContractSubmit,
    formState: { errors: contractErrors },
  } = useForm<ContractSigningFormData>({
    resolver: zodResolver(contractSigningSchema),
  });
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 5) {
      setHasScrolledToBottom(true);
    }
  };
  
  const onSignContract = async (data: ContractSigningFormData) => {
    if (!selectedGroupId) return;
    
    await signContract.mutateAsync({
      groupId: selectedGroupId,
      fullName: data.fullName,
    });
  };

  const handleCreateClick = () => {
    if (!subscriptionStatus?.isSubscribed) {
      toast({
        ...toastStyles,
        title: "Subscription Required",
        description: (
          <span>
            You need an active subscription to create groups.{" "}
            <Link href="/pricing" className="text-yellow-400 hover:text-yellow-500">
              View Plans →
            </Link>
          </span>
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
          <span>
            You need an active subscription to join groups.{" "}
            <Link href="/pricing" className="text-yellow-400 hover:text-yellow-500">
              View Plans →
            </Link>
          </span>
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
        <DialogPrimitive.Root open={createOpen} onOpenChange={setCreateOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
            <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[425px]">
              <div className="flex justify-between items-center">
                <DialogHeader>
                  <DialogTitle>Create New Savings Group</DialogTitle>
                </DialogHeader>
                <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
              <form onSubmit={handleNewGroupSubmit(onCreateGroup)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    {...registerNewGroup("name")}
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
                    {...registerNewGroup("description")}
                    className="mt-1"
                    placeholder="Enter group description (optional)"
                  />
                </div>
                <div>
                  <Label htmlFor="contributionAmount">Contribution Amount</Label>
                  <Input
                    id="contributionAmount"
                    {...registerNewGroup("contributionAmount")}
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
                <div>
                  <Label htmlFor="acceptedTOS" className="mt-4">
                    <div className="flex items-start gap-3">
                      <Controller
                        name="acceptedTOS"
                        control={control}
                        defaultValue={false}
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => field.onChange(checked === true)}
                          />
                        )}
                      />
                      <span className="text-sm leading-relaxed">
                        I agree to the{" "}
                        <button
                          type="button"
                          onClick={() => setShowTerms(true)}
                          className="text-yellow-400 hover:underline"
                        >
                          Terms and Conditions
                        </button>
                      </span>
                    </div>
                  </Label>
                  {newGroupErrors.acceptedTOS && (
                    <p className="text-sm text-red-500 mt-1">{newGroupErrors.acceptedTOS.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-white">
                  Create Group
                </Button>
              </form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      {/* Join Group Dialog */}
    {subscriptionStatus?.isSubscribed && (
      <DialogPrimitive.Root open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[425px]">
            <div className="flex justify-between items-center">
              <DialogHeader>
                <DialogTitle>Join a Savings Group</DialogTitle>
              </DialogHeader>
              <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>
            <form onSubmit={handleJoinGroupSubmit(onJoinGroup)} className="space-y-4">
              <div>
                <Label htmlFor="groupId">Group ID</Label>
                <Input
                  id="groupId"
                  {...registerJoinGroup("groupId")}
                  className="mt-1"
                  placeholder="Enter the Group ID"
                />
                {joinGroupErrors.groupId && (
                  <p className="text-sm text-red-500 mt-1">{joinGroupErrors.groupId.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="acceptedTOS" className="mt-4">
                  <div className="flex items-start gap-3">
                    <Controller
                      name="acceptedTOS"
                      control={joinGroupControl}
                      defaultValue={false}
                      render={({ field }) => (
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      )}
                    />
                    <span className="text-sm leading-relaxed">
                      I agree to the{" "}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-yellow-400 hover:underline"
                      >
                        Terms and Conditions
                      </button>
                    </span>
                  </div>
                </Label>
                {joinGroupErrors.acceptedTOS && (
                  <p className="text-sm text-red-500 mt-1">{joinGroupErrors.acceptedTOS.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full bg-yellow-400 hover:bg-yellow-500 text-white">
                Join Group
              </Button>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    )}

    {/* Contract Signing Dialog */}
    <DialogPrimitive.Root open={showContract} onOpenChange={setShowContract}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[800px] max-h-[90vh]">
          <div className="flex justify-between items-center">
            <DialogHeader>
              <DialogTitle>Group Membership Contract</DialogTitle>
            </DialogHeader>
            <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <form onSubmit={handleContractSubmit(onSignContract)} className="space-y-4">
            {/* Contract Content */}
            <div 
              className="h-[400px] overflow-y-auto border rounded-md p-4 prose prose-sm max-w-none"
              onScroll={handleScroll}
            >
              <h2 className="text-xl font-semibold">HIVEPAY ROSCA Group Contract</h2>
              <p className="text-sm text-gray-600 mb-4">
                This is a legally binding agreement. Please read carefully before signing.
              </p>

              <div className="space-y-4">
                <section>
                  <h3 className="text-lg font-medium">1. Financial Obligations</h3>
                  <p>Members agree to make all required contributions on time according to the group schedule.</p>
                </section>

                <section>
                  <h3 className="text-lg font-medium">2. Payout Terms</h3>
                  <p>Members who receive their payout must continue making contributions until the cycle ends.</p>
                </section>

                <section>
                  <h3 className="text-lg font-medium">3. Default Consequences</h3>
                  <p>Failure to meet obligations may result in legal action and collection proceedings.</p>
                </section>

                <section>
                  <h3 className="text-lg font-medium">4. Dispute Resolution</h3>
                  <p>Any disputes will be resolved through mediation or legal proceedings as necessary.</p>
                </section>

                <section>
                  <h3 className="text-lg font-medium">5. Member Responsibilities</h3>
                  <p>All members must maintain active participation and communicate any issues promptly.</p>
                </section>

                <section>
                  <h3 className="text-lg font-medium">6. Electronic Signature</h3>
                  <p>By signing below, you acknowledge this is a legally binding contract equivalent to a physical signature.</p>
                </section>
              </div>
            </div>

            {/* Full Name Input */}
            <div>
              <Label htmlFor="fullName">Full Legal Name</Label>
              <Input
                id="fullName"
                {...registerContract("fullName")}
                className="mt-1"
                placeholder="Enter your full legal name"
              />
              {contractErrors.fullName && (
                <p className="text-sm text-red-500 mt-1">{contractErrors.fullName.message}</p>
              )}
            </div>

            {/* Read Confirmation */}
            <div className="flex items-start gap-3">
              <Controller
                name="hasRead"
                control={contractControl}
                defaultValue={false}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={!hasScrolledToBottom}
                  />
                )}
              />
              <Label className="text-sm leading-relaxed">
                I have read and understood the entire contract
                {!hasScrolledToBottom && (
                  <span className="text-yellow-500 ml-2">(Please scroll to the bottom)</span>
                )}
              </Label>
            </div>

            {/* Accept Contract */}
            <div className="flex items-start gap-3">
              <Controller
                name="acceptContract"
                control={contractControl}
                defaultValue={false}
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={!hasScrolledToBottom}
                  />
                )}
              />
              <Label className="text-sm leading-relaxed">
                I accept this contract and understand it is legally binding
              </Label>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-yellow-400 hover:bg-yellow-500 text-white"
              disabled={!hasScrolledToBottom || signContract.isLoading}
            >
              {signContract.isLoading ? "Signing Contract..." : "Sign Contract"}
            </Button>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>

    {/* Terms Modal */}
    <DialogPrimitive.Root open={showTerms} onOpenChange={setShowTerms}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed z-50 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center">
            <DialogHeader>
              <DialogTitle>Terms and Conditions</DialogTitle>
            </DialogHeader>
            <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          <div className="max-h-[500px] overflow-y-auto">
            <TermsOfService />
          </div>
          <Button onClick={() => setShowTerms(false)} className="w-full bg-gray-200 hover:bg-gray-300 mt-4">
            Close
          </Button>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  </div>
);
};

