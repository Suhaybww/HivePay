"use client";

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
import TermsOfService from "@/src/components/TermsOfService";

// 1) Only these frequencies
const frequencyOptions = ["Weekly", "BiWeekly", "Monthly"] as const;

// 2) Our zod schema for new group
const newGroupSchema = z.object({
  name: z.string().min(3, "Group name must be at least 3 characters"),
  description: z.string().optional(),
  contributionAmount: z
    .string()
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, {
      message: "Please enter a valid amount",
    }),
  cycleFrequency: z.enum(frequencyOptions),
  acceptedTOS: z
    .boolean()
    .refine((val) => val === true, {
      message: "You must accept the Terms and Conditions",
    }),
});
type NewGroupFormData = z.infer<typeof newGroupSchema>;

// For joining a group
const joinGroupSchema = z.object({
  groupId: z.string().min(1, "Please enter a group ID"),
  acceptedTOS: z
    .boolean()
    .refine((val) => val === true, {
      message: "You must accept the Terms and Conditions",
    }),
});
type JoinGroupFormData = z.infer<typeof joinGroupSchema>;

// For contract signing
const contractSigningSchema = z.object({
  fullName: z.string().min(3, "Please enter your full legal name"),
  hasRead: z.boolean().refine((val) => val === true, {
    message: "You must read the entire contract before signing",
  }),
  acceptContract: z.boolean().refine((val) => val === true, {
    message: "You must accept the contract to proceed",
  }),
});
type ContractSigningFormData = z.infer<typeof contractSigningSchema>;

// 3) Provide a narrower return type for createGroup mutation
interface CreateGroupOutput {
  success: boolean;
  requiresContract: boolean;
  group: {
    id: string;
    name: string;
    description?: string | null;
  };
}

const toastStyles = {
  className:
    "group fixed bottom-4 left-1/2 -translate-x-1/2 w-[360px] rounded-lg border bg-white text-foreground shadow-lg",
  style: { zIndex: 50 },
  duration: 3000,
};

interface GroupModalsProps {
  onGroupCreated?: () => void;
}

