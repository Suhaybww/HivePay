import * as brevo from '@getbrevo/brevo';
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';
import { TicketPriority } from '@prisma/client';

interface AutomatedResponse {
  message: string;
  responseTime: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

const BREVO_API_KEY = process.env.BREVO_API_KEY;

if (!BREVO_API_KEY || typeof BREVO_API_KEY !== 'string') {
  throw new Error('BREVO_API_KEY is not properly configured');
}

// Initialize Brevo client
const brevoClient = new TransactionalEmailsApi();
brevoClient.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

/**
 * Returns a short message + estimated response time based on ticket priority.
 */
export function getResponseTimeByPriority(priority: TicketPriority): AutomatedResponse {
  switch (priority) {
    case 'Urgent':
      return {
        message:
          'Your ticket has been marked as urgent. Our team has been notified and will prioritize this issue.',
        responseTime: 'Expected response: Within 2 hours during business hours (9 AM - 5 PM AEST).',
      };
    case 'High':
      return {
        message:
          "We've received your ticket and marked it as high priority. Our support team will review it shortly.",
        responseTime: 'Expected response: Within 4-8 business hours.',
      };
    case 'Medium':
      return {
        message:
          'Thank you for reaching out. Your ticket has been received and will be reviewed by our support team.',
        responseTime: 'Expected response: Within 1-2 business days.',
      };
    case 'Low':
      return {
        message:
          "Thanks for your feedback. We've received your message and will review it accordingly.",
        responseTime: 'Expected response: Within 3-5 business days.',
      };
  }
}

/**
 * Returns a short summary for displaying the ticket priority.
 */
export function getTicketSummary(priority: TicketPriority): string {
  switch (priority) {
    case 'Urgent':
      return '🚨 Critical issue requiring immediate attention';
    case 'High':
      return '⚠️ Important issue affecting core functionality';
    case 'Medium':
      return 'ℹ️ General support inquiry or question';
    case 'Low':
      return '💡 Feedback or suggestion';
  }
}

/**
 * Returns true if the ticket should notify the support team immediately.
 */
export function shouldNotifyImmediately(priority: TicketPriority): boolean {
  return ['Urgent', 'High'].includes(priority);
}

/**
 * Sends an email to the user who submitted the ticket.
 */
export async function sendTicketEmail(
  userEmail: string | null | undefined,
  userName: string,
  ticketId: string,
  subject: string,
  priority: TicketPriority,
  message: string
) {
  if (!userEmail) {
    console.error('Cannot send email: User email is missing');
    return;
  }

  const responseTime = getResponseTimeByPriority(priority);
  const priorityIcon = getTicketSummary(priority).split(' ')[0];

  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = `Ticket Created: ${subject}`;
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${userName},</h2>

        <p>We've received your support request (Ticket #${ticketId.slice(0, 8)}).</p>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Ticket Details:</strong></p>
          <ul style="list-style: none; padding-left: 0;">
            <li><strong>Subject:</strong> ${subject}</li>
            <li><strong>Priority:</strong> ${priorityIcon} ${priority}</li>
            <li><strong>Response Time:</strong> ${responseTime.responseTime}</li>
          </ul>
        </div>

        <p>${responseTime.message}</p>

        <p style="color: #666;">You can view your ticket status by logging into your HivePay account.</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 0.9em;">Best regards,<br>HivePay Support Team</p>
        </div>
      </div>
    `;

    sendSmtpEmail.sender = {
      name: 'HivePay Support',
      email: 'support@hivepay.com.au',
    };

    sendSmtpEmail.to = [
      {
        email: userEmail,
        name: userName,
      },
    ];

    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log('Support ticket email sent to user successfully');
  } catch (error) {
    console.error('Failed to send support ticket email to user:', error);
  }
}

/**
 * Notifies the support team of a newly created ticket.
 */
export async function notifySupportTeam(
  ticketId: string,
  user: User,
  subject: string,
  priority: TicketPriority,
  message: string
) {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    sendSmtpEmail.subject = `New Support Ticket #${ticketId.slice(0, 8)}: ${subject}`;
    sendSmtpEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Support Ticket Received</h2>

        <p>A new support ticket has been created.</p>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Ticket Details:</strong></p>
          <ul style="list-style: none; padding-left: 0;">
            <li><strong>Ticket ID:</strong> ${ticketId}</li>
            <li><strong>User Name:</strong> ${user.firstName} ${user.lastName}</li>
            <li><strong>User Email:</strong> ${user.email}</li>
            <li><strong>Subject:</strong> ${subject}</li>
            <li><strong>Priority:</strong> ${priority}</li>
          </ul>
        </div>

        <div style="background-color: #fff; border: 1px solid #e1e1e1; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        </div>

        <p>Please log in to the admin panel to view and respond to the ticket.</p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 0.9em;">HivePay System Notification</p>
        </div>
      </div>
    `;

    sendSmtpEmail.sender = {
      name: 'HivePay Support',
      email: 'support@hivepay.com.au',
    };

    sendSmtpEmail.to = [
      {
        email: 'support@hivepay.com.au',
        name: 'HivePay Support Team',
      },
    ];

    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log('Support team notification email sent successfully');
  } catch (error) {
    console.error('Failed to send support team notification email:', error);
  }
}
