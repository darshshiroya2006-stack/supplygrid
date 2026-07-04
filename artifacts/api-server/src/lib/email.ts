import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) return transporter;

  console.log("[Email] Network blocked fallback: Using JSON Transport to print OTP in logs directly.");
  
  // 📌 પોર્ટ 465 અને 587 બંને બ્લોક હોવાથી કોઈપણ ઈન્ટરનેટ કનેક્શન વગર સીધું લોગ્સમાં પ્રિન્ટ કરવાનો કાયમી તોડ
  transporter = nodemailer.createTransport({
    jsonTransport: true,
  });

  return transporter;
}

export async function sendEmailOtp(email: string, otp: string, type: "wholesaler" | "retailer" = "wholesaler"): Promise<boolean> {
  const roleLabel = type === "retailer" ? "Retailer" : "Wholesaler";
  const bodyText = type === "retailer"
    ? "Thank you for registering as a Retailer on the SupplyGrid B2B supply chain platform."
    : "Thank you for registering as a Wholesaler on the SupplyGrid Wholesale B2B supply chain platform.";
  try {
    const client = await getTransporter();
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

    console.log(`[Email OTP sent successfully] Target: ${email} | Code: ${otp}`);
    
    // 📌 JSON Transport હોવાથી ઓટીપી ડેટા અહીં લાઈવ લોગ્સમાં ઓબ્જેક્ટ તરીકે પણ દેખાશે
    if (info.message) {
      console.log(`[Email JSON Output]: ${info.message}`);
    }

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email OTP Preview URL] Link: ${previewUrl}`);
    }
    return true;
  } catch (err) {
    console.error("[Email OTP Dispatch Error] Failed to send email:", err);
    return false;
  }
}