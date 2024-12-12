import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';
import * as SibApiV3Sdk from '@getbrevo/brevo';
import { ContractData } from '../types/contract';

// Initialize Brevo
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const apiKey = process.env.BREVO_API_KEY;
apiInstance.setApiKey(SibApiV3Sdk.TransactionalEmailsApiApiKeys.apiKey, apiKey || '');

/**
 * Helper class to manage PDF pages and text drawing with automatic page breaks.
 */
class PDFManager {
  private pdfDoc: PDFDocument;
  private currentPage: any;
  private y: number;
  private readonly margin: number;
  private readonly maxWidth: number;
  private readonly font: PDFFont;
  private readonly fontSize: number;
  private readonly lineSpacing: number;
  private readonly color: any;
  private readonly boldFont: PDFFont;
  private readonly italicFont: PDFFont;

  constructor(
    pdfDoc: PDFDocument,
    fonts: { regular: PDFFont; bold: PDFFont; italic: PDFFont },
    options: {
      margin: number;
      fontSize: number;
      lineSpacing: number;
      color: any;
    }
  ) {
    this.pdfDoc = pdfDoc;
    this.boldFont = fonts.bold;
    this.italicFont = fonts.italic;
    this.font = fonts.regular;
    this.margin = options.margin;
    this.fontSize = options.fontSize;
    this.lineSpacing = options.lineSpacing;
    this.color = options.color;

    // Initialize first page
    this.currentPage = this.pdfDoc.addPage();
    const { width, height } = this.currentPage.getSize();
    this.maxWidth = width - 2 * this.margin;
    this.y = height - this.margin;
  }

  /**
   * Adds a new page and resets the y-coordinate.
   */
  private addNewPage() {
    this.currentPage = this.pdfDoc.addPage();
    const { height } = this.currentPage.getSize();
    this.y = height - this.margin;
  }

  /**
   * Draws text on the current page, adding new pages as necessary.
   * @param text The text to draw.
   * @param options Drawing options including font, size, color, and indentation.
   */
  async drawText(text: string, options: {
    font: PDFFont;
    size: number;
    color: any;
    x: number;
  }) {
    const { font, size, color, x } = options;
    const lines = wrapText(text, font, size, this.maxWidth - (x - this.margin));

    for (const line of lines) {
      // Check if there's enough space for the next line; if not, add a new page
      if (this.y - size - this.lineSpacing < this.margin) {
        this.addNewPage();
      }
      this.currentPage.drawText(line, {
        x: x,
        y: this.y,
        size: size,
        font: font,
        color: color,
      });
      this.y -= this.lineSpacing;
    }
    // Add extra spacing after paragraphs
    this.y -= this.lineSpacing / 2;
  }
}

/**
 * Splits text into lines that fit within the specified width.
 * @param text The text to wrap.
 * @param font The font used.
 * @param fontSize The size of the font.
 * @param maxWidth The maximum width of a line.
 * @returns An array of lines.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const lineWidth = font.widthOfTextAtSize(testLine, fontSize);

    if (lineWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;

      // If a single word is longer than maxWidth, split the word
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        const splitWord = splitLongWord(word, font, fontSize, maxWidth);
        lines.push(...splitWord.slice(0, -1));
        currentLine = splitWord[splitWord.length - 1];
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Splits a word that exceeds the maximum width into smaller parts.
 * @param word The long word to split.
 * @param font The font used.
 * @param fontSize The size of the font.
 * @param maxWidth The maximum width of a line.
 * @returns An array of split parts.
 */
