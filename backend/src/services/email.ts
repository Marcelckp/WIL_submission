import sgMail from "@sendgrid/mail";
import { downloadBlob } from "./firebaseStorage.js";

const sendgridApiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL;

// Email override for testing - set EMAIL_OVERRIDE_TO to override all recipient emails
// Set to empty string or remove to disable override
const emailOverrideTo = String(process.env.EMAIL_OVERRIDE_TO || "").trim();

// Initialize SendGrid
if (sendgridApiKey) {
  sgMail.setApiKey(sendgridApiKey);
}

// More detailed warning message
if (!sendgridApiKey || !fromEmail) {
  const missing: string[] = [];
  if (!sendgridApiKey) missing.push("SENDGRID_API_KEY");
  if (!fromEmail) missing.push("EMAIL_FROM");

  console.warn(
    `Email service not fully configured. Missing: ${missing.join(", ")}. ` +
      `Please set these in your .env file.`
  );
}

// Log override status
if (emailOverrideTo) {
  console.log(
    `[EMAIL OVERRIDE] All emails will be sent to: ${emailOverrideTo}`
  );
  console.warn(
    `[EMAIL OVERRIDE] Email override is ACTIVE. Remove EMAIL_OVERRIDE_TO from .env to send to actual customers.`
  );
}

export async function sendInvoiceEmail(options: {
  to: string | string[];
  subject: string;
  htmlBody: string;
  pdfBlobContainer?: string;
  pdfBlobPath?: string;
}): Promise<{ messageId?: string } | null> {
  if (!sendgridApiKey || !fromEmail) {
    console.warn("Email skipped: SendGrid not configured");
    return null;
  }

  // Get original recipient(s) before any override
  const originalToList = Array.isArray(options.to) ? options.to : [options.to];

  // Use the recipient email(s) provided - no override by default
  // EMAIL_OVERRIDE_TO can be set for testing, but should be removed for production
  let toList: string[];
  if (emailOverrideTo && emailOverrideTo.length > 0) {
    console.log(
      `[EMAIL OVERRIDE] Original recipient(s): ${originalToList.join(", ")}`
    );
    console.log(`[EMAIL OVERRIDE] Overriding to: ${emailOverrideTo}`);
    console.warn(
      `[EMAIL OVERRIDE] Email override is ACTIVE. Remove EMAIL_OVERRIDE_TO from .env to send to actual customers.`
    );
    toList = [emailOverrideTo];
  } else {
    toList = originalToList;
  }

  // Safety check: Prevent sending to the same email as the sender
  // This usually indicates a configuration error (wrong customer email or override set incorrectly)
  const senderEmailLower = fromEmail.toLowerCase().trim();
  const recipientEmailsLower = toList.map((email) =>
    email.toLowerCase().trim()
  );

  if (recipientEmailsLower.includes(senderEmailLower)) {
    const errorMsg =
      `Cannot send invoice email to sender address (${senderEmailLower}). ` +
      `Recipient email matches sender email. ` +
      `Please check: 1) invoice.customerEmail is set correctly, 2) EMAIL_OVERRIDE_TO is not set to sender email.`;
    console.error(`[EMAIL ERROR] ${errorMsg}`);
    console.error(
      `[EMAIL ERROR] Original recipient: ${originalToList.join(", ")}`
    );
    console.error(`[EMAIL ERROR] Final recipient: ${toList.join(", ")}`);
    console.error(`[EMAIL ERROR] Sender: ${fromEmail}`);
    throw new Error(errorMsg);
  }

  let attachments:
    | Array<{
        filename: string;
        content: string;
        type?: string;
      }>
    | undefined = undefined;

  if (options.pdfBlobContainer && options.pdfBlobPath) {
    try {
      const buffer = await downloadBlob(
        options.pdfBlobContainer,
        options.pdfBlobPath
      );
      // SendGrid expects base64 encoded content for attachments
      const base64Content = buffer.toString("base64");
      attachments = [
        {
          filename: options.pdfBlobPath.split("/").pop() || "invoice.pdf",
          content: base64Content,
          type: "application/pdf",
        },
      ];
    } catch (e) {
      console.error("Failed to download PDF for email attachment:", e);
      // Continue sending email without attachment if PDF download fails
      // This prevents the entire email from failing due to storage issues
      console.warn(
        "Email will be sent without PDF attachment due to download failure"
      );
    }
  }

  try {
    console.log(`[EMAIL] Sender: ${fromEmail}`);
    console.log(`[EMAIL] Recipient(s): ${toList.join(", ")}`);
    console.log(`[EMAIL] Subject: ${options.subject}`);

    const msg = {
      from: fromEmail,
      to: toList,
      subject: options.subject,
      html: options.htmlBody,
      attachments: attachments,
    };

    const [response] = await sgMail.send(msg);

    console.log(
      `[EMAIL] Email sent successfully. Message ID: ${response.headers["x-message-id"]}`
    );
    return { messageId: response.headers["x-message-id"] };
  } catch (error: any) {
    console.error("SendGrid API error:", error);
    if (error.response) {
      console.error("Error status:", error.response.statusCode);
      console.error(
        "Error details:",
        JSON.stringify(error.response.body, null, 2)
      );
    }
    throw new Error(error.message || "Failed to send email");
  }
}