export const GroupModals = ({ onGroupCreated }: GroupModalsProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const utils = trpc.useContext();

  // local states
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [showOwnerContract, setShowOwnerContract] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [newGroupData, setNewGroupData] = useState<any>(null);

  // subscription info
  const { data: subscriptionStatus } =
    trpc.subscription.checkSubscriptionStatus.useQuery();

  // 4) createGroup mutation with explicit type => solves “excessively deep” error
  const createGroup = trpc.group.createGroup.useMutation<CreateGroupOutput>({
    onSuccess: (data) => {
      setNewGroupData(data);
      setShowOwnerContract(true);
      setCreateOpen(false);
    },
    onError: (error) => {
      toast({
        ...toastStyles,
        variant: "destructive",
        title: "Error",
        description:
          error.message || "Something went wrong. Please try again later.",
      });
    },
  });

  // sign contract as group owner
  const createAndSignContract =
    trpc.contract.createAndSignOwnerContract.useMutation({
      onSuccess: () => {
        toast({
          ...toastStyles,
          title: "Success",
          description: "Group created and contract signed successfully.",
        });
        setShowOwnerContract(false);

        // Invalidate cache, call callback
        utils.group.getAllGroups.invalidate();
        onGroupCreated?.();

        if (newGroupData?.group?.id) {
          router.push(`/groups/${newGroupData.group.id}`);
        }
      },
      onError: (error) => {
        toast({
          ...toastStyles,
          variant: "destructive",
          title: "Error",
          description:
            error.message || "Failed to sign contract. Please try again.",
        });
      },
    });

  // joinGroup mutation
  const joinGroup = trpc.group.joinGroup.useMutation({
    onSuccess: (data) => {
      if (
        data.membership.status === "Pending" &&
        !data.membership.acceptedTOSAt
      ) {
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
        onGroupCreated?.();
        router.push(`/groups/${data.membership.groupId}`);
      }
    },
    onError: () => {
      toast({
        ...toastStyles,
        variant: "destructive",
        title: "Error",
        description: "Please verify the group ID and try again.",
      });
    },
  });

  // sign contract as normal member
  const signContract = trpc.contract.signGroupContract.useMutation({
    onSuccess: () => {
      toast({
        ...toastStyles,
        title: "Success",
        description: "Contract signed successfully. Welcome to the group!",
      });
      setShowContract(false);
      utils.group.getAllGroups.invalidate();
      onGroupCreated?.();
      if (selectedGroupId) {
        router.push(`/groups/${selectedGroupId}`);
      }
    },
    onError: (error) => {
      toast({
        ...toastStyles,
        variant: "destructive",
        title: "Error",
        description:
          error.message || "Failed to sign contract. Please try again.",
      });
    },
  });

  // react-hook-form for "create group"
  const {
    register: registerNewGroup,
    control: newGroupControl,
    handleSubmit: handleNewGroupSubmit,
    formState: { errors: newGroupErrors },
    reset: resetNewGroupForm,
  } = useForm<NewGroupFormData>({
    resolver: zodResolver(newGroupSchema),
  });

  // react-hook-form for "join group"
  const {
    register: registerJoinGroup,
    control: joinGroupControl,
    handleSubmit: handleJoinGroupSubmit,
    formState: { errors: joinGroupErrors },
    reset: resetJoinGroupForm,
  } = useForm<JoinGroupFormData>({
    resolver: zodResolver(joinGroupSchema),
  });

  // react-hook-form for contract signing
  const {
    register: registerContract,
    control: contractControl,
    handleSubmit: handleContractSubmit,
    formState: { errors: contractErrors },
    reset: resetContractForm,
  } = useForm<ContractSigningFormData>({
    resolver: zodResolver(contractSigningSchema),
  });

  // user scrolled to bottom of contract text
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 5) {
      setHasScrolledToBottom(true);
    }
  };

  // open create group modal
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

  // open join group modal
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

  // handle createGroup submission
  const onCreateGroup = async (formData: NewGroupFormData) => {
    await createGroup.mutateAsync(formData);
  };

  // handle joinGroup submission
  const onJoinGroup = async (formData: JoinGroupFormData) => {
    await joinGroup.mutateAsync(formData);
    resetJoinGroupForm();
  };

  // handle contract signing (member)
  const onSignContract = async (formData: ContractSigningFormData) => {
    if (!selectedGroupId) return;
    await signContract.mutateAsync({
      groupId: selectedGroupId,
      fullName: formData.fullName,
    });
  };

  // handle contract signing (owner)
  const onSignOwnerContract = async (formData: ContractSigningFormData) => {
    if (!newGroupData?.group?.id) return;
    await createAndSignContract.mutateAsync({
      groupId: newGroupData.group.id,
      fullName: formData.fullName,
    });
  };

  return (
    <div className="flex gap-3">
      <Button
        className="bg-yellow-400 hover:bg-yellow-500 text-white"
        onClick={handleCreateClick}
      >
        <Plus className="w-4 h-4 mr-2" />
        New Group
      </Button>

      <Button
        variant="outline"
        className="border-yellow-400 text-yellow-500"
        onClick={handleJoinClick}
      >
        <Users className="w-4 h-4 mr-2" />
        Join Group
      </Button>

      {/* Create New Group Dialog */}
      {subscriptionStatus?.isSubscribed && (
        <DialogPrimitive.Root open={createOpen} onOpenChange={setCreateOpen}>
          <DialogPrimitive.Portal>
            {/* Blur background */}
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
            <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[425px]">
              <div className="flex justify-between items-center">
                <DialogHeader>
                  <DialogTitle>Create New ROSCA Group</DialogTitle>
                </DialogHeader>
                <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>

              <form
                onSubmit={handleNewGroupSubmit(onCreateGroup)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="name">Group Name</Label>
                  <Input
                    id="name"
                    {...registerNewGroup("name")}
                    className="mt-1"
                    placeholder="Enter group name"
                  />
                  {newGroupErrors.name && (
                    <p className="text-sm text-red-500 mt-1">
                      {newGroupErrors.name.message}
                    </p>
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
                    placeholder="Enter amount (e.g. 50.00)"
                  />
                  {newGroupErrors.contributionAmount && (
                    <p className="text-sm text-red-500 mt-1">
                      {newGroupErrors.contributionAmount.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="cycleFrequency">Cycle Frequency</Label>
                  <Controller
                    control={newGroupControl}
                    name="cycleFrequency"
                    defaultValue={undefined}
                    render={({ field }) => (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
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
                  {newGroupErrors.cycleFrequency && (
                    <p className="text-sm text-red-500 mt-1">
                      {newGroupErrors.cycleFrequency.message}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    * This single frequency applies to both <strong>contributions</strong> and{" "}
                    <strong>payouts</strong>.
                  </p>
                </div>

                <div>
                  <Label htmlFor="acceptedTOS" className="mt-4">
                    <div className="flex items-start gap-3">
                      <Controller
                        name="acceptedTOS"
                        control={newGroupControl}
                        defaultValue={false}
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true)
                            }
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
                    <p className="text-sm text-red-500 mt-1">
                      {newGroupErrors.acceptedTOS.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-white"
                >
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
            {/* Blur background */}
            <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
            <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[425px]">
              <div className="flex justify-between items-center">
                <DialogHeader>
                  <DialogTitle>Join a Savings Group</DialogTitle>
                </DialogHeader>
                <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>

              <form
                onSubmit={handleJoinGroupSubmit(onJoinGroup)}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="groupId">Group ID</Label>
                  <Input
                    id="groupId"
                    {...registerJoinGroup("groupId")}
                    className="mt-1"
                    placeholder="Enter the Group ID"
                  />
                  {joinGroupErrors.groupId && (
                    <p className="text-sm text-red-500 mt-1">
                      {joinGroupErrors.groupId.message}
                    </p>
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
                            onCheckedChange={(checked) =>
                              field.onChange(checked === true)
                            }
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
                    <p className="text-sm text-red-500 mt-1">
                      {joinGroupErrors.acceptedTOS.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-white"
                >
                  Join Group
                </Button>
              </form>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      )}

      {/* Owner Contract Signing Dialog */}
      <DialogPrimitive.Root
        open={showOwnerContract}
        onOpenChange={setShowOwnerContract}
      >
        <DialogPrimitive.Portal>
          {/* Blur background */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[800px] max-h-[90vh]">
            <div className="flex justify-between items-center">
              <DialogHeader>
                <DialogTitle>Group Owner Contract</DialogTitle>
              </DialogHeader>
              <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <form
              onSubmit={handleContractSubmit(onSignOwnerContract)}
              className="space-y-4"
            >
              <div
                className="h-[400px] overflow-y-auto border rounded-md p-4 prose prose-sm max-w-none"
                onScroll={handleScroll}
              >
                <h2 className="text-xl font-semibold">
                  HIVEPAY ROSCA Group Owner Contract
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  This is a legally binding agreement. Please read carefully.
                </p>
                {/* Full Contract Text for the Group Owner */}
                <h3 className="font-bold mt-4">1. Purpose</h3>
                <p>
                  The purpose of this Owner Contract is to outline the
                  responsibilities and obligations of the individual initiating
                  and administering a HIVEPAY ROSCA Group. By creating this group,
                  the owner acknowledges all duties described herein.
                </p>

                <h3 className="font-bold mt-4">2. Responsibilities of the Owner</h3>
                <ul className="list-disc ml-6">
                  <li>
                    Communicate all group rules, including contribution amounts,
                    payment schedules, and payout order, to all members.
                  </li>
                  <li>
                    Ensure timely creation of each cycle and transparently manage
                    all contributions made by group members.
                  </li>
                  <li>
                    Address any disputes arising within the group, in accordance
                    with the terms set forth by HIVEPAY and the group rules.
                  </li>
                </ul>

                <h3 className="font-bold mt-4">3. Liability and Disputes</h3>
                <p>
                  The owner is responsible for ensuring that all contributions
                  are handled in good faith, and acknowledges that disputes
                  may arise from delayed or missed contributions, or from other
                  group-related conflicts. In no event shall HIVEPAY be held
                  liable for actions taken by the owner or any group member.
                </p>

                <h3 className="font-bold mt-4">4. Owner Fees</h3>
                <p>
                  The group owner may choose to collect additional fees or
                  administrative costs from members as permitted by law, and only
                  if it was communicated clearly to the members in advance.
                </p>

                <h3 className="font-bold mt-4">5. Amendments</h3>
                <p>
                  Any changes to the contract must be communicated to all members
                  and agreed upon by majority vote. HIVEPAY reserves the right
                  to update the platform terms at any time.
                </p>

                <h3 className="font-bold mt-4">6. Term and Termination</h3>
                <p>
                  This contract remains in effect for the duration of the ROSCA
                  Group cycles. Early termination must be agreed upon by all
                  active members, and any outstanding contributions or payouts
                  must be settled.
                </p>

                <h3 className="font-bold mt-4">7. Legal Binding</h3>
                <p>
                  By signing this contract, the owner agrees that this digital
                  signature constitutes a legally binding agreement, fully
                  enforceable in accordance with Australian law.
                </p>
              </div>

              <div>
                <Label htmlFor="fullName">Full Legal Name</Label>
                <Input
                  id="fullName"
                  {...registerContract("fullName")}
                  className="mt-1"
                  placeholder="Enter your full legal name"
                />
                {contractErrors.fullName && (
                  <p className="text-sm text-red-500 mt-1">
                    {contractErrors.fullName.message}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3">
                <Controller
                  name="hasRead"
                  control={contractControl}
                  defaultValue={false}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      disabled={!hasScrolledToBottom}
                    />
                  )}
                />
                <Label className="text-sm leading-relaxed">
                  I have read and understood the entire contract
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Controller
                  name="acceptContract"
                  control={contractControl}
                  defaultValue={false}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
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
                disabled={!hasScrolledToBottom || createAndSignContract.isLoading}
              >
                {createAndSignContract.isLoading
                  ? "Signing Contract..."
                  : "Sign Contract"}
              </Button>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Regular Member Contract Signing Dialog */}
      <DialogPrimitive.Root open={showContract} onOpenChange={setShowContract}>
        <DialogPrimitive.Portal>
          {/* Blur background */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[800px] max-h-[90vh]">
            <div className="flex justify-between items-center">
              <DialogHeader>
                <DialogTitle>Group Membership Contract</DialogTitle>
              </DialogHeader>
              <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <form
              onSubmit={handleContractSubmit(onSignContract)}
              className="space-y-4"
            >
              <div
                className="h-[400px] overflow-y-auto border rounded-md p-4 prose prose-sm max-w-none"
                onScroll={handleScroll}
              >
                <h2 className="text-xl font-semibold">
                  HIVEPAY ROSCA Group Member Contract
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  This is a legally binding agreement. Please read carefully.
                </p>
                {/* Full Contract Text for the Group Member */}
                <h3 className="font-bold mt-4">1. Purpose</h3>
                <p>
                  The purpose of this Member Contract is to outline the
                  responsibilities and obligations of any individual joining a
                  HIVEPAY ROSCA Group. By joining, you acknowledge that you agree
                  to fulfill all duties described below.
                </p>

                <h3 className="font-bold mt-4">2. Member Obligations</h3>
                <ul className="list-disc ml-6">
                  <li>
                    Adhere to the agreed contribution schedule and make timely
                    payments.
                  </li>
                  <li>
                    Respect the payout order set by the group or decided upon by
                    group consensus.
                  </li>
                  <li>
                    Abide by all group rules, as communicated by the group owner
                    or majority vote of the group.
                  </li>
                </ul>

                <h3 className="font-bold mt-4">3. Contributions and Payouts</h3>
                <p>
                  Every member is required to contribute the agreed amount on the
                  specified schedule. Failure to contribute on time could result
                  in penalties or forfeiture of group benefits, as determined by
                  group rules.
                </p>

                <h3 className="font-bold mt-4">4. Disputes</h3>
                <p>
                  In the event of any dispute regarding contributions or payouts,
                  members agree to first seek resolution within the group. If a
                  dispute remains unresolved, HIVEPAY may provide limited guidance
                  but is not responsible for enforcing agreements between members.
                </p>

                <h3 className="font-bold mt-4">5. Liability</h3>
                <p>
                  HIVEPAY is solely a facilitator and does not assume liability
                  for any default or misconduct by group members. Members accept
                  the risk of joining a collective financial arrangement.
                </p>

                <h3 className="font-bold mt-4">6. Termination and Withdrawal</h3>
                <p>
                  A member may only withdraw from the group if the group rules
                  allow it and if all outstanding contributions have been made.
                  Early withdrawal may result in forfeited payouts or other
                  penalties.
                </p>

                <h3 className="font-bold mt-4">7. Legal Binding</h3>
                <p>
                  By signing this contract, the member agrees that this digital
                  signature constitutes a legally binding agreement, fully
                  enforceable in accordance with Australian law.
                </p>
              </div>

              <div>
                <Label htmlFor="fullName">Full Legal Name</Label>
                <Input
                  id="fullName"
                  {...registerContract("fullName")}
                  className="mt-1"
                  placeholder="Enter your full legal name"
                />
                {contractErrors.fullName && (
                  <p className="text-sm text-red-500 mt-1">
                    {contractErrors.fullName.message}
                  </p>
                )}
              </div>

              <div className="flex items-start gap-3">
                <Controller
                  name="hasRead"
                  control={contractControl}
                  defaultValue={false}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                      disabled={!hasScrolledToBottom}
                    />
                  )}
                />
                <Label className="text-sm leading-relaxed">
                  I have read and understood the entire contract
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Controller
                  name="acceptContract"
                  control={contractControl}
                  defaultValue={false}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
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

      {/* Terms Of Service Modal */}
      <DialogPrimitive.Root open={showTerms} onOpenChange={setShowTerms}>
        <DialogPrimitive.Portal>
          {/* Blur background */}
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 backdrop-blur-sm" />
          <DialogPrimitive.Content className="fixed z-50 flex flex-col gap-4 p-6 bg-white rounded-lg shadow-lg top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full sm:max-w-[800px] max-h-[90vh]">
            <div className="flex justify-between items-center">
              <DialogHeader>
                <DialogTitle>Terms and Conditions</DialogTitle>
              </DialogHeader>
              <DialogPrimitive.Close className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            {/* TOS content */}
            <div className="h-[400px] overflow-y-auto border rounded-md p-4 prose prose-sm max-w-none">
              <TermsOfService />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
};
