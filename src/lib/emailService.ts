import * as brevo from '@getbrevo/brevo';
import { TransactionalEmailsApi } from '@getbrevo/brevo';
import { Decimal } from '@prisma/client/runtime/library';

const brevoClient = new brevo.TransactionalEmailsApi();
brevoClient.setApiKey(
  brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY || ''
);

interface GroupDeletionEmailParams {
  groupName: string;
  adminName: string;
  recipient: GroupMemberInfo;
}


interface GroupMemberInfo {
  email: string;
  firstName: string;
  lastName: string;
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

// Common sender details
const senderName = process.env.EMAIL_SENDER_NAME || 'HivePay';
const senderEmail = process.env.EMAIL_SENDER_EMAIL || 'support@hivepayapp.com';

// Common font and colors
const fontFamily = "'Inter', Arial, sans-serif";
const primaryColor = "#F59E0B";
const textColor = "#374151";
const subtleBg = "#F9FAFB";
const borderColor = "#E5E7EB";
const headingColor = "#000000";
const footerColor = "#6B7280";

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

export async function sendCancellationReminderEmail({
  email,
  firstName,
  lastName,
  periodEnd,
}: CancellationReminderEmailParams): Promise<void> {
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  const formattedPeriodEnd = periodEnd.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  const htmlContent = `
    <div style="font-family: ${fontFamily}; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px; border-radius: 8px;">
      <h2 style="color: ${headingColor}; font-size: 24px; margin-bottom: 10px;">Subscription Ending Soon</h2>
      
      <p style="color: ${textColor}; font-size: 16px;">Hi ${firstName},</p>
      
      <p style="color: ${textColor}; font-size: 14px;">
        We wanted to remind you that your subscription will end on <strong>${formattedPeriodEnd}</strong>.
      </p>
      
      <p style="color: ${textColor}; font-size: 14px;">
        If you wish to continue enjoying our services, you can renew your subscription at any time.
      </p>
      
      <p style="color: ${textColor}; font-size: 14px;">Thank you for being a valued member of HivePay!</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid ${borderColor};">
        <p style="color: ${footerColor}; font-size: 12px; margin: 0;">Best regards,<br>${senderName} Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = { name: senderName, email: senderEmail };
  sendSmtpEmail.to = [{ email: email, name: `${firstName} ${lastName}` }];
  sendSmtpEmail.subject = `Your Subscription is Ending Soon`;
  sendSmtpEmail.htmlContent = htmlContent;

  try {
    await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log(`Cancellation reminder email sent to ${email}`);
  } catch (error) {
    console.error(`Failed to send cancellation reminder email to ${email}:`, error);
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
          <a href="https://hivepayapp.com/dashboard" style="color: ${primaryColor}; text-decoration: none; font-weight: 500;">HivePay Dashboard</a> 
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