import * as brevo from '@getbrevo/brevo';
import { TransactionalEmailsApi, SendSmtpEmail } from '@getbrevo/brevo';
import { Decimal } from '@prisma/client/runtime/library';
import {theme, baseTemplate, contentSection, alertBox, actionButton } from './emailTemplates';

const brevoClient = new brevo.TransactionalEmailsApi();
brevoClient.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);

interface NotifySupportTeamParams {
  ticketId: string;
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  subject: string;
  priority: string;
  message: string;
}

interface GroupStatusEmailParams {
  groupName: string;
  inactiveMembers: string[];  // Now using emails instead of names
  recipient: GroupMemberInfo;
}

interface TicketEmailParams {
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  ticketId: string;
  subject: string;
  priority: string;
  message: string;
  aiResponse?: string;
}

interface FeedbackEmailParams {
  user: {
    email: string;
    firstName: string;
    lastName: string;
  };
  type: string;
  title: string;
  description: string;
  rating: number;
}

interface GroupMemberInfo {
  email: string;
  firstName: string;
  lastName: string;
}

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}


interface GroupDeletionEmailParams {
  groupName: string;
  adminName: string;
  recipient: GroupMemberInfo;
}

interface GroupStatusEmailParams {
  groupName: string;
  inactiveMembers: string[];
  recipient: GroupMemberInfo;
}

interface CancellationReminderEmailParams {
  email: string;
  firstName: string;
  lastName: string;
  periodEnd: Date;
}

interface ContributionReminderEmailParams {
  groupName: string;
  contributionAmount: Decimal;
  contributionDate: Date;
  recipient: GroupMemberInfo;
}

interface PaymentFailureEmailParams {
  recipient: GroupMemberInfo;
  groupName: string;
  amount: string;
}

interface PayoutProcessedEmailParams {
  recipient: GroupMemberInfo;
  groupName: string;
  amount: string;
}

/**
 * NEW: For group notifications, e.g. "cycle started" or "group paused".
 */
interface GroupNotificationParams {
  groupName: string;
  members: GroupMemberInfo[]; // all the group’s recipients
  subject: string;
  body: string;   // any custom message/HTML you want
}

const senderName = process.env.EMAIL_SENDER_NAME || 'HivePay';
const senderEmail = process.env.EMAIL_SENDER_EMAIL || 'support@hivepay.com.au';


/**
 * A general-purpose function to email multiple group members 
 * about some event, e.g. "Group paused" or "Cycle started".
 *
 * You pass in the groupName, an array of `members`, 
 * plus a `subject` and `body` message you want them to read.
 */
export async function sendGroupNotificationEmail(params: GroupNotificationParams): Promise<void> {
  const { groupName, members, subject, body } = params;

  for (const mem of members) {
    try {
      const htmlContent = baseTemplate(`
        ${contentSection(`
          <h2 style="
            margin: 0 0 16px;
            font-size: 20px;
            color: ${theme.headingColor};
          ">
            ${subject}
          </h2>
          
          <p>Hi ${mem.firstName},</p>
          
          ${alertBox(body.replace(/\n/g, '<br>'), 'info')}
        `)}
      `);

      const sendSmtpEmail = new brevo.SendSmtpEmail();
      sendSmtpEmail.sender = { name: senderName, email: senderEmail };
      sendSmtpEmail.to = [{ email: mem.email, name: `${mem.firstName} ${mem.lastName}` }];
      sendSmtpEmail.subject = `${subject} - ${groupName}`;
      sendSmtpEmail.htmlContent = htmlContent;

      await brevoClient.sendTransacEmail(sendSmtpEmail);
      console.log(`Group notification (“${subject}”) sent to ${mem.email}`);
    } catch (error) {
      console.error(`Failed to send group notification to ${mem.email}:`, error);
    }
  }
}

/**
 * Send an email if the group is paused for some reason 
 * (repeated failures or a full refund, etc).
 * 
 * We'll build a default message, then call sendGroupNotificationEmail for each member.
 */
export async function sendGroupPausedNotificationEmail(
  groupName: string, 
  members: GroupMemberInfo[], 
  reason?: string
): Promise<void> {
  const subject = 'Group Paused';
  let body = `Your group "${groupName}" has been paused.\n\n`;

  if (reason) {
    body += `Reason: ${reason}\n\n`;
  }
  body += 'No further contributions or payouts will occur until this group is reactivated.';

  await sendGroupNotificationEmail({
    groupName,
    members,
    subject,
    body,
  });
}

/**
 * Send an email to the entire group saying 
 * “Cycle started for group X, contributions are now being collected…”
 */
