import { Resend } from "resend";
import { downloadBlob } from "./firebaseStorage.js";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL;

// Email override for testing - set EMAIL_OVERRIDE_TO to override all recipient emails
// Set to empty string or remove to disable override
const emailOverrideTo = String(
  process.env.EMAIL_OVERRIDE_TO || process.env.DEFAULT_INVOICE_EMAIL_TO || ""
).trim();

// More detailed warning message
if (!resendApiKey || !fromEmail) {
  const missing: string[] = [];
  if (!resendApiKey) missing.push("RESEND_API_KEY");
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
  console.log(
    `[EMAIL OVERRIDE] To disable, remove EMAIL_OVERRIDE_TO from .env`
  );
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendInvoiceEmail(options: {
  to: string | string[];
  subject: string;
  htmlBody: string;
  pdfBlobContainer?: string;
  pdfBlobPath?: string;
}): Promise<{ messageId?: string } | null> {
  if (!resend || !fromEmail) {
    console.warn("Email skipped: Resend not configured");
    return null;
  }

  // Override recipient email if EMAIL_OVERRIDE_TO is set
  let toList: string[];
  if (emailOverrideTo && emailOverrideTo.length > 0) {
    const originalTo = Array.isArray(options.to) ? options.to : [options.to];
    console.log(
      `[EMAIL OVERRIDE] Overriding recipient(s) ${originalTo.join(", ")} -> ${emailOverrideTo}`
    );
    toList = [emailOverrideTo];
  } else {
    toList = Array.isArray(options.to) ? options.to : [options.to];
  }

  let attachments:
    | Array<{
        filename: string;
        content: Buffer | string;
        contentType?: string;
      }>
    | undefined = undefined;

  if (options.pdfBlobContainer && options.pdfBlobPath) {
    try {
      const buffer = await downloadBlob(
        options.pdfBlobContainer,
        options.pdfBlobPath
      );
      // Resend expects base64 encoded content for attachments
      const base64Content = buffer.toString("base64");
      attachments = [
        {
          filename: options.pdfBlobPath.split("/").pop() || "invoice.pdf",
          content: base64Content,
          contentType: "application/pdf",
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
    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      attachments?: Array<{
        filename: string;
        content: string;
      }>;
    } = {
      from: fromEmail,
      to: toList,
      subject: options.subject,
      html: options.htmlBody,
    };

    // Add attachments if available
    if (attachments && attachments.length > 0) {
      emailPayload.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content as string, // Already base64 encoded
      }));
    }

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      console.error("Resend API error:", error);
      throw new Error(error.message || "Failed to send email");
    }

    return { messageId: data?.id };
  } catch (error) {
    console.error("Email send failed:", error);
    throw error;
  }
}
