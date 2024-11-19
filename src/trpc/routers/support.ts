import { z } from "zod";
import { publicProcedure, privateProcedure, router } from "../trpc";
import { db } from "@/src/db";
import { TRPCError } from "@trpc/server";
import { TicketStatus, TicketPriority } from "@prisma/client";
import { determineTicketPriority, getAIResponse, getResponseTimeByPriority, shouldNotifyImmediately, sendTicketNotificationToSupportTeam } from "@/src/lib/support-utils";
import { sendTicketEmail, notifySupportTeam } from "@/src/lib/support-utils";
import nodemailer from 'nodemailer';
import * as brevo from '@getbrevo/brevo';
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!BREVO_API_KEY) {
  throw new Error('BREVO_API_KEY is not configured in environment variables');
}

// Initialize Brevo client
const brevoClient = new TransactionalEmailsApi();
brevoClient.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'hivepay.team@gmail.com',
    pass: process.env.EMAIL_PASSWORD 
  }
});

export const supportRouter = router({
  submitFeedback: privateProcedure
    .input(
      z.object({
        type: z.enum(['suggestion', 'bug', 'improvement', 'other']),
        title: z.string().min(1, 'Title is required'),
        description: z.string().min(10, 'Description must be at least 10 characters'),
        rating: z.number().min(1).max(5)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      const { type, title, description, rating } = input;

      try {
        // Use the imported db instance directly instead of ctx.db
        const user = await db.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true }
        });

        if (!user) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
        }

        // Send email
        await transporter.sendMail({
          from: 'hivepay.team@gmail.com',
          to: 'hivepay.team@gmail.com',
          subject: `New Feedback: ${title}`,
          html: `
            <h2>New Feedback Received</h2>
            <p><strong>From:</strong> ${user.firstName} ${user.lastName} (${user.email})</p>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Rating:</strong> ${rating}/5</p>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Description:</strong></p>
            <p>${description}</p>
          `
        });

        // Store feedback in database using the imported db instance
        await db.feedback.create({
          data: {
            userId,
            type,
            title,
            description,
            rating
          }
        });

        return { success: true };
      } catch (error) {
        console.error('Failed to submit feedback:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to submit feedback'
        });
      }
    }),
  
  createTicket: privateProcedure
    .input(
      z.object({
        subject: z.string().min(1, "Subject is required").max(200),
        message: z.string().min(1, "Message is required").max(5000),
        priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { subject, message, priority: manualPriority } = input;
      const { user } = ctx;

      try {
        // Get full user details from database
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        if (!dbUser) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User not found",
          });
        }

        // Determine priority
        const priority =
          manualPriority || (await determineTicketPriority(subject, message));

        // Create ticket
        const ticket = await db.supportTicket.create({
          data: {
            subject,
            message,
            priority: priority as TicketPriority,
            userId: user.id,
          },
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        });

        // Get AI response if needed
        const aiResponse = await getAIResponse(subject, message);

        // Send email notification to the user
        await sendTicketEmail(
          dbUser.email,
          `${dbUser.firstName} ${dbUser.lastName}`.trim(),
          ticket.id,
          subject,
          priority,
          message,
          aiResponse
        );

        // Send email notification to the support team
        await notifySupportTeam(
          ticket.id,
          dbUser,
          subject,
          priority,
          message
        );

        return ticket;
      } catch (error) {
        console.error("Error creating ticket:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create support ticket",
        });
      }
    }),



  // Get all tickets for the current user
  getUserTickets: privateProcedure
    .input(
      z.object({
        status: z.enum(["Open", "InProgress", "Resolved", "Closed"]).optional(),
        limit: z.number().min(1).max(100).default(10),
        cursor: z.string().nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { status, limit, cursor } = input;
      const { user } = ctx;

      const tickets = await db.supportTicket.findMany({
        where: {
          userId: user.id,
          ...(status && { status: status as TicketStatus }),
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          responses: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              id: true,
              message: true,
              isStaff: true,
              createdAt: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      let nextCursor: typeof cursor | undefined = undefined;
      if (tickets.length > limit) {
        const nextItem = tickets.pop();
        nextCursor = nextItem?.id;
      }

      return {
        tickets,
        nextCursor,
      };
    }),

  // Get a single ticket by ID
  getTicket: privateProcedure
    .input(z.string())
    .query(async ({ ctx, input: ticketId }) => {
      const { user } = ctx;

      const ticket = await db.supportTicket.findUnique({
        where: {
          id: ticketId,
        },
        include: {
          responses: {
            orderBy: {
              createdAt: "asc",
            },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      if (ticket.userId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view this ticket",
        });
      }

      return ticket;
    }),

  // Add a response to a ticket
  addResponse: privateProcedure
    .input(
      z.object({
        ticketId: z.string(),
        message: z.string().min(1, "Response is required").max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { ticketId, message } = input;
      const { user } = ctx;

      // Check if ticket exists and belongs to user
      const ticket = await db.supportTicket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      if (ticket.userId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to respond to this ticket",
        });
      }

      // Add the response
      const response = await db.ticketResponse.create({
        data: {
          message,
          ticketId,
          userId: user.id,
        },
      });

      // Update ticket status to show there's been activity
      await db.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: "InProgress",
          updatedAt: new Date(),
        },
      });

      return response;
    }),

  // Close a ticket
  closeTicket: privateProcedure
    .input(z.string())
    .mutation(async ({ ctx, input: ticketId }) => {
      const { user } = ctx;

      const ticket = await db.supportTicket.findUnique({
        where: { id: ticketId },
      });

      if (!ticket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ticket not found",
        });
      }

      if (ticket.userId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to close this ticket",
        });
      }

      return await db.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: "Closed",
        },
      });
    }),