export async function sendGroupCycleStartedEmail(
  groupName: string, 
  members: GroupMemberInfo[]
): Promise<void> {
  const subject = 'New Contribution Cycle Started';
  const body = `
    A new contribution cycle for "${groupName}" has begun.\n\n
    Contributions will be automatically collected from all members, 
    and the next payout will follow soon.\n\n
    Thank you for being part of HivePay!
  `;

  await sendGroupNotificationEmail({
    groupName,
    members,
    subject,
    body,
  });
}

export async function sendGroupPausedEmail({
  groupName,
  inactiveMembers,
  recipient,
}: GroupStatusEmailParams): Promise<void> {
  const inactiveMembersList = inactiveMembers.join(', ');

  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        Group Paused: ${groupName}
      </h2>
      
      <p>Hi ${recipient.firstName},</p>
      
      ${alertBox(`
        <strong>Your group has been paused</strong><br>
        The following members no longer have active subscriptions:
        <div style="
          background: white;
          padding: 12px;
          border-radius: 4px;
          margin-top: 8px;
          font-weight: 500;
          color: ${theme.textColor};
        ">
          ${inactiveMembersList}
        </div>
      `, 'warning')}
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        What This Means
      </h3>
      
      <ul style="
        margin: 0;
        padding-left: 20px;
      ">
        <li style="margin-bottom: 8px;">All group activities are suspended</li>
        <li style="margin-bottom: 8px;">No new contributions will be collected</li>
        <li>No payouts will be processed</li>
      </ul>
      
      ${alertBox(`
        The group will automatically resume when all members have active subscriptions
      `, 'info')}
      
      <p style="font-size: 14px; color: ${theme.textColor};">
        Need help? Contact our 
        <a href="mailto:support@hivepay.com.au" style="
          color: ${theme.primaryColor};
          text-decoration: none;
        ">support team</a>
      </p>
    `)}
  `, `Group ${groupName} has been paused`);

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Group Paused: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Group paused email sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send group paused email:`, error);
    throw error;
  }
}

export async function sendContributionReminderEmail({
  groupName,
  contributionAmount,
  contributionDate,
  recipient,
}: ContributionReminderEmailParams): Promise<void> {
  const formattedDate = contributionDate.toLocaleDateString('en-AU', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const formattedAmount = new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(Number(contributionAmount));

  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        Contribution Reminder
      </h2>
      
      <p>Hi ${recipient.firstName},</p>
      
      ${alertBox(`
        Your scheduled contribution of 
        <strong>${formattedAmount}</strong> for 
        <strong>${groupName}</strong> is due on 
        <strong>${formattedDate}</strong>.
      `, 'warning')}
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        Important Information
      </h3>
      
      <ul style="
        margin: 0;
        padding-left: 20px;
      ">
        <li style="margin-bottom: 8px;">Automatic debit from registered account</li>
        <li style="margin-bottom: 8px;">Ensure sufficient funds are available</li>
        <li>Maintains group savings schedule</li>
      </ul>
      
      ${actionButton(
        'Update Payment Details', 
        `${process.env.NEXT_PUBLIC_APP_URL}/payments`
      )}
    `)}
  `, `Upcoming contribution of ${formattedAmount} for ${groupName}`);

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Contribution Reminder: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Contribution reminder sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send contribution reminder:`, error);
    throw error;
  }
}

// Updated Invitation Email
export async function sendInvitationEmail(
  email: string,
  groupId: string,
  groupName: string,
  inviterName: string
): Promise<void> {
  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        You're Invited!
      </h2>
      
      <p>Hi there,</p>
      
      ${alertBox(`
        ${inviterName} has invited you to join 
        <strong>${groupName}</strong> on HivePay
      `, 'success')}
      
      <div style="
        background: ${theme.subtleBg};
        padding: 16px;
        border-radius: 6px;
        margin: 24px 0;
        text-align: center;
      ">
        <div style="font-size: 13px; color: ${theme.footerColor};">
          Group ID
        </div>
        <div style="
          font-size: 18px;
          font-weight: 500;
          margin-top: 8px;
          color: ${theme.primaryColor};
        ">
          ${groupId}
        </div>
      </div>
      
      ${actionButton(
        'Join Group Now', 
        `${process.env.NEXT_PUBLIC_APP_URL}/groups`
      )}
      
      <p style="font-size: 14px; color: ${theme.textColor};">
        Need help? Contact our 
        <a href="mailto:support@hivepay.com.au" style="
          color: ${theme.primaryColor};
          text-decoration: none;
        ">support team</a>
      </p>
    `)}
  `, `Join ${groupName} on HivePay`);

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.subject = `Join ${groupName} on HivePay`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Invitation sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send invitation:`, error);
    throw error;
  }
}
export async function sendGroupDeletionEmail({
  groupName,
  adminName,
  recipient,
}: GroupDeletionEmailParams): Promise<void> {
  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        Group Deleted: ${groupName}
      </h2>
      
      <p>Hi ${recipient.firstName},</p>
      
      ${alertBox(`
        The group "${groupName}" has been deleted by ${adminName}
      `, 'error')}
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        What This Means
      </h3>
      
      <ul style="
        margin: 0;
        padding-left: 20px;
      ">
        <li style="margin-bottom: 8px;">All group data has been removed</li>
        <li style="margin-bottom: 8px;">Pending contributions/payouts cancelled</li>
        <li>You can create/join other groups</li>
      </ul>
      
      ${actionButton(
        'Create New Group',
        `${process.env.NEXT_PUBLIC_APP_URL}/groups`
      )}
      
      <p style="font-size: 14px; color: ${theme.textColor};">
        Questions? Contact our 
        <a href="mailto:support@hivepay.com.au" style="
          color: ${theme.primaryColor};
          text-decoration: none;
        ">support team</a>
      </p>
    `)}
  `, `Group ${groupName} has been deleted`);

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Group Deleted: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Group deletion email sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send group deletion email:`, error);
    throw error;
  }
}

