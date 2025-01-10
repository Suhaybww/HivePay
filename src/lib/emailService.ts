import * as brevo from '@getbrevo/brevo';
import { TransactionalEmailsApi } from '@getbrevo/brevo';
import { Decimal } from '@prisma/client/runtime/library';

const brevoClient = new brevo.TransactionalEmailsApi();
brevoClient.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);

interface GroupMemberInfo {
  email: string;
  firstName: string;
  lastName: string;
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

const fontFamily = "'Inter', Arial, sans-serif";
const primaryColor = "#F59E0B";
const textColor = "#374151";
const subtleBg = "#F9FAFB";
const borderColor = "#E5E7EB";
const headingColor = "#000000";
const footerColor = "#6B7280";

/**
 * A general-purpose function to email multiple group members 
 * about some event, e.g. "Group paused" or "Cycle started".
 *
 * You pass in the groupName, an array of `members`, 
 * plus a `subject` and `body` message you want them to read.
 */
export async function sendGroupNotificationEmail(params: GroupNotificationParams): Promise<void> {
  const { groupName, members, subject, body } = params;

  // We send the same subject & body to each member
  for (const mem of members) {
    try {
      const sendSmtpEmail = new brevo.SendSmtpEmail();
      const htmlContent = `
        <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
          <h2 style="color: ${headingColor}; font-size: 24px; margin-bottom: 10px;">${subject}</h2>
          <p style="color: ${textColor}; font-size: 16px;">Hi ${mem.firstName},</p>
          <div style="background-color: ${subtleBg}; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: ${textColor}; white-space: pre-line;">
              ${body}
            </p>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
            <p style="color: ${footerColor}; font-size: 12px; margin: 0;">
              Best regards,<br>${senderName} Team
            </p>
          </div>
        </div>
      `;

      sendSmtpEmail.sender = { name: senderName, email: senderEmail };
      sendSmtpEmail.to = [{
        email: mem.email,
        name: `${mem.firstName} ${mem.lastName}`
      }];
      sendSmtpEmail.subject = `${subject} - ${groupName}`;
      sendSmtpEmail.htmlContent = htmlContent;

      await brevoClient.sendTransacEmail(sendSmtpEmail);
      console.log(`Group notification (“${subject}”) sent to ${mem.email}`);
    } catch (error) {
      console.error(`Failed to send group notification to ${mem.email}:`, error);
      // we can continue the loop or re-throw
    }
  }
}

/**
 * Send an email if the group is paused for some reason 
 * (repeated failures or a full refund, etc).
 * 
 * We'll build a default message, then call sendGroupNotificationEmail for each member.
 */
export async function sendGroupPausedNotificationEmail(groupName: string, members: GroupMemberInfo[], reason?: string): Promise<void> {
  let subject = 'Group Paused';
  let body = `Your group "${groupName}" has been paused.\n\n`;

  if (reason) {
    body += `Reason: ${reason}\n\n`;
  }
  body += 'No further contributions or payouts will occur until this group is reactivated. If you have questions, please contact your admin or support.';

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
export async function sendGroupCycleStartedEmail(groupName: string, members: GroupMemberInfo[]): Promise<void> {
  const subject = 'A new cycle has started!';
  let body = `A new contribution cycle for "${groupName}" just started.\n\n`;
  body += 'Contributions will be automatically collected from all members, and the next payout will follow soon.\n\n';
  body += 'Thank you for being part of HivePay!';

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
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  const inactiveMembersList = inactiveMembers.join(', ');

  const htmlContent = `
    <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
      <h2 style="color: ${headingColor}; font-size: 24px; margin-bottom: 10px;">Group Paused: ${groupName}</h2>
      <p style="color: ${textColor}; font-size: 16px;">Hi ${recipient.firstName},</p>
      <div style="background-color: #FEF9C3; border-left: 4px solid ${primaryColor}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="color: ${textColor}; font-size: 16px; margin: 0;"><strong>Your group has been paused</strong></p>
        <p style="color: ${textColor}; font-size: 14px; margin: 8px 0 0;">
          This is because the following member(s) no longer have an active subscription:
        </p>
        <p style="font-weight: bold; color: ${textColor}; font-size: 14px; margin-top: 8px;">${inactiveMembersList}</p>
      </div>

      <div style="background-color: ${subtleBg}; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; font-size: 18px; color: ${headingColor};">What this means:</h3>
        <ul style="color: ${textColor}; font-size: 14px; padding-left: 20px;">
          <li style="margin-bottom: 8px;">All group activities are temporarily suspended</li>
          <li style="margin-bottom: 8px;">No new contributions will be collected</li>
          <li style="margin-bottom: 0;">No payouts will be processed</li>
        </ul>
      </div>

      <div style="background-color: #ECFDF5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #065F46; margin: 0; font-size: 14px;">
          <strong>The group will automatically resume when all members have active subscriptions.</strong>
        </p>
      </div>

      <p style="color: ${textColor}; font-size: 14px;">If you have any questions, please contact our support team.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
        <p style="color: ${footerColor}; font-size: 12px; margin: 0;">Best regards,<br>${senderName} Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Group Paused: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Group paused email sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send group paused email to ${recipient.email}:`, error);
    throw error;
  }
}

