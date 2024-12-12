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
import { Badge } from "@/src/components/ui/badge";
import {
  FileQuestion,
  BookOpen,
  ExternalLink,
  Mail,
  ArrowRight,
  Clock,
} from "lucide-react";
import { trpc } from "../../_trpc/client";
import { format } from "date-fns";
import { TicketStatus, TicketPriority } from "@prisma/client";

interface TicketData {
  subject: string;
  message: string;
}

interface Response {
  id: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  ticketId: string;
  staffEmail: string | null;
  isStaff: boolean;
  user: {
    firstName: string;
    lastName: string;
  } | null;
}

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: TicketStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
  priority: TicketPriority;
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
export default function SupportPage() {
  const { toast } = useToast();
  const [activeSection, setActiveSection] = useState('resources');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TicketData>({
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({
    subject: "",
    message: "",
  });

  // Get initial tickets
  const {
    data: userTickets,
    isLoading: isLoadingTickets,
    refetch: refetchUserTickets,
  } = trpc.support.getUserTickets.useQuery(
    {
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

  // Handlers
  const handleStatusUpdate = async (ticketId: string, status: TicketStatus) => {
    updateStatus.mutate({ ticketId, status });
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

return (
  <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
    {/* Header Section */}
    <div className="space-y-2">
      <h1 className="text-3xl font-bold tracking-tight">Support Center</h1>
      <p className="text-muted-foreground">
        Get help with your HivePay account and groups
      </p>
    </div>

    {/* Segmented Navigation */}
    <div className="border-b mb-8">
      <div className="flex flex-wrap -mb-px">
        <button
          onClick={() => setActiveSection('resources')}
          className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
            ${activeSection === 'resources' 
              ? 'border-yellow-400 text-black' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
          Resources
        </button>
        <button
          onClick={() => setActiveSection('tickets')}
          className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
            ${activeSection === 'tickets' 
              ? 'border-yellow-400 text-black' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
          My Tickets
        </button>
        <button
          onClick={() => setActiveSection('new')}
          className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
            ${activeSection === 'new' 
              ? 'border-yellow-400 text-black' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
          New Ticket
        </button>
      </div>
    </div>
 {/* Content Area */}
 <div className="space-y-6">
      {/* Resources Section */}
      {activeSection === 'resources' && (
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
                your questions about savings groups, contributions, and more.
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
                onClick={() => window.open("https://docs.hivepay.com", "_blank")}
              >
                View Documentation
                <ExternalLink className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

     {/* Tickets Section */}
     {activeSection === 'tickets' && (
        <Card>
          <CardHeader>
            <CardTitle>Your Support Tickets</CardTitle>
            <CardDescription>
              View and track the status of your support requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoadingTickets ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
                </div>
              ) : userTickets?.tickets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileQuestion className="mx-auto h-12 w-12 opacity-50 mb-2" />
                  <p>No tickets found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userTickets?.tickets.map((ticket: Ticket) => (
                    <div
                      key={ticket.id}
                      className="flex flex-col gap-2 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">
                            Ticket #{ticket.id.slice(0, 8)}: {ticket.subject}
                          </h3>
                          <Badge
                            variant="secondary"
                            className={cn("ml-2", statusColors[ticket.status])}
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedTicketId(ticket.id)}
                          >
                            View Responses
                          </Button>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {format(new Date(ticket.createdAt), "PPp")}
                        </span>
                        <span>
                          {ticket.responses.length} response
                          {ticket.responses.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

     {/* New Ticket Section */}
     {activeSection === 'new' && (
        <Card>
          <CardHeader>
            <CardTitle>Submit a Support Ticket</CardTitle>
            <CardDescription>
              Can't find what you're looking for? Submit a ticket and we'll get
              back to you within 24 hours.
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
                  placeholder="What do you need help with?"
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
                    "resize-none min-h-[150px]",
                    errors.message && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {errors.message && (
                  <p className="text-sm text-red-500">{errors.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="bg-muted/50 mt-4">
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <Mail className="h-4 w-4" />
    <p>
      For urgent inquiries, email us at{" "}
      <Button 
        variant="link" 
        className="text-yellow-600 hover:text-yellow-700 p-0 h-auto font-normal"
        onClick={() => window.location.href = 'mailto:support@hivepayapp.com'}
      >
        support@hivepayapp.com
      </Button>
    </p>
  </div>
</CardFooter>
        </Card>
      )}
    </div>

     {/* Ticket Responses Modal */}
     {selectedTicketId && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="w-full max-w-2xl max-h-[80vh] overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Ticket Responses</CardTitle>
              <CardDescription>
                View all responses for this ticket
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedTicketId(null)}
            >
              ×
            </Button>
          </CardHeader>
          <CardContent className="overflow-y-auto max-h-[60vh]">
            {isLoadingResponses ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            ) : !ticketResponses?.pages[0].responses.length ? (
              <div className="text-center py-8 text-muted-foreground">
                <Mail className="mx-auto h-12 w-12 opacity-50 mb-2" />
                <p>No responses yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ticketResponses?.pages.map((page) =>
                  page.responses.map((response: Response) => (
                    <div
                      key={response.id}
                      className="p-4 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">
                            {response.user ? 
                              `${response.user.firstName} ${response.user.lastName}` : 
                              response.staffEmail || 'Support Staff'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(response.createdAt), "PPp")}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">
                        {response.message}
                      </p>
                    </div>
                  ))
                )}

                {hasMoreResponses && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fetchMoreResponses()}
                  >
                    Load More Responses
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )}
  </div>
);
};