// Updated Payment Failure Email
export async function sendPaymentFailureEmail({
  recipient,
  groupName,
  amount,
}: PaymentFailureEmailParams): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(Number(amount));

  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        Payment Failed
      </h2>
      
      <p>Hi ${recipient.firstName},</p>
      
      ${alertBox(`
        Your payment of <strong>${formattedAmount}</strong> 
        for <strong>${groupName}</strong> could not be processed
      `, 'error')}
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        Required Action
      </h3>
      
      <ol style="
        margin: 0;
        padding-left: 20px;
      ">
        <li style="margin-bottom: 8px;">Check account balance</li>
        <li style="margin-bottom: 8px;">Verify payment details</li>
        <li>Retry automatically in 24 hours</li>
      </ol>
      
      ${actionButton(
        'Update Payment Method', 
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      )}
      
      <p style="font-size: 14px; color: ${theme.textColor};">
        Need immediate assistance? Call us at 
        <a href="tel:+61212345678" style="
          color: ${theme.primaryColor};
          text-decoration: none;
        ">+61 2 1234 5678</a>
      </p>
    `)}
  `, `Payment failed for ${groupName}`);

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Payment Failed: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Payment failure notice sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send payment failure email:`, error);
    throw error;
  }
}

export async function sendPayoutProcessedEmail({
  recipient,
  groupName,
  amount,
}: PayoutProcessedEmailParams): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(Number(amount));

  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        Payout Processed: ${groupName}
      </h2>
      
      <p>Hi ${recipient.firstName},</p>
      
      ${alertBox(`
        Your payout of <strong>${formattedAmount}</strong> 
        from <strong>${groupName}</strong> has been successfully processed!
      `, 'success')}
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        Payment Details
      </h3>
      
      <ul style="
        margin: 0;
        padding-left: 20px;
      ">
        <li style="margin-bottom: 8px;">Sent to your connected bank account</li>
        <li style="margin-bottom: 8px;">Processing time: 5 business days</li>
        <li>Trackable in your Stripe dashboard</li>
      </ul>
      
      ${actionButton(
        'View Transaction Details',
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      )}
      
      <p style="font-size: 14px; color: ${theme.textColor};">
        Need help? Contact our 
        <a href="mailto:support@hivepay.com.au" style="
          color: ${theme.primaryColor};
          text-decoration: none;
        ">support team</a>
      </p>
    `)}
  `, `Payout of ${formattedAmount} processed for ${groupName}`);

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Payout Processed: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Payout processed email sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send payout processed email:`, error);
    throw error;
  }
}

/**
 * Sends contact form emails to both the support team and the user.
 */
export async function sendContactFormEmails({ name, email, message }: ContactFormData) {
  try {
    // 1) Send notification to support team
    const supportEmail = new SendSmtpEmail();
    supportEmail.subject = `New Contact Form Submission from ${name}`;
    supportEmail.htmlContent = baseTemplate(`
      ${contentSection(`
        <h2 style="
          margin: 0 0 16px;
          font-size: 20px;
          color: ${theme.headingColor};
        ">
          New Contact Form Submission
        </h2>
        
        <p>Hi HivePay Team,</p>
        
        ${alertBox(`
          <strong>Contact Details:</strong>
          <ul style="list-style: none; padding-left: 0;">
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
          </ul>
        `, 'info')}
        
        ${alertBox(`
          <strong>Message:</strong>
          <p>${message}</p>
        `, 'info')}
      `)}
    `, `New contact form submission from ${name}`);

    supportEmail.sender = { name: senderName, email: senderEmail };
    supportEmail.to = [
      {
        email: "support@hivepay.com.au",
        name: "HivePay Support Team",
      },
    ];

    await brevoClient.sendTransacEmail(supportEmail);

    // 2) Send confirmation to user
    const userEmail = new SendSmtpEmail();
    userEmail.subject = "Thank you for contacting HivePay";
    userEmail.htmlContent = baseTemplate(`
      ${contentSection(`
        <h2 style="
          margin: 0 0 16px;
          font-size: 20px;
          color: ${theme.headingColor};
        ">
          Hi ${name},
        </h2>
        
        <p>Thank you for reaching out to HivePay. We've received your message and will get back to you as soon as possible.</p>
        
        ${alertBox(`
          <strong>Your message:</strong>
          <p>${message}</p>
        `, 'info')}
        
        <p>We typically respond within 1-2 business days.</p>
      `)}
    `, `Thank you for contacting HivePay`);

    userEmail.sender = { name: senderName, email: senderEmail };
    userEmail.to = [
      {
        email: email,
        name: name,
      },
    ];

    await brevoClient.sendTransacEmail(userEmail);

    return { success: true };
  } catch (error) {
    console.error("Failed to send contact form emails:", error);
    throw error;
  }
}


