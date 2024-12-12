// src/lib/emailService.ts

import * as brevo from '@getbrevo/brevo';
import { TransactionalEmailsApi } from '@getbrevo/brevo';

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

export async function sendGroupPausedEmail({
  groupName,
  inactiveMembers,
  recipient,
}: GroupStatusEmailParams): Promise<void> {
  const sendSmtpEmail = new brevo.SendSmtpEmail();

  const inactiveMembersList = inactiveMembers.join(', ');
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Group Status Update: ${groupName}</h2>
      
      <p>Hi ${recipient.firstName},</p>
      
      <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0;">
        <p style="color: #9a3412; font-weight: bold;">Your group has been paused</p>
        <p>This is because the following member(s) no longer have an active subscription:</p>
        <p style="font-weight: bold;">${inactiveMembersList}</p>
      </div>

      <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">What this means:</h3>
        <ul>
          <li>All group activities are temporarily suspended</li>
          <li>No new contributions will be collected</li>
          <li>No payouts will be processed</li>
        </ul>
      </div>

      <div style="background-color: #f0fdf4; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="color: #166534; margin: 0;">
          <strong>The group will automatically resume when all members have active subscriptions.</strong>
        </p>
      </div>

      <p>If you have any questions, please contact our support team.</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #666;">Best regards,<br>HivePay Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = {
    name: process.env.EMAIL_SENDER_NAME || 'HivePay',
    email: process.env.EMAIL_SENDER_EMAIL || 'support@hivepayapp.com',
  };

  sendSmtpEmail.to = [
    {
      email: recipient.email,
      name: `${recipient.firstName} ${recipient.lastName}`,
    },
  ];

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

  const formattedPeriodEnd = periodEnd.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Subscription Ending Soon</h2>
      
      <p>Hi ${firstName},</p>
      
      <p>We wanted to remind you that your subscription will end on <strong>${formattedPeriodEnd}</strong>.</p>
      
      <p>If you wish to continue enjoying our services, you can renew your subscription at any time.</p>
      
      <p>Thank you for being a valued member of HivePay!</p>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p style="color: #666;">Best regards,<br>HivePay Team</p>
      </div>
    </div>
  `;

  sendSmtpEmail.sender = {
    name: process.env.EMAIL_SENDER_NAME || 'HivePay',
    email: process.env.EMAIL_SENDER_EMAIL || 'support@hivepayapp.com',
  };

  sendSmtpEmail.to = [
    {
      email: email,
      name: `${firstName} ${lastName}`,
    },
  ];

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