export async function sendContributionReminderEmail({
  groupName,
  contributionAmount,
  contributionDate,
  recipient,
}: ContributionReminderEmailParams): Promise<void> {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  const formattedDate = contributionDate.toLocaleDateString('en-AU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formattedAmount = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(contributionAmount));

  const htmlContent = `
    <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
      <div style="background-color: #FFF7ED; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: ${headingColor}; margin: 0; font-size: 24px;">Upcoming Contribution Reminder</h2>
        <p style="color: #78350F; margin-top: 8px; font-size: 16px;">For ${groupName}</p>
      </div>

      <p style="color: ${textColor}; font-size: 16px;">Hi ${recipient.firstName},</p>

      <div style="background-color: ${subtleBg}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: ${textColor}; font-size: 16px;">
          This is a friendly reminder that your scheduled contribution of <strong>${formattedAmount}</strong> 
          is due on <strong>${formattedDate}</strong>.
        </p>
      </div>

      <div style="background-color: #ECFDF5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #166534; margin-top: 0; font-size: 18px;">Important Information</h3>
        <ul style="color: ${textColor}; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">The amount will be automatically debited from your registered bank account</li>
          <li style="margin-bottom: 8px;">Please ensure sufficient funds are available</li>
          <li>Your contribution helps maintain the group's saving schedule</li>
        </ul>
      </div>

      <div style="background-color: ${subtleBg}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: ${textColor}; font-size: 16px;">
          Need to update your payment details or have questions? Visit your 
          <a href="https://hivepay.com.au/dashboard" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">HivePay Dashboard</a> 
          or contact our support team.
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
        <p style="color: ${footerColor}; font-size: 12px; margin: 0;">Best regards,<br>${senderName} Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Contribution Reminder: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Contribution reminder email sent to ${recipient.email} for group ${groupName}`);
  } catch (error) {
    console.error(`Failed to send contribution reminder email to ${recipient.email}:`, error);
    throw error;
  }
}


export async function sendInvitationEmail(
  email: string,
  groupId: string,
  groupName: string,
  inviterName: string
): Promise<void> {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  const htmlContent = `
    <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
      <div style="background-color: #FFF7ED; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: ${headingColor}; margin: 0; font-size: 24px;">You're Invited!</h2>
        <p style="color: #78350F; margin-top: 8px; font-size: 16px;">To join ${groupName} on HivePay</p>
      </div>

      <div style="background-color: ${subtleBg}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: ${textColor}; font-size: 16px;">
          ${inviterName} has invited you to join their savings group "${groupName}" on HivePay.
        </p>
      </div>

      <div style="background-color: #ECFDF5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #065F46; margin: 0; font-size: 14px;">
          <strong>Group ID: ${groupId}</strong>
        </p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <p style="color: ${textColor}; font-size: 16px;">
          To join the group, please navigate to the 
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">Dashboard</a> 
          or 
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/groups" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">Groups</a> 
          page in the HivePay app and click "Join Group". Enter the Group ID provided above to join.
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
        <p style="color: ${footerColor}; font-size: 12px; margin: 0;">Best regards,<br>${senderName} Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email }];
  sendSmtpEmail.subject = `Join ${groupName} on HivePay`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Invitation email sent to ${email} for group ${groupName}`);
  } catch (error) {
    console.error(`Failed to send invitation email to ${email}:`, error);
    throw error;
  }
}

