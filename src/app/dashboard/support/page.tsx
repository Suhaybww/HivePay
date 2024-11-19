"use client"

import React, { useState } from "react";
import Link from "next/link";
import { useToast } from "@/src/components/ui/use-toast";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/text-area";
import { Button } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/src/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";
import { Badge } from "@/src/components/ui/badge";
import {
  FileQuestion,
  BookOpen,
  ExternalLink,
  Mail,
  ArrowRight,
  Clock,
  MessageCircle,
  Shield,
  User,
  Search,
  Filter,
  Loader2,
} from "lucide-react";
import { trpc } from "../../_trpc/client";
import { format } from "date-fns";
import { TicketStatus, TicketPriority } from "@prisma/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";

interface TicketData {
  subject: string;
  message: string;
}

interface Response {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  ticketId: string;
  userId: string | null;
  isStaff: boolean;
  staffEmail: string | null;
  user?: {
    firstName: string;
    lastName: string;
  };
}

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  priority: TicketPriority;
  userId: string;
  createdAt: string;
  updatedAt: string;
  responses: Response[];
}

interface UserTicketsData {
  tickets: Ticket[];
  nextCursor?: string;
}

const statusColors: Record<TicketStatus, string> = {
  Open: "bg-green-100 text-green-800",
  InProgress: "bg-blue-100 text-blue-800",
  Resolved: "bg-gray-100 text-gray-800",
  Closed: "bg-red-100 text-red-800",
};

const priorityColors: Record<TicketPriority, string> = {
  Low: "bg-gray-100 text-gray-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-orange-100 text-orange-800",
  Urgent: "bg-red-100 text-red-800",
};

