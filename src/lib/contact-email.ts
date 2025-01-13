// src/lib/contact-email.ts
import * as brevo from '@getbrevo/brevo';
import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } from '@getbrevo/brevo';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
if (!BREVO_API_KEY || typeof BREVO_API_KEY !== 'string') {
 throw new Error('BREVO_API_KEY is not properly configured');
}

// Initialize Brevo client
const brevoClient = new TransactionalEmailsApi();
brevoClient.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

// Instead, do the import and checks inside sendContactFormEmails:
export async function sendContactFormEmails({ name, email, message }: ContactFormData) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY || typeof BREVO_API_KEY !== 'string') {
    throw new Error('BREVO_API_KEY is not properly configured');
  }

 // Lazy import the Brevo client only when needed
 const brevo = await import('@getbrevo/brevo');
 const { TransactionalEmailsApi, TransactionalEmailsApiApiKeys } = brevo;

  // Now spin up the client
  const brevoClient = new TransactionalEmailsApi();
  brevoClient.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

  try {
    // ... same code as before:
    const supportEmail = new brevo.SendSmtpEmail();
    // fill in fields...
    await brevoClient.sendTransacEmail(supportEmail);

    const userEmail = new brevo.SendSmtpEmail();
    // fill in fields...
    await brevoClient.sendTransacEmail(userEmail);

    return { success: true };
  } catch (error) {
    console.error('Failed to send contact form emails:', error);
    throw error;
  }
}
