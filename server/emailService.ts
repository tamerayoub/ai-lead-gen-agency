import nodemailer from "nodemailer";

export interface InvitationEmailData {
  email: string;
  inviterName: string;
  organizationName: string;
  role: string;
  invitationToken: string;
  expiresAt: Date;
}

function getRoleName(role: string): string {
  const roleNames: Record<string, string> = {
    admin: "Admin",
    property_manager: "Property Manager",
    leasing_agent: "Leasing Agent",
    owner_portal: "Owner",
  };
  return roleNames[role] || role;
}

// Get base URL for emails (same logic as welcome emails)
function getBaseUrlForInvitationEmail(): string {
  // CRITICAL: Detect local development first - skip production domain checks
  const isLocalDev = !process.env.REPLIT_DEPLOYMENT && 
                     process.env.NODE_ENV !== 'production' &&
                     !process.env.REPL_ID;
  
  if (isLocalDev) {
    console.log(`[Email] [getBaseUrlForInvitationEmail] Local development detected - using localhost`);
    return 'http://localhost:5000';
  }
  
  // Production domain (app subdomain for invitations)
  if (process.env.APP_DOMAIN) {
    const domain = process.env.APP_DOMAIN.replace(/^https?:\/\//, '');
    console.log(`[Email] [getBaseUrlForInvitationEmail] Using APP_DOMAIN: ${domain}`);
    return `https://${domain}`;
  }
  
  // Production domain (marketing domain fallback)
  if (process.env.PRODUCTION_DOMAIN) {
    const domain = process.env.PRODUCTION_DOMAIN.replace(/^https?:\/\//, '');
    // Use app subdomain if available, otherwise marketing domain
    if (domain.includes('lead2lease.ai')) {
      console.log(`[Email] [getBaseUrlForInvitationEmail] Using PRODUCTION_DOMAIN with app subdomain: app.lead2lease.ai`);
      return 'https://app.lead2lease.ai';
    }
    console.log(`[Email] [getBaseUrlForInvitationEmail] Using PRODUCTION_DOMAIN: ${domain}`);
    return `https://${domain}`;
  }
  
  // Public URL (if explicitly set)
  if (process.env.PUBLIC_URL) {
    console.log(`[Email] [getBaseUrlForInvitationEmail] Using PUBLIC_URL: ${process.env.PUBLIC_URL}`);
    return process.env.PUBLIC_URL;
  }
  
  // Replit dev domain (for development)
  if (process.env.REPLIT_DEV_DOMAIN) {
    console.log(`[Email] [getBaseUrlForInvitationEmail] Using REPLIT_DEV_DOMAIN: ${process.env.REPLIT_DEV_DOMAIN}`);
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Replit deployment (only if no production domain is set)
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    const replUrl = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
    console.log(`[Email] [getBaseUrlForInvitationEmail] Using Replit workspace URL: ${replUrl}`);
    return replUrl;
  }
  
  // Default to localhost for local development
  console.log(`[Email] [getBaseUrlForInvitationEmail] Using default localhost`);
  return 'http://localhost:5000';
}

function getInvitationEmailHTML(data: InvitationEmailData): string {
  const baseUrl = getBaseUrlForInvitationEmail();
  const acceptUrl = `${baseUrl}/accept-invitation/${data.invitationToken}`;
  const expiryDate = new Date(data.expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      padding: 20px 30px;
      text-align: center;
    }
    .header h1 {
      color: #ffffff;
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .content p {
      margin: 0 0 20px;
      color: #555;
    }
    .role-badge {
      display: inline-block;
      background: #f0f0f0;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 600;
      color: #2563eb;
      margin: 10px 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
      transition: transform 0.2s;
      border: none;
    }
    .button:hover {
      transform: translateY(-2px);
    }
    .expiry-notice {
      background: #fff9e6;
      border-left: 4px solid #ffc107;
      padding: 12px 16px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .expiry-notice p {
      margin: 0;
      color: #856404;
      font-size: 14px;
    }
    .footer {
      background: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      border-top: 1px solid #e9ecef;
    }
    .footer p {
      margin: 0;
      color: #6c757d;
      font-size: 14px;
    }
    .link-text {
      color: #667eea;
      word-break: break-all;
      font-size: 12px;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Team Invitation</h1>
    </div>
    
    <div class="content">
      <p>Hello!</p>
      
      <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on Lead2Lease.</p>
      
      <p>You've been invited to join as: <span class="role-badge" style="display: inline-block; background: #f0f0f0; padding: 6px 12px; border-radius: 4px; font-weight: 600; color: #2563eb; margin-left: 8px;">${getRoleName(data.role)}</span></p>
      
      <p>Click the button below to accept your invitation and create your account:</p>
      
      <div style="text-align: center;">
        <a href="${acceptUrl}" class="button">Accept Invitation</a>
      </div>
      
      <div class="expiry-notice">
        <p>This invitation expires on <strong>${expiryDate}</strong></p>
      </div>
      
      <p style="margin-top: 30px; font-size: 14px; color: #6c757d;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p class="link-text">${acceptUrl}</p>
    </div>
    
    <div class="footer">
      <p>Powered by, Lead2Lease - AI-Powered Leasing Automation Software</p>
      <p style="margin-top: 8px;">This invitation was sent by ${data.inviterName}</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function getInvitationEmailText(data: InvitationEmailData): string {
  const baseUrl = getBaseUrlForInvitationEmail();
  const acceptUrl = `${baseUrl}/accept-invitation/${data.invitationToken}`;
  const expiryDate = new Date(data.expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return `
Team Invitation to Lead2Lease

Hello!

${data.inviterName} has invited you to join ${data.organizationName} on Lead2Lease.

You've been invited to join as: ${getRoleName(data.role)}

Click the link below to accept your invitation and create your account:
${acceptUrl}

This invitation expires on ${expiryDate}

---
Powered by, Lead2Lease - AI-Powered Leasing Automation Software
This invitation was sent by ${data.inviterName}
  `.trim();
}

// Create transporter function (same pattern as reminder emails)
export function getTransporter() {
  const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";
  const emailPassword = process.env.EMAIL_PASSWORD;
  
  console.log("[Email] [getTransporter] ===== Creating transporter ===== ");
  console.log("[Email] [getTransporter] EMAIL_USER from env:", process.env.EMAIL_USER || "NOT SET (using default)");
  console.log("[Email] [getTransporter] EMAIL_USER value:", emailUser);
  console.log("[Email] [getTransporter] EMAIL_PASSWORD exists:", !!emailPassword);
  console.log("[Email] [getTransporter] EMAIL_PASSWORD length:", emailPassword ? emailPassword.length : 0);
  console.log("[Email] [getTransporter] EMAIL_PASSWORD first 3 chars:", emailPassword ? emailPassword.substring(0, 3) + "..." : "N/A");
  
  if (!emailPassword) {
    console.error("[Email] [getTransporter] ⚠️ EMAIL_PASSWORD not set - cannot send invitation email");
    return null;
  }
  
  const transporterConfig = {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  };
  
  console.log("[Email] [getTransporter] Transporter config:", {
    host: transporterConfig.host,
    port: transporterConfig.port,
    secure: transporterConfig.secure,
    auth: {
      user: transporterConfig.auth.user,
      pass: transporterConfig.auth.pass ? `[${transporterConfig.auth.pass.length} chars]` : "NOT SET",
    },
  });
  
  // Validate password format (Gmail App Passwords are 16 characters, regular passwords vary)
  if (emailPassword && emailPassword.length === 16 && /^[a-z]{4}-[a-z]{4}-[a-z]{4}-[a-z]{4}$/i.test(emailPassword)) {
    console.log("[Email] [getTransporter] ✅ Password format matches Gmail App Password format (16 chars with dashes)");
  } else if (emailPassword) {
    console.log("[Email] [getTransporter] ⚠️ Password format does not match typical Gmail App Password format");
    console.log("[Email] [getTransporter] ⚠️ If 2FA is enabled, you MUST use a Gmail App Password");
    console.log("[Email] [getTransporter] ⚠️ Get one at: https://myaccount.google.com/apppasswords");
  }
  
  try {
    const transporter = nodemailer.createTransport(transporterConfig);
    console.log("[Email] [getTransporter] ✅ Transporter created successfully");
    return transporter;
  } catch (error) {
    console.error("[Email] [getTransporter] ❌ Failed to create transporter:", error);
    if (error instanceof Error) {
      console.error("[Email] [getTransporter] Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }
    return null;
  }
}

export async function sendInvitationEmail(
  data: InvitationEmailData
): Promise<void> {
  const startTime = Date.now();
  console.log(`[Email] [sendInvitationEmail] ===== STARTING INVITATION EMAIL SEND =====`);
  console.log(`[Email] [sendInvitationEmail] Timestamp: ${new Date().toISOString()}`);
  console.log(`[Email] [sendInvitationEmail] Recipient email: ${data.email}`);
  console.log(`[Email] [sendInvitationEmail] Organization: ${data.organizationName}`);
  console.log(`[Email] [sendInvitationEmail] Inviter: ${data.inviterName}`);
  console.log(`[Email] [sendInvitationEmail] Role: ${data.role}`);
  
  try {
    const emailPassword = process.env.EMAIL_PASSWORD;
    const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";
    
    console.log(`[Email] [sendInvitationEmail] Step 1: Checking environment variables`);
    console.log(`[Email] [sendInvitationEmail] EMAIL_PASSWORD exists: ${!!emailPassword}`);
    console.log(`[Email] [sendInvitationEmail] EMAIL_PASSWORD type: ${typeof emailPassword}`);
    console.log(`[Email] [sendInvitationEmail] EMAIL_USER: ${emailUser}`);
    console.log(`[Email] [sendInvitationEmail] EMAIL_USER source: ${process.env.EMAIL_USER ? 'from env' : 'default'}`);
    
    if (!emailPassword) {
      console.error("[Email] [sendInvitationEmail] ❌ EMAIL_PASSWORD environment variable is not set");
      throw new Error("EMAIL_PASSWORD environment variable is not set");
    }

    console.log(`[Email] [sendInvitationEmail] Step 2: Getting transporter`);
    const transporter = getTransporter();
    if (!transporter) {
      console.error(`[Email] [sendInvitationEmail] ❌ Cannot send invitation - transporter not available`);
      throw new Error("EMAIL_PASSWORD environment variable is not set");
    }
    console.log(`[Email] [sendInvitationEmail] ✅ Transporter obtained successfully`);

    console.log(`[Email] [sendInvitationEmail] Step 3: Generating email content`);
    const baseUrl = getBaseUrlForInvitationEmail();
    console.log(`[Email] [sendInvitationEmail] Base URL for invitation link: ${baseUrl}`);
    console.log(`[Email] [sendInvitationEmail] Environment check:`, {
      REPL_SLUG: process.env.REPL_SLUG,
      REPL_OWNER: process.env.REPL_OWNER,
      APP_DOMAIN: process.env.APP_DOMAIN,
      PRODUCTION_DOMAIN: process.env.PRODUCTION_DOMAIN,
      PUBLIC_URL: process.env.PUBLIC_URL,
      REPLIT_DEV_DOMAIN: process.env.REPLIT_DEV_DOMAIN,
    });
    const htmlBody = getInvitationEmailHTML(data);
    const textBody = getInvitationEmailText(data);
    console.log(`[Email] [sendInvitationEmail] HTML body length: ${htmlBody.length} chars`);
    console.log(`[Email] [sendInvitationEmail] Text body length: ${textBody.length} chars`);

    console.log(`[Email] [sendInvitationEmail] Step 4: Preparing email message`);
    const mailOptions = {
      from: `"Lead2Lease" <${emailUser}>`,
      to: data.email,
      subject: `You're invited to join ${data.organizationName} on Lead2Lease`,
      text: textBody,
      html: htmlBody,
    };
    console.log(`[Email] [sendInvitationEmail] Mail options:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      textLength: mailOptions.text.length,
      htmlLength: mailOptions.html.length,
    });

    console.log(`[Email] [sendInvitationEmail] Step 5: Attempting to send email via SMTP`);
    console.log(`[Email] [sendInvitationEmail] SMTP host: smtp.gmail.com`);
    console.log(`[Email] [sendInvitationEmail] SMTP port: 587`);
    console.log(`[Email] [sendInvitationEmail] SMTP secure: false`);
    
    const sendStartTime = Date.now();
    const info = await transporter.sendMail(mailOptions);
    const sendDuration = Date.now() - sendStartTime;
    
    console.log(`[Email] [sendInvitationEmail] ===== EMAIL SENT SUCCESSFULLY =====`);
    console.log(`[Email] [sendInvitationEmail] ✅ Invitation email sent successfully to ${data.email}`);
    console.log(`[Email] [sendInvitationEmail] Message ID: ${info.messageId}`);
    console.log(`[Email] [sendInvitationEmail] Response: ${JSON.stringify(info.response || 'No response')}`);
    console.log(`[Email] [sendInvitationEmail] Send duration: ${sendDuration}ms`);
    console.log(`[Email] [sendInvitationEmail] Total duration: ${Date.now() - startTime}ms`);
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error(`[Email] [sendInvitationEmail] ===== EMAIL SEND FAILED =====`);
    console.error(`[Email] [sendInvitationEmail] ❌ Failed to send invitation email`);
    console.error(`[Email] [sendInvitationEmail] Error duration: ${errorDuration}ms`);
    console.error(`[Email] [sendInvitationEmail] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    
    if (error instanceof Error) {
      console.error(`[Email] [sendInvitationEmail] Error message: ${error.message}`);
      console.error(`[Email] [sendInvitationEmail] Error stack:`, error.stack);
      
      // Check for specific error types
      if ('code' in error) {
        console.error(`[Email] [sendInvitationEmail] Error code: ${(error as any).code}`);
      }
      if ('command' in error) {
        console.error(`[Email] [sendInvitationEmail] Error command: ${(error as any).command}`);
      }
      if ('response' in error) {
        console.error(`[Email] [sendInvitationEmail] Error response: ${JSON.stringify((error as any).response)}`);
      }
      if ('responseCode' in error) {
        console.error(`[Email] [sendInvitationEmail] Error response code: ${(error as any).responseCode}`);
      }
    } else {
      console.error(`[Email] [sendInvitationEmail] Unknown error object:`, error);
    }
    
    // Provide helpful error message for Gmail authentication issues
    let errorMessage = `Failed to send invitation email: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    if (error instanceof Error && error.message.includes('Invalid login') && error.message.includes('535-5.7.8')) {
      errorMessage += '\n\n⚠️ Gmail Authentication Error:\n';
      errorMessage += 'This error typically means:\n';
      errorMessage += '1. The EMAIL_PASSWORD is incorrect or expired\n';
      errorMessage += '2. If 2FA is enabled on lead2leaseai@gmail.com, you MUST use an App Password (not your regular password)\n';
      errorMessage += '3. To create an App Password:\n';
      errorMessage += '   - Go to https://myaccount.google.com/apppasswords\n';
      errorMessage += '   - Sign in to your Google Account\n';
      errorMessage += '   - Select "Mail" and "Other (Custom name)" as the app\n';
      errorMessage += '   - Enter "Lead2Lease SMTP" as the name\n';
      errorMessage += '   - Click "Generate" and copy the 16-character password\n';
      errorMessage += '   - Use this App Password as your EMAIL_PASSWORD environment variable\n';
      errorMessage += '4. Make sure "Less secure app access" is enabled (if 2FA is not enabled)\n';
      errorMessage += '5. Check if the account is locked or has security restrictions\n';
      console.error(`[Email] [sendInvitationEmail] ${errorMessage}`);
    }
    
    throw new Error(errorMessage);
  }
}
