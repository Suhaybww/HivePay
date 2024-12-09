import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as SibApiV3Sdk from '@getbrevo/brevo';

// Initialize Brevo
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const apiKey = process.env.BREVO_API_KEY;
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, apiKey || '');

function wrapText(text: string, font: any, fontSize: number, maxWidth: number) {
  const words = text.split(' ');
  let lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (lineWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function generateContractPDF(contractData: {
  groupName: string;
  userName: string;
  contributionAmount: string;
  payoutFrequency: string;
  signedAt: Date;
}) {
  const pdfDoc = await PDFDocument.create();
  const [regularFont, italicFont] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaOblique),
  ]);

  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const margin = 50;
  const maxWidth = width - 2 * margin;
  let y = height - margin;

  const titleFontSize = 20;
  const headingFontSize = 14;
  const bodyFontSize = 12;
  const lineSpacing = 16;

  // Colors
  const black = rgb(0, 0, 0);
  const yellow400 = rgb(1, 0.84, 0);

  // Title
  page.drawText('HIVEPAY ROSCA GROUP CONTRACT', {
    x: margin,
    y,
    size: titleFontSize,
    font: regularFont,
    color: yellow400,
  });
  y -= titleFontSize + 1.5 * lineSpacing;

  // Introduction
  const introText = `This legally binding agreement is entered into on ${contractData.signedAt.toLocaleDateString(
    'en-AU',
    { timeZone: 'Australia/Sydney' }
  )} in accordance with Australian laws, between:`;

  wrapText(introText, italicFont, bodyFontSize, maxWidth).forEach((line) => {
    page.drawText(line, { x: margin, y, size: bodyFontSize, font: italicFont, color: black });
    y -= lineSpacing;
  });
  y -= lineSpacing;

  // Member Details
  const details = [
    `Member Name: ${contractData.userName}`,
    `Group Name: ${contractData.groupName}`,
  ];

  details.forEach((detail) => {
    page.drawText(detail, { x: margin, y, size: bodyFontSize, font: regularFont, color: black });
    y -= lineSpacing;
  });
  y -= lineSpacing;

  // Terms and Conditions
  page.drawText('TERMS AND CONDITIONS:', {
    x: margin,
    y,
    size: headingFontSize,
    font: regularFont,
    color: yellow400,
  });
  y -= headingFontSize + lineSpacing;

  const terms = [
    `1. The member agrees to contribute AUD ${contractData.contributionAmount} on a ${contractData.payoutFrequency} basis.`,
    '2. Payments must be made on or before the due date to ensure the smooth operation of the group.',
    '3. The member acknowledges that withdrawing from the group after receiving their payout is prohibited, and they must continue contributing until the agreed cycle is complete.',
    '4. Non-compliance with payment schedules or withdrawal obligations will result in legal action, as governed by the relevant Australian contract laws.',
    '5. The member agrees to provide accurate and up-to-date contact and banking information to facilitate payments and payouts.',
    '6. Any disputes will be resolved under the jurisdiction of Australian courts.',
  ];

  terms.forEach((term) => {
    wrapText(term, regularFont, bodyFontSize, maxWidth).forEach((line) => {
      page.drawText(line, { x: margin, y, size: bodyFontSize, font: regularFont, color: black });
      y -= lineSpacing;
    });
    y -= lineSpacing;
  });

  // Signature Section
  const signature = [
    `Electronically signed by: ${contractData.userName}`,
    `Date: ${contractData.signedAt.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}`,
  ];

  signature.forEach((line) => {
    page.drawText(line, { x: margin, y, size: bodyFontSize, font: italicFont, color: black });
    y -= lineSpacing;
  });

  return await pdfDoc.save();
}

export async function sendContractEmail(
  userEmail: string,
  userName: string,
  pdfBuffer: Buffer,
  contractData: { contributionAmount: string; payoutFrequency: string }
) {
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.to = [{ email: userEmail, name: userName }];
  sendSmtpEmail.sender = { email: 'support@hivepayapp.com', name: 'HivePay Contracts' };
  sendSmtpEmail.subject = 'Your HivePay Group Contract';
  sendSmtpEmail.htmlContent = `
    <h1>Your HivePay Contract</h1>
    <p>Dear ${userName},</p>
    <p>Please find attached your signed contract for your HivePay ROSCA group. Below are the key highlights:</p>
    <ul>
      <li>You must contribute AUD ${contractData.contributionAmount} on a ${contractData.payoutFrequency} basis.</li>
      <li>Leaving after receiving your payout but before completing contributions is prohibited.</li>
      <li>Legal action may be taken for non-compliance.</li>
    </ul>
    <p>Keep this document for your records.</p>
  `;
  sendSmtpEmail.attachment = [
    {
      content: pdfBuffer.toString('base64'),
      name: 'HivePay_Group_Contract.pdf',
    },
  ];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    console.error('Error sending contract email:', error);
    throw error;
  }
}