function splitLongWord(word: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const letters = word.split('');
  const parts: string[] = [];
  let currentPart = '';

  for (const letter of letters) {
    const testPart = currentPart + letter;
    const partWidth = font.widthOfTextAtSize(testPart, fontSize);

    if (partWidth <= maxWidth) {
      currentPart = testPart;
    } else {
      if (currentPart) {
        parts.push(currentPart);
      }
      currentPart = letter;
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  return parts;
}

/**
 * Generates the contract PDF with multi-page support.
 * @param contractData The data required to populate the contract.
 * @returns A Buffer containing the PDF data.
 */
export async function generateContractPDF(contractData: ContractData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const [regularFont, italicFont, boldFont] = await Promise.all([
    pdfDoc.embedFont(StandardFonts.Helvetica),
    pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    pdfDoc.embedFont(StandardFonts.HelveticaBold),
  ]);

  // Initialize PDF Manager with desired settings
  const pdfManager = new PDFManager(pdfDoc, { regular: regularFont, bold: boldFont, italic: italicFont }, {
    margin: 50,
    fontSize: 12,
    lineSpacing: 18,
    color: rgb(0, 0, 0), // Black color
  });

  // Colors
  const darkBlue = rgb(0, 0.2, 0.6);

  // Title
  await pdfManager.drawText('HivePay ROSCA Group Contract', {
    font: boldFont,
    size: 20,
    color: darkBlue,
    x: 50,
  });

  // Introduction
  const introText = `This Contract Agreement ("Agreement") is made and entered into on ${contractData.signedAt.toLocaleDateString(
    'en-AU',
    { timeZone: 'Australia/Sydney' }
  )}, by and between HivePay ("Provider") and ${contractData.userName} ("Member"), collectively referred to as the "Parties". This Agreement is governed by the laws of Australia, including but not limited to the Australian Contract Law and the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010).`;

  await pdfManager.drawText(introText, {
    font: italicFont,
    size: 12,
    color: rgb(0, 0, 0),
    x: 50,
  });

  // Recitals
  const recitals = [
    `WHEREAS, the Provider operates a Rotating Savings and Credit Association (ROSCA) group known as "${contractData.groupName}";`,
    'WHEREAS, the Member wishes to participate in the aforementioned ROSCA group under the terms and conditions set forth in this Agreement;',
    'NOW, THEREFORE, in consideration of the mutual covenants and promises herein contained, the Parties agree as follows:',
  ];

  for (const recital of recitals) {
    await pdfManager.drawText(recital, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70, // Indentation for recitals
    });
  }

  // Article 1: Definitions
  await pdfManager.drawText('1. Definitions', {
    font: boldFont,
    size: 14,
    color: darkBlue,
    x: 50,
  });

  const definitions = [
    '1.1 "Contribution Amount" refers to the periodic monetary amount that the Member agrees to contribute to the ROSCA group.',
    '1.2 "Payout Frequency" refers to the regular interval at which the payout is distributed to a Member.',
    '1.3 "Cycle" refers to the complete sequence of contributions and payouts within the ROSCA group.',
  ];

  for (const definition of definitions) {
    await pdfManager.drawText(definition, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70, // Indentation for definitions
    });
  }

  // Article 2: Contributions
  await pdfManager.drawText('2. Contributions', {
    font: boldFont,
    size: 14,
    color: darkBlue,
    x: 50,
  });

  const contributions = [
    `2.1 The Member agrees to contribute AUD ${contractData.contributionAmount} to the ROSCA group on a ${contractData.payoutFrequency} basis.`,
    '2.2 Contributions shall be made via the designated payment method provided by the Provider.',
    '2.3 Late or missed contributions may result in penalties as outlined in Article 5.',
  ];

  for (const clause of contributions) {
    await pdfManager.drawText(clause, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70, // Indentation for clauses
    });
  }

  // Article 3: Payouts
  await pdfManager.drawText('3. Payouts', {
    font: boldFont,
    size: 14,
    color: darkBlue,
    x: 50,
  });

  const payouts = [
    `3.1 Payouts shall be distributed to Members on a ${contractData.payoutFrequency} basis.`,
    '3.2 The order of payout distribution shall be determined by mutual agreement among Members at the inception of the ROSCA group.',
    '3.3 Once a payout has been received, the Member is obligated to continue contributions for the remainder of the Cycle.',
  ];

  for (const clause of payouts) {
    await pdfManager.drawText(clause, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70,
    });
  }

  // Article 4: Obligations and Compliance
  await pdfManager.drawText('4. Obligations and Compliance', {
    font: boldFont,
    size: 14,
    color: darkBlue,
    x: 50,
  });

  const obligations = [
    '4.1 The Member agrees to comply with all terms and conditions outlined in this Agreement.',
    '4.2 The Member shall provide accurate and up-to-date contact and banking information to facilitate timely contributions and payouts.',
    '4.3 The Member acknowledges that withdrawing from the ROSCA group after receiving their payout without completing their contributions is prohibited.',
  ];

  for (const clause of obligations) {
    await pdfManager.drawText(clause, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70,
    });
  }

  // Article 5: Penalties and Legal Actions
  await pdfManager.drawText('5. Penalties and Legal Actions', {
    font: boldFont,
    size: 14,
    color: darkBlue,
    x: 50,
  });

  const penalties = [
    '5.1 Failure to make timely contributions may result in penalties, including but not limited to additional fees or exclusion from future ROSCA groups.',
    '5.2 In the event of non-compliance with contribution obligations, the Provider reserves the right to initiate legal proceedings as permitted under the Australian Contract Law.',
    '5.3 The Member agrees to indemnify and hold harmless the Provider against any claims, damages, or liabilities arising from non-compliance.',
  ];

  for (const clause of penalties) {
    await pdfManager.drawText(clause, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70,
    });
  }

  // Article 6: Dispute Resolution
  await pdfManager.drawText('6. Dispute Resolution', {
    font: boldFont,
    size: 14,
    color: darkBlue,
    x: 50,
  });

  const disputes = [
    '6.1 Any disputes arising out of or in connection with this Agreement shall be resolved through amicable negotiations between the Parties.',
    '6.2 If a resolution cannot be reached through negotiation, the dispute shall be submitted to mediation under the rules of the Australian Centre for International Commercial Arbitration (ACICA).',
    '6.3 Should mediation fail, the dispute shall be finally resolved by arbitration in accordance with the laws of Australia.',
  ];

  for (const clause of disputes) {
    await pdfManager.drawText(clause, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70,
    });
  }

  // Article 7: Governing Law
  await pdfManager.drawText('7. Governing Law', {
    font: boldFont,
    size: 14,
    color: darkBlue,
    x: 50,
  });

  const governingLaw = [
    '7.1 This Agreement shall be governed by and construed in accordance with the laws of Australia.',
    '7.2 The Parties submit to the exclusive jurisdiction of the courts of Australia in respect of any dispute or matter arising out of this Agreement.',
  ];

  for (const clause of governingLaw) {
    await pdfManager.drawText(clause, {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 70,
    });
  }

  // Signature Section
  await pdfManager.drawText(
    'IN WITNESS WHEREOF, the Parties hereto have executed this Agreement as of the day and year first above written.',
    {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 50,
    }
  );

  // Member Signature
  await pdfManager.drawText('______________________________', {
    font: regularFont,
    size: 12,
    color: rgb(0, 0, 0),
    x: 50,
  });

  await pdfManager.drawText(`${contractData.userName}`, {
    font: italicFont,
    size: 12,
    color: rgb(0, 0, 0),
    x: 50,
  });

  await pdfManager.drawText(
    `Date: ${contractData.signedAt.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}`,
    {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 50,
    }
  );

  // Provider Signature Placeholder with Current Date
  await pdfManager.drawText('______________________________', {
    font: regularFont,
    size: 12,
    color: rgb(0, 0, 0),
    x: 50,
  });

  await pdfManager.drawText('HivePay Representative', {
    font: italicFont,
    size: 12,
    color: rgb(0, 0, 0),
    x: 50,
  });

  await pdfManager.drawText(
    `Date: ${new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })}`,
    {
      font: regularFont,
      size: 12,
      color: rgb(0, 0, 0),
      x: 50,
    }
  );

  return await pdfDoc.save();
}


