/**
 * src/lib/contact-email.ts
 * 
 * No top-level references to BREVO_API_KEY or @getbrevo/brevo.
 * Everything is done inside the function at runtime.
 */

interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export async function sendContactFormEmails({ name, email, message }: ContactFormData) {
  // Check your environment variable inside the function:
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY || typeof BREVO_API_KEY !== "string") {
    // If you do NOT want to fail here, change this to a console.warn instead of an Error.
    throw new Error("BREVO_API_KEY is not properly configured");
  }

  // Dynamically import the library so Next.js doesn't parse it at build time.
  const brevo = await import("@getbrevo/brevo");
  const { TransactionalEmailsApi, TransactionalEmailsApiApiKeys, SendSmtpEmail } = brevo;

  // Now spin up the client with the API key
  const brevoClient = new TransactionalEmailsApi();
  brevoClient.setApiKey(TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

  try {
    // 1) Send notification to support team
    const supportEmail = new SendSmtpEmail();
    supportEmail.subject = `New Contact Form Submission from ${name}`;
    supportEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Contact Form Submission</h2>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Contact Details:</strong></p>
          <ul style="list-style: none; padding-left: 0;">
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
          </ul>
        </div>
        <div style="background-color: #fff; border: 1px solid #e1e1e1; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        </div>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 0.9em;">HivePay Contact Form Submission</p>
        </div>
      </div>
    `;
    supportEmail.sender = {
      name: "HivePay Contact Form",
      email: "support@hivepay.com.au",
    };
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
    userEmail.htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${name},</h2>
        <p>Thank you for reaching out to HivePay. We've received your message and will get back to you as soon as possible.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Your message:</strong></p>
          <p>${message}</p>
        </div>
        <p>We typically respond within 1-2 business days.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 0.9em;">Best regards,<br>HivePay Support Team</p>
        </div>
      </div>
    `;
    userEmail.sender = {
      name: "HivePay Support",
      email: "support@hivepay.com.au",
    };
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
