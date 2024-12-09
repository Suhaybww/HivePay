import * as brevo from '@getbrevo/brevo';

const brevoClient = new brevo.TransactionalEmailsApi();
brevoClient.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY || '');

interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  attachments?: { content: string; name: string }[];
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    // Set sender information
    sendSmtpEmail.sender = {
      name: process.env.EMAIL_SENDER_NAME || 'HivePay Support',
      email: process.env.EMAIL_SENDER_EMAIL || 'support@hivepayapp.com',
    };

    // Set recipient
    sendSmtpEmail.to = [{ email: options.to, name: options.toName || '' }];

    // Set subject and content
    sendSmtpEmail.subject = options.subject;
    sendSmtpEmail.htmlContent = options.htmlContent;

    // Add attachments if any
    if (options.attachments) {
      sendSmtpEmail.attachment = options.attachments.map((attachment) => ({
        content: attachment.content,
        name: attachment.name,
      }));
    }

    // Send email
    const response = await brevoClient.sendTransacEmail(sendSmtpEmail);
    console.log('Email sent successfully via Brevo API:', response);
  } catch (error) {
    console.error('Error sending email via Brevo API:', error);
    throw new Error('Failed to send email.');
  }
}