/**
 * Sends the contract PDF via email using Brevo.
 * @param userEmail The recipient's email address.
 * @param userName The recipient's name.
 * @param pdfBuffer The PDF data as a Buffer.
 * @param contractData The data used to populate the contract.
 */
export async function sendContractEmail(
  userEmail: string,
  userName: string,
  pdfBuffer: Buffer,
  contractData: ContractData
) {
  // Debugging log to verify contractData
  console.log('Sending email with Contract Data:', contractData);

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

  sendSmtpEmail.to = [{ email: userEmail, name: userName }];
  
  // **Retain the original sender email**
  sendSmtpEmail.sender = { email: 'support@hivepayapp.com', name: 'HivePay Contracts' };
  
  sendSmtpEmail.subject = 'Your HivePay ROSCA Group Contract';
  
  // Updated email content using the same ContractData
  sendSmtpEmail.htmlContent = `
    <h1>Your HivePay ROSCA Group Contract</h1>
    <p>Dear ${userName},</p>
    <p>Attached to this email, you will find your signed contract for participating in the HivePay ROSCA group you're in. Below are the key highlights of the agreement:</p>
    <ul>
      <li><strong>Contribution Amount:</strong> AUD ${contractData.contributionAmount} on a ${contractData.payoutFrequency} basis.</li>
      <li><strong>Obligations:</strong> Continued contributions until the completion of the ROSCA cycle.</li>
      <li><strong>Legal Compliance:</strong> Governed by Australian laws with provisions for dispute resolution.</li>
    </ul>
    <p>Please review the attached contract carefully. If you have any questions or require further clarification, do not hesitate to <a href="mailto:support@hivepayapp.com">contact our support team</a>.</p>
    <p>Thank you for your participation.</p>
    <p>Best regards,<br/>HivePay Contracts Team</p>
  `;
  
  sendSmtpEmail.attachment = [
    {
      content: pdfBuffer.toString('base64'),
      name: 'HivePay_ROSCA_Group_Contract.pdf',
    },
  ];

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Contract email sent successfully to', userEmail);
  } catch (error) {
    console.error('Error sending contract email:', error);
    throw error;
  }
}