export async function sendGroupDeletionEmail({
  groupName,
  adminName,
  recipient,
}: GroupDeletionEmailParams): Promise<void> {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  const htmlContent = `
    <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
      <div style="background-color: #FEE2E2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: ${headingColor}; margin: 0; font-size: 24px;">Group Deleted</h2>
        <p style="color: #991B1B; margin-top: 8px; font-size: 16px;">${groupName}</p>
      </div>

      <p style="color: ${textColor}; font-size: 16px;">Hi ${recipient.firstName},</p>

      <div style="background-color: ${subtleBg}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: ${textColor}; font-size: 16px;">
          This is to inform you that the group "${groupName}" has been deleted by ${adminName}.
        </p>
      </div>

      <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: ${headingColor}; margin-top: 0; font-size: 18px;">What This Means:</h3>
        <ul style="color: ${textColor}; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">All group data has been permanently removed</li>
          <li style="margin-bottom: 8px;">Any pending contributions or payouts have been cancelled</li>
          <li>You can create or join other groups from your dashboard</li>
        </ul>
      </div>

      <p style="color: ${textColor}; font-size: 14px;">
        If you have any questions or concerns, please don't hesitate to contact our support team.
      </p>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
        <p style="color: ${footerColor}; font-size: 12px; margin: 0;">Best regards,<br>${senderName} Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Group Deleted: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Group deletion email sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send group deletion email to ${recipient.email}:`, error);
    // Don't throw error to allow the deletion process to continue
  }
}


// Add these new functions to your emailService.ts file
export async function sendPaymentFailureEmail({
  recipient,
  groupName,
  amount,
}: PaymentFailureEmailParams): Promise<void> {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  const formattedAmount = new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(Number(amount));

  const htmlContent = `
    <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
      <div style="background-color: #FEE2E2; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: ${headingColor}; margin: 0; font-size: 24px;">Payment Failed</h2>
        <p style="color: #991B1B; margin-top: 8px; font-size: 16px;">${groupName}</p>
      </div>

      <p style="color: ${textColor}; font-size: 16px;">Hi ${recipient.firstName},</p>

      <div style="background-color: ${subtleBg}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: ${textColor}; font-size: 16px;">
          Your scheduled contribution of <strong>${formattedAmount}</strong> for "${groupName}" has failed.
        </p>
      </div>

      <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: ${headingColor}; margin-top: 0; font-size: 18px;">Next Steps:</h3>
        <ul style="color: ${textColor}; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">Please check your bank account has sufficient funds</li>
          <li style="margin-bottom: 8px;">Verify your BECS Direct Debit details are correct</li>
          <li>The payment will be automatically retried within 24 hours</li>
        </ul>
      </div>

      <div style="background-color: #ECFDF5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #065F46; margin: 0; font-size: 14px;">
          <strong>Need to update your payment details?</strong><br>
          Visit your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">HivePay Dashboard</a>
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
        <p style="color: ${footerColor}; font-size: 12px; margin: 0;">Best regards,<br>${senderName} Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Payment Failed: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Payment failure email sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send payment failure email to ${recipient.email}:`, error);
    throw error;
  }
}

export async function sendPayoutProcessedEmail({
  recipient,
  groupName,
  amount,
}: PayoutProcessedEmailParams): Promise<void> {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  const formattedAmount = new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(Number(amount));

  const htmlContent = `
    <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
      <div style="background-color: #ECFDF5; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: ${headingColor}; margin: 0; font-size: 24px;">Payout Processed</h2>
        <p style="color: #065F46; margin-top: 8px; font-size: 16px;">${groupName}</p>
      </div>

      <p style="color: ${textColor}; font-size: 16px;">Hi ${recipient.firstName},</p>

      <div style="background-color: ${subtleBg}; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: ${textColor}; font-size: 16px;">
          Great news! Your payout of <strong>${formattedAmount}</strong> from "${groupName}" has been processed.
        </p>
      </div>

      <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: ${headingColor}; margin-top: 0; font-size: 18px;">Important Information:</h3>
        <ul style="color: ${textColor}; font-size: 14px; margin-bottom: 0; padding-left: 20px;">
          <li style="margin-bottom: 8px;">The funds have been sent to your connected bank account</li>
          <li style="margin-bottom: 8px;">Standard processing time is 1-3 business days</li>
          <li>You can track this payout in your Stripe dashboard</li>
        </ul>
      </div>

      <div style="background-color: #ECFDF5; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="color: #065F46; margin: 0; font-size: 14px;">
          <strong>Want to view the transfer details?</strong><br>
          Check your <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">HivePay Dashboard</a>
        </p>
      </div>

      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
        <p style="color: ${footerColor}; font-size: 12px; margin: 0;">Best regards,<br>${senderName} Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` }];
  sendSmtpEmail.subject = `Payout Processed: ${groupName}`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Payout processed email sent to ${recipient.email}`);
  } catch (error) {
    console.error(`Failed to send payout processed email to ${recipient.email}:`, error);
    throw error;
  }
}