export default function SupportPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [responseInputs, setResponseInputs] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [formData, setFormData] = useState<TicketData>({
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({
    subject: "",
    message: "",
  });

  // TRPC Queries
  const {
    data: userTickets,
    isLoading: isLoadingTickets,
    refetch: refetchUserTickets,
  } = trpc.support.getUserTickets.useQuery(
    {
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 10,
    },
    {
      select: (data) => data as UserTicketsData,
    }
  );

  // Get ticket responses
  const {
    data: ticketResponses,
    fetchNextPage: fetchMoreResponses,
    hasNextPage: hasMoreResponses,
    isLoading: isLoadingResponses,
  } = trpc.support.getTicketResponses.useInfiniteQuery(
    {
      ticketId: selectedTicketId!,
      limit: 20,
    },
    {
      enabled: Boolean(selectedTicketId),
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  // Get ticket stats
  const { data: ticketStats } = trpc.support.getTicketStats.useQuery();

  // Search tickets
  const { data: searchResults, isLoading: isSearching } = trpc.support.searchTickets.useQuery(
    {
      query: searchQuery,
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 10,
    },
    {
      enabled: searchQuery.length > 0,
    }
  );

  // Mutations
  const createTicket = trpc.support.createTicket.useMutation({
    onSuccess: () => {
      toast({
        title: "Ticket Submitted",
        description: "We'll get back to you within 24 hours.",
      });
      setFormData({ subject: "", message: "" });
      setIsSubmitting(false);
      refetchUserTickets();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to submit ticket. Please try again.",
      });
      setIsSubmitting(false);
    },
  });

  const updateStatus = trpc.support.updateTicketStatus.useMutation({
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Ticket status has been updated successfully.",
      });
      refetchUserTickets();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update status. Please try again.",
      });
    },
  });

  const addResponse = trpc.support.addResponse.useMutation({
    onSuccess: () => {
      toast({
        title: "Response Added",
        description: "Your response has been submitted successfully.",
      });
      setResponseInputs({});
      refetchUserTickets();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add response. Please try again.",
      });
    },
  });

  // Handlers
  const handleStatusUpdate = async (ticketId: string, status: TicketStatus) => {
    updateStatus.mutate({ ticketId, status });
  };

  const handleResponse = async (ticketId: string) => {
    const message = responseInputs[ticketId];
    if (!message?.trim()) return;

    addResponse.mutate({
      ticketId,
      message,
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
    if (errors[id as keyof typeof errors]) {
      setErrors((prev) => ({ ...prev, [id]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {
      subject: formData.subject.trim() === "" ? "Subject is required" : "",
      message: formData.message.trim() === "" ? "Message is required" : "",
    };
    setErrors(newErrors);
    return Object.values(newErrors).every((error) => error === "");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    createTicket.mutate({
      subject: formData.subject,
      message: formData.message,
    });
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const displayedTickets = searchQuery ? searchResults?.tickets : userTickets?.tickets;


return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Support Center</h1>
        <p className="text-muted-foreground mt-1">
          Get help with your HivePay account and savings circles
        </p>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="tickets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="tickets">My Tickets</TabsTrigger>
          <TabsTrigger value="new">New Ticket</TabsTrigger>
        </TabsList>

        {/* Resources Tab */}
        <TabsContent value="resources">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-yellow-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="h-5 w-5 text-yellow-600" />
                  Frequently Asked Questions
                </CardTitle>
                <CardDescription>
                  Find quick answers to common questions
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Browse our comprehensive FAQ section for instant answers to
                  your questions about savings circles, contributions, and more.
                </p>
              </CardContent>
              <CardFooter>
                <Link href="/company/faqs" className="w-full">
                  <Button variant="secondary" className="w-full group">
                    View FAQs
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-50/50 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-yellow-600" />
                  Documentation
                </CardTitle>
                <CardDescription>
                  Detailed guides and tutorials
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Access our comprehensive documentation to learn about all
                  features and get the most out of your HivePay experience.
                </p>
              </CardContent>
              <CardFooter>
                <Button
                  variant="secondary"
                  className="w-full group"
                  onClick={() =>
                    window.open("https://docs.hivepay.com", "_blank")
                  }
                >
                  View Documentation
                  <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        {/* Tickets Tab */}
        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Support Tickets</CardTitle>
                  <CardDescription>Track your support requests</CardDescription>
                </div>
                {ticketStats && (
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-yellow-50">
                      {ticketStats.open} Open
                    </Badge>
                    <Badge variant="outline" className="bg-blue-50">
                      {ticketStats.inProgress} In Progress
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as TicketStatus | "all")}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="InProgress">In Progress</SelectItem>
                    <SelectItem value="Resolved">Resolved</SelectItem>
                    <SelectItem value="Closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tickets List */}
              <div className="space-y-4">
                {isLoadingTickets ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-32 bg-gray-100 animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : !displayedTickets?.length ? (
                  <div className="text-center py-12">
                    <FileQuestion className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-4 text-lg font-semibold">No tickets found</h3>
                    <p className="text-gray-500 mt-2">
                      {searchQuery
                        ? "Try adjusting your search terms"
                        : "Create a new ticket to get help"}
                    </p>
                  </div>
                ) : (
                  displayedTickets.map((ticket: Ticket) => (
                    <div
                      key={ticket.id}
                      className="border rounded-lg overflow-hidden hover:border-yellow-200 transition-colors"
                    >
                      {/* Ticket Header */}
                      <div className="bg-gray-50 border-b p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="font-medium">
                              #{ticket.id.slice(0, 8)}
                            </span>
                            <h3 className="font-medium">{ticket.subject}</h3>
                            <div className="flex gap-2">
                              <Badge
                                variant="secondary"
                                className={cn(statusColors[ticket.status])}
                              >
                                {ticket.status}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className={cn(priorityColors[ticket.priority])}
                              >
                                {ticket.priority}
                              </Badge>
                            </div>
                          </div>
                          <time className="text-sm text-gray-500">
                            {format(new Date(ticket.createdAt), "PPp")}
                          </time>
                        </div>
                      </div>

                      {/* Ticket Content */}
                      <div className="p-4">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {ticket.message}
                        </p>

                        {/* Responses */}
                        {ticket.responses.length > 0 && (
                          <div className="mt-6 space-y-4">
                            {ticket.responses.map((response) => (
                              <div
                                key={response.id}
                                className={cn(
                                  "p-4 rounded-lg",
                                  response.isStaff
                                    ? "bg-yellow-50 ml-8 border border-yellow-100"
                                    : "bg-gray-50 mr-8"
                                )}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  {response.isStaff ? (
                                    <Shield className="h-4 w-4 text-yellow-600" />
                                  ) : (
                                    <User className="h-4 w-4 text-gray-600" />
                                  )}
                                  <span className="font-medium">
                                    {response.isStaff
                                      ? "Support Team"
                                      : response.user
                                      ? `${response.user.firstName} ${response.user.lastName}`
                                      : "User"}
                                  </span>
                                  <span className="text-sm text-gray-500">
                                    {format(new Date(response.createdAt), "PPp")}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {response.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Response Input */}
                        {ticket.status !== "Closed" && (
                          <div className="mt-6">
                            <div className="space-y-4">
                              <Textarea
                                placeholder="Add a response..."
                                value={responseInputs[ticket.id] || ""}
                                onChange={(e) =>
                                  setResponseInputs((prev) => ({
                                    ...prev,
                                    [ticket.id]: e.target.value,
                                  }))
                                }
                                className="min-h-[100px]"
                              />
                              <div className="flex justify-end gap-2">
                                {ticket.status !== "Resolved" && (
                                  <Button
                                    variant="outline"
                                    onClick={() =>
                                      handleStatusUpdate(ticket.id, "Resolved")
                                    }
                                  >
                                    Mark as Resolved
                                  </Button>
                                )}
                                <Button
                                  className="bg-yellow-400 hover:bg-yellow-500"
                                  onClick={() => handleResponse(ticket.id)}
                                  disabled={!responseInputs[ticket.id]?.trim()}
                                >
                                  <MessageCircle className="h-4 w-4 mr-2" />
                                  Send Response
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ticket Footer */}
                      <div className="bg-gray-50 border-t p-4">
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            Last updated:{" "}
                            {format(new Date(ticket.updatedAt), "PPp")}
                          </div>
                          {ticket.status !== "Closed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleStatusUpdate(ticket.id, "Closed")
                              }
                            >
                              Close Ticket
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Ticket Tab */}
        <TabsContent value="new">
          <Card>
            <CardHeader>
              <CardTitle>Submit a Support Ticket</CardTitle>
              <CardDescription>
                Need help? Submit a ticket and our team will assist you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="subject" className="text-sm font-medium">
                    Subject
                  </label>
                  <Input
                    id="subject"
                    placeholder="Brief summary of your issue"
                    value={formData.subject}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className={cn(
                      errors.subject && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {errors.subject && (
                    <p className="text-sm text-red-500">{errors.subject}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="message" className="text-sm font-medium">
                    Message
                  </label>
                  <Textarea
                    id="message"
                    placeholder="Describe your issue in detail"
                    value={formData.message}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className={cn(
                      "min-h-[200px] resize-none",
                      errors.message && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {errors.message && (
                    <p className="text-sm text-red-500">{errors.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-yellow-400 hover:bg-yellow-500"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </div>
                  ) : (
                    "Submit Ticket"
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="bg-muted/50">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <p>
                  For urgent inquiries, email us at{" "}
                  <a
                    href="mailto:hivepay.team@gmail.com"
                    className="text-yellow-600 hover:text-yellow-700 hover:underline"
                  >
                    hivepay.team@gmail.com
                  </a>
                </p>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}