// Get ticket statistics
getTicketStats: privateProcedure
  .query(async ({ ctx }) => {
    const { user } = ctx;

    const stats = await db.$transaction([
      // Total tickets
      db.supportTicket.count({
        where: { userId: user.id }
      }),
      // Open tickets
      db.supportTicket.count({
        where: { 
          userId: user.id,
          status: "Open"
        }
      }),
      // In Progress tickets
      db.supportTicket.count({
        where: { 
          userId: user.id,
          status: "InProgress"
        }
      }),
      // Recent activity
      db.supportTicket.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: {
          responses: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          }
        }
      })
    ]);

    return {
      total: stats[0],
      open: stats[1],
      inProgress: stats[2],
      recentActivity: stats[3]
    };
  }),

// Search tickets
searchTickets: privateProcedure
  .input(
    z.object({
      query: z.string(),
      status: z.enum(["Open", "InProgress", "Resolved", "Closed"]).optional(),
      limit: z.number().min(1).max(100).default(10),
      cursor: z.string().nullish(),
    })
  )
  .query(async ({ ctx, input }) => {
    const { query, status, limit, cursor } = input;
    const { user } = ctx;

    const tickets = await db.supportTicket.findMany({
      where: {
        userId: user.id,
        ...(status && { status: status as TicketStatus }),
        OR: [
          { subject: { contains: query, mode: 'insensitive' } },
          { message: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        responses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    let nextCursor: typeof cursor | undefined = undefined;
    if (tickets.length > limit) {
      const nextItem = tickets.pop();
      nextCursor = nextItem?.id;
    }

    return {
      tickets,
      nextCursor,
    };
  }),

// Update ticket status
updateTicketStatus: privateProcedure
  .input(
    z.object({
      ticketId: z.string(),
      status: z.enum(["Open", "InProgress", "Resolved", "Closed"]),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const { ticketId, status } = input;
    const { user } = ctx;

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.userId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to update this ticket",
      });
    }

    return await db.supportTicket.update({
      where: { id: ticketId },
      data: { 
        status,
        updatedAt: new Date()
      },
    });
  }),

// Get responses for a ticket with pagination
getTicketResponses: privateProcedure
  .input(
    z.object({
      ticketId: z.string(),
      limit: z.number().min(1).max(50).default(20),
      cursor: z.string().nullish(),
    })
  )
  .query(async ({ ctx, input }) => {
    const { ticketId, limit, cursor } = input;
    const { user } = ctx;

    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.userId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to view this ticket",
      });
    }

    const responses = await db.ticketResponse.findMany({
      where: { ticketId },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    let nextCursor: typeof cursor | undefined = undefined;
    if (responses.length > limit) {
      const nextItem = responses.pop();
      nextCursor = nextItem?.id;
    }

    return {
      responses,
      nextCursor,
    };
  }),

  respondToTicket: privateProcedure
  .input(
    z.object({
      ticketId: z.string(),
      message: z.string().min(1),
      staffEmail: z.string().email(),
      isStaff: z.boolean().default(true),
    })
  )
  .mutation(async ({ input }) => {
    const { ticketId, message, staffEmail, isStaff } = input;

    try {
      // First, get the ticket and user info
      const ticket = await db.supportTicket.findUnique({
        where: { id: ticketId },
        include: {
          user: {
            select: {
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!ticket) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ticket not found',
        });
      }

      // Create the response in the database
      const response = await db.ticketResponse.create({
        data: {
          message,
          isStaff,
          staffEmail,
          ticketId,
          // Don't include userId since it's a staff response
        },
      });

      // Update ticket status
      await db.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: 'InProgress',
          updatedAt: new Date(),
        },
      });

      // Send email notification to the user
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.subject = `Re: Ticket #${ticketId.slice(0, 8)} - ${ticket.subject}`;
      sendSmtpEmail.htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Response to Your Support Ticket</h2>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Support Team Response:</strong></p>
            <p>${message}</p>
          </div>

          <p>You can view the full conversation or reply by logging into your HivePay account.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 0.9em;">Best regards,<br>HivePay Support Team</p>
          </div>
        </div>
      `;
      
      sendSmtpEmail.sender = {
        name: 'HivePay Support',
        email: 'hivepay.team@gmail.com'
      };
      
      sendSmtpEmail.to = [{
        email: ticket.user.email,
        name: `${ticket.user.firstName} ${ticket.user.lastName}`
      }];

      await brevoClient.sendTransacEmail(sendSmtpEmail);

      return response;
    } catch (error) {
      console.error('Error responding to ticket:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to respond to ticket',
      });
    }
  })

});