import nodemailer from 'nodemailer';
import OpenAI from 'openai';
import * as brevo from '@getbrevo/brevo';
import { TicketPriority } from '@prisma/client';
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// Initialize API client with correct enum type
const brevoClient = new TransactionalEmailsApi();
brevoClient.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

export async function determineTicketPriority(
  subject: string, 
  message: string
): Promise<TicketPriority> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a support ticket analyzer for HivePay, a platform for managing group savings and contributions. 
          Analyze the ticket subject and message to determine its priority level based on these criteria:

          URGENT:
          - Issues involving missing or incorrect money transactions
          - Security concerns or unauthorized access
          - Complete system outages affecting multiple users
          - Payment processing failures
          - Issues directly impacting user funds

          HIGH:
          - Individual user access issues
          - Single transaction problems
          - Group contribution issues
          - Account setup problems
          - Billing issues

          MEDIUM:
          - General product questions
          - Feature inquiries
          - Group management questions
          - Configuration help
          - Non-critical bugs

          LOW:
          - Feature requests
          - General feedback
          - Documentation questions
          - UI/UX suggestions
          - General inquiries

          Respond with ONLY the priority level word (URGENT, HIGH, MEDIUM, or LOW).`
        },
        {
          role: "user",
          content: `Subject: ${subject}\nMessage: ${message}`
        }
      ],
      max_tokens: 10,
      temperature: 0.1,
    });

    const priority = completion.choices[0].message.content?.trim().toUpperCase();
    
    switch (priority) {
      case 'URGENT':
        return 'Urgent';
      case 'HIGH':
        return 'High';
      case 'MEDIUM':
        return 'Medium';
      case 'LOW':
        return 'Low';
      default:
        return 'Medium';
    }
  } catch (error) {
    console.error('Error determining ticket priority:', error);
    return 'Medium';
  }
}

export async function getAIResponse(
  subject: string,
  message: string
): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful support assistant for HivePay, a platform for managing group savings and contributions. 
          Provide a brief, helpful initial response to the user's inquiry. 
          Keep responses under 150 words, professional but friendly.
          Focus on acknowledging the issue and setting clear expectations.`
        },
        {
          role: "user",
          content: `Subject: ${subject}\nMessage: ${message}`
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    return completion.choices[0].message.content || null;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return null;
  }
}

export function getResponseTimeByPriority(priority: TicketPriority): AutomatedResponse {
  switch (priority) {
    case 'Urgent':
      return {
        message: "Your ticket has been marked as urgent. Our team has been notified and will prioritize this issue.",
        responseTime: "Expected response: Within 2 hours during business hours (9 AM - 5 PM AEST).",
      };
    case 'High':
      return {
        message: "We've received your ticket and marked it as high priority. Our support team will review it shortly.",
        responseTime: "Expected response: Within 4-8 business hours.",
      };
    case 'Medium':
      return {
        message: "Thank you for reaching out. Your ticket has been received and will be reviewed by our support team.",
        responseTime: "Expected response: Within 1-2 business days.",
      };
    case 'Low':
      return {
        message: "Thanks for your feedback. We've received your message and will review it accordingly.",
        responseTime: "Expected response: Within 3-5 business days.",
      };
  }
}

export function getTicketSummary(priority: TicketPriority): string {
  switch (priority) {
    case 'Urgent':
      return "🚨 Critical issue requiring immediate attention";
    case 'High':
      return "⚠️ Important issue affecting core functionality";
    case 'Medium':
      return "ℹ️ General support inquiry or question";
    case 'Low':
      return "💡 Feedback or suggestion";
  }
}

export function shouldNotifyImmediately(priority: TicketPriority): boolean {
  return ['Urgent', 'High'].includes(priority);
}

// Send email to the user who submitted the ticket
export async function sendTicketEmail(
  userEmail: string | null | undefined,
  userName: string,
  ticketId: string,
  subject: string,
  priority: TicketPriority,
  message: string,
  aiResponse: string | null = null
) {
  // Check if email exists
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

        ${aiResponse ? `
          <div style="background-color: #fff; border: 1px solid #e1e1e1; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Initial Response:</strong></p>
            <p>${aiResponse}</p>
          </div>
        ` : ''}

        <p>${responseTime.message}</p>
        
        <p style="color: #666;">You can view your ticket status by logging into your HivePay account.</p>
        
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
      email: userEmail,
      name: userName
    }];

    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log('Support ticket email sent to user successfully');
  } catch (error) {
    console.error('Failed to send support ticket email to user:', error);
  }
}

// Send email notification to the support team
export async function sendTicketNotificationToSupportTeam(
  supportEmail: string,
  ticketId: string,
  userName: string,
  userEmail: string,
  subject: string,
  priority: TicketPriority,
  message: string
) {
  const priorityIcon = getTicketSummary(priority).split(' ')[0];

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
            <li><strong>User Name:</strong> ${userName}</li>
            <li><strong>User Email:</strong> ${userEmail}</li>
            <li><strong>Subject:</strong> ${subject}</li>
            <li><strong>Priority:</strong> ${priorityIcon} ${priority}</li>
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
      email: 'hivepay.team@gmail.com'  // Updated sender email
    };
    
    sendSmtpEmail.to = [{
      email: supportEmail,
      name: 'HivePay Support Team'
    }];

    const response = await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log('Support ticket notification sent to support team successfully:', response);
  } catch (error) {
    console.error('Failed to send support ticket notification to support team:', error);
  }
}

export async function notifySupportTeam(
  ticketId: string,
  user: User,
  subject: string,
  priority: TicketPriority,
  message: string
) {
  try {
    // Create a Nodemailer transporter using Gmail SMTP
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'yourgmailaccount@gmail.com',
        pass: 'yourapppassword', // Use an App Password if 2FA is enabled
      },
    });

    // Email content
    const mailOptions = {
      from: '"HivePay Support" <yourgmailaccount@gmail.com>',
      to: 'hivepay.team@gmail.com',
      subject: `New Support Ticket #${ticketId.slice(0, 8)}: ${subject}`,
      html: `
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
          
          <p>You can reply directly to this email to respond to the user.</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 0.9em;">HivePay System Notification</p>
          </div>
        </div>
      `,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log('Support team notification email sent:', info.response);
  } catch (error) {
    console.error('Failed to send support team notification email:', error);
  }
}