export async function sendFeedbackEmail(params: FeedbackEmailParams): Promise<void> {
  const { user, type, title, description, rating } = params;

  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        New Feedback Received
      </h2>
      
      <p><strong>From:</strong> ${user.firstName} ${user.lastName} (${user.email})</p>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>Rating:</strong> ${rating}/5</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Description:</strong></p>
      <p>${description}</p>
    `)}
  `, `New Feedback: ${title}`);

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: 'support@hivepay.com.au', name: 'HivePay Support Team' }];
  sendSmtpEmail.subject = `New Feedback: ${title}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Feedback email sent to support team`);
  } catch (error) {
    console.error(`Failed to send feedback email:`, error);
    throw error;
  }
}


/**
 * Sends an email to the user confirming their ticket submission.
 */
export async function sendTicketEmail(params: TicketEmailParams): Promise<void> {
  const { user, ticketId, subject, priority, message } = params;

  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        Thank you for contacting HivePay Support
      </h2>
      
      <p>Hi ${user.firstName},</p>
      
      ${alertBox(`
        We've received your support request and will get back to you as soon as possible.
      `, 'info')}
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        Ticket Details
      </h3>
      
      <ul style="
        margin: 0;
        padding-left: 20px;
      ">
        <li style="margin-bottom: 8px;"><strong>Ticket ID:</strong> ${ticketId}</li>
        <li style="margin-bottom: 8px;"><strong>Subject:</strong> ${subject}</li>
        <li style="margin-bottom: 8px;"><strong>Priority:</strong> ${priority}</li>
      </ul>
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        Your Message
      </h3>
      
      <p>${message}</p>
      
      <p style="font-size: 14px; color: ${theme.textColor};">
        Need further assistance? Contact our 
        <a href="mailto:support@hivepay.com.au" style="
          color: ${theme.primaryColor};
          text-decoration: none;
        ">support team</a>
      </p>
    `)}
  `, `Support Ticket Confirmation: ${subject}`);

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: user.email, name: `${user.firstName} ${user.lastName}` }];
  sendSmtpEmail.subject = `Support Ticket Confirmation: ${subject}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Ticket confirmation email sent to ${user.email}`);
  } catch (error) {
    console.error(`Failed to send ticket confirmation email:`, error);
    throw error;
  }
}

/**
 * Sends an email to the support team notifying them of a new ticket.
 */
export async function notifySupportTeam(params: NotifySupportTeamParams): Promise<void> {
  const { ticketId, user, subject, priority, message } = params;

  const htmlContent = baseTemplate(`
    ${contentSection(`
      <h2 style="
        margin: 0 0 16px;
        font-size: 20px;
        color: ${theme.headingColor};
      ">
        New Support Ticket Created
      </h2>
      
      <p>A new support ticket has been submitted by ${user.firstName} ${user.lastName}.</p>
      
      ${alertBox(`
        <strong>Ticket ID:</strong> ${ticketId}<br>
        <strong>Subject:</strong> ${subject}<br>
        <strong>Priority:</strong> ${priority}
      `, 'info')}
      
      <h3 style="
        margin: 24px 0 12px;
        font-size: 16px;
        color: ${theme.headingColor};
      ">
        User Message
      </h3>
      
      <p>${message}</p>
      
      <p style="font-size: 14px; color: ${theme.textColor};">
        Please log in to the admin panel to view and respond to the ticket.
      </p>
    `)}
  `, `New Support Ticket: ${subject}`);

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: 'support@hivepay.com.au', name: 'HivePay Support Team' }];
  sendSmtpEmail.subject = `New Support Ticket: ${subject}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Support team notified about ticket ${ticketId}`);
  } catch (error) {
    console.error(`Failed to notify support team:`, error);
    throw error;
  }
}