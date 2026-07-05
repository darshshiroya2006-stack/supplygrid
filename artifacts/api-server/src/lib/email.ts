import nodemailer from "nodemailer";

function createSmtpTransporter(): nodemailer.Transporter | null {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    console.log("[Email] SMTP credentials found, configuring real SMTP Transporter with IPv4 (family: 4).");
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      family: 4,               // Force IPv4 because Render network does not support outgoing IPv6
      connectionTimeout: 5000, // 5 seconds
      greetingTimeout: 5000,   // 5 seconds
      socketTimeout: 5000,     // 5 seconds
    });
  }
  return null;
}

export async function sendEmailOtp(email: string, otp: string, type: "wholesaler" | "retailer" = "wholesaler"): Promise<boolean> {
  const roleLabel = type === "retailer" ? "Retailer" : "Wholesaler";
  const bodyText = type === "retailer"
    ? "Thank you for registering as a Retailer on the SupplyGrid B2B supply chain platform."
    : "Thank you for registering as a Wholesaler on the SupplyGrid Wholesale B2B supply chain platform.";

  let client = createSmtpTransporter();
  let usingRealSmtp = client !== null;

  if (!client) {
    console.log("[Email] SMTP credentials missing. Using JSON Transport fallback to print OTP in logs.");
    client = nodemailer.createTransport({
      jsonTransport: true,
    });
  }

  try {
    const info = await client.sendMail({
      from: '"SupplyGrid Network" <noreply@supplygrid.com>',
      to: email,
      subject: `SupplyGrid ${roleLabel} Verification Code`,
      text: `Your 6-digit verification code is: ${otp}. This code will expire in 5 minutes.`,
      html: `
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
      `,
    });

    console.log(`[Email OTP sent successfully] Target: ${email} | Code: ${otp} | Using Real SMTP: ${usingRealSmtp}`);
    
    if (!usingRealSmtp && info.message) {
      console.log(`[Email JSON Output]: ${info.message}`);
    }

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email OTP Preview URL] Link: ${previewUrl}`);
    }
    return true;
  } catch (err) {
    console.error("[Email OTP Dispatch Error] Failed to send email via primary transport:", err);
    
    if (usingRealSmtp) {
      console.log("[Email] Attempting fallback to JSON Transport...");
      try {
        const fallbackClient = nodemailer.createTransport({ jsonTransport: true });
        const info = await fallbackClient.sendMail({
          from: '"SupplyGrid Network" <noreply@supplygrid.com>',
          to: email,
          subject: `SupplyGrid ${roleLabel} Verification Code (Fallback)`,
          text: `Your 6-digit verification code is: ${otp}.`,
        });
        if (info.message) {
          console.log(`[Email JSON Output - Fallback]: ${info.message}`);
        }
        return true;
      } catch (fallbackErr) {
        console.error("[Email] Fallback transport also failed:", fallbackErr);
      }
    }
    return false;
  }
}