import nodemailer from "nodemailer";

// ─── Resend API (Primary - uses HTTPS port 443, works on Render free tier) ──
async function sendViaResend(
  email: string,
  subject: string,
  html: string,
  text: string
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  try {
    console.log("[Email] Using Resend API to send email...");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SupplyGrid Network <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
        text,
      }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      console.error("[Resend] API error:", data);
      return false;
    }

    console.log(`[Resend] Email sent successfully! ID: ${data.id}`);
    return true;
  } catch (err) {
    console.error("[Resend] Failed to send email:", err);
    return false;
  }
}

// ─── JSON Transport fallback (logs OTP to server logs) ──────────────────────
async function sendViaJsonLog(
  email: string,
  subject: string,
  text: string,
  otp: string
): Promise<boolean> {
  console.log("[Email] No Resend API key found. Using JSON Transport fallback.");
  const client = nodemailer.createTransport({ jsonTransport: true });
  const info = await client.sendMail({
    from: '"SupplyGrid Network" <noreply@supplygrid.com>',
    to: email,
    subject,
    text,
  });
  console.log(`[Email OTP sent via log] Target: ${email} | Code: ${otp}`);
  if (info.message) {
    console.log(`[Email JSON Output]: ${info.message}`);
  }
  return true;
}

// ─── Main exported function ──────────────────────────────────────────────────
export async function sendEmailOtp(
  email: string,
  otp: string,
  type: "wholesaler" | "retailer" = "wholesaler"
): Promise<boolean> {
  const roleLabel = type === "retailer" ? "Retailer" : "Wholesaler";
  const bodyText =
    type === "retailer"
      ? "Thank you for registering as a Retailer on the SupplyGrid B2B supply chain platform."
      : "Thank you for registering as a Wholesaler on the SupplyGrid Wholesale B2B supply chain platform.";

  const subject = `SupplyGrid ${roleLabel} Verification Code`;
  const text = `Your 6-digit verification code is: ${otp}. This code will expire in 5 minutes.`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; max-width: 500px;">
      <h2 style="color: #ea580c; text-align: center;">SupplyGrid ${roleLabel} Verification</h2>
      <p>Hello,</p>
      <p>${bodyText}</p>
      <p>Please enter the following 6-digit verification code to complete your signup process:</p>
      <div style="background-color: #f3f4f6; border-radius: 4px; padding: 15px; text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; font-family: monospace; color: #111827;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 12px; text-align: center;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  // Try Resend first (HTTPS - works on Render free tier)
  if (process.env.RESEND_API_KEY) {
    const sent = await sendViaResend(email, subject, html, text);
    if (sent) return true;
    // If Resend fails, fall through to JSON log
    console.log("[Email] Resend failed, falling back to JSON log...");
  }

  // Fallback: print OTP in server logs
  return sendViaJsonLog(email, subject, text, otp);
}

export async function sendInquiryEmail(
  name: string,
  shopName: string | null,
  phone: string,
  email: string | null,
  message: string
): Promise<boolean> {
  const subject = `SupplyGrid Partner Inquiry from ${name}`;
  const text = `New Partner Inquiry received on SupplyGrid:
Name: ${name}
Shop Name: ${shopName || "N/A"}
Phone: ${phone}
Email: ${email || "N/A"}
Message: ${message}`;

  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; max-width: 500px;">
      <h2 style="color: #ea580c; text-align: center; border-bottom: 2px solid #ea580c; padding-bottom: 10px;">New Partner Inquiry</h2>
      <p>A new partnership inquiry has been submitted on the SupplyGrid B2B platform:</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
        <tr>
          <td style="padding: 6px 0; font-weight: bold; width: 120px; color: #4b5563;">Name:</td>
          <td style="padding: 6px 0; color: #1f2937;">${name}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Shop Name:</td>
          <td style="padding: 6px 0; color: #1f2937;">${shopName || "N/A"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Phone:</td>
          <td style="padding: 6px 0; color: #1f2937;">${phone}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: bold; color: #4b5563;">Email:</td>
          <td style="padding: 6px 0; color: #1f2937;">${email || "N/A"}</td>
        </tr>
      </table>
      <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-left: 4px solid #ea580c; border-radius: 4px;">
        <p style="margin: 0; font-weight: bold; color: #4b5563; margin-bottom: 8px;">Message:</p>
        <p style="margin: 0; color: #1f2937; white-space: pre-wrap;">${message}</p>
      </div>
      <p style="color: #9ca3af; font-size: 11px; margin-top: 25px; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 10px;">
        This notification was automatically dispatched via SupplyGrid Network.
      </p>
    </div>
  `;

  // Try Resend first (HTTPS - works on Render free tier)
  if (process.env.RESEND_API_KEY) {
    const sent = await sendViaResend("darshshiroya2006@gmail.com", subject, html, text);
    if (sent) return true;
    console.log("[Email] Resend failed for partner inquiry, falling back to log...");
  } else {
    console.log("[Email] No Resend API key found. Logging partner inquiry email.");
  }

  // Fallback to console log
  console.log(`[Email Inquiry Fallback Log] Target: darshshiroya2006@gmail.com | Subject: ${subject} | Phone: ${phone}`);
  return true;
}

export async function sendForgotPasswordOtp(
  email: string,
  otp: string
): Promise<boolean> {
  const subject = "SupplyGrid Password Reset Verification Code";
  const text = `Your 6-digit password reset code is: ${otp}. This code will expire in 5 minutes.`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px; max-width: 500px;">
      <h2 style="color: #ea580c; text-align: center;">SupplyGrid Password Reset</h2>
      <p>Hello,</p>
      <p>You requested to reset your password on the SupplyGrid platform.</p>
      <p>Please enter the following 6-digit verification code to proceed with resetting your password:</p>
      <div style="background-color: #f3f4f6; border-radius: 4px; padding: 15px; text-align: center; margin: 20px 0;">
        <span style="font-size: 24px; font-weight: bold; letter-spacing: 4px; font-family: monospace; color: #111827;">${otp}</span>
      </div>
      <p style="color: #6b7280; font-size: 12px; text-align: center;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
    </div>
  `;

  if (process.env.RESEND_API_KEY) {
    try {
      console.log("[Email] Using Resend API to send forgot password email...");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "SupplyGrid <onboarding@resend.dev>",
          to: [email],
          subject,
          html,
          text,
        }),
      });

      const data = await response.json() as any;
      if (response.ok) {
        console.log(`[Resend] Forgot password email sent successfully! ID: ${data.id}`);
        return true;
      }
      console.error("[Resend] API error:", data);
    } catch (err) {
      console.error("[Resend] Failed to send forgot password email:", err);
    }
  }

  // Fallback to JSON Transport log
  console.log(`[Email Forgot Password OTP sent via log] Target: ${email} | Code: ${otp}`);
  return true;
}