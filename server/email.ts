import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { generateCalendarInvite } from "../shared/calendarInvite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the base URL for email links based on environment
 * Priority: REPL_SLUG > PRODUCTION_DOMAIN > PUBLIC_URL > localhost
 */
function getBaseUrlForEmail(): string {
  // Replit deployment
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  
  // Production domain
  if (process.env.PRODUCTION_DOMAIN) {
    const domain = process.env.PRODUCTION_DOMAIN.replace(/^https?:\/\//, '');
    return `https://${domain}`;
  }
  
  // Public URL (if explicitly set)
  if (process.env.PUBLIC_URL) {
    return process.env.PUBLIC_URL;
  }
  
  // Default to localhost for local development
  return 'http://localhost:5000';
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "lead2leaseai@gmail.com",
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Lead2Lease logo - loaded from base64 file for CID attachment (Gmail blocks data URIs)
let LOGO_BASE64_CONTENT = '';

function loadLogoBase64(): string {
  if (LOGO_BASE64_CONTENT) return LOGO_BASE64_CONTENT;
  
  const possiblePaths = [
    path.join(__dirname, 'logo-base64.txt'),
    path.join(process.cwd(), 'server', 'logo-base64.txt'),
    path.resolve('./server/logo-base64.txt'),
  ];
  
  for (const logoPath of possiblePaths) {
    try {
      if (fs.existsSync(logoPath)) {
        const content = fs.readFileSync(logoPath, 'utf8').trim();
        if (content && content.length > 100) {
          console.log('[Email] Logo base64 loaded from:', logoPath, 'length:', content.length);
          LOGO_BASE64_CONTENT = content;
          return LOGO_BASE64_CONTENT;
        }
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  console.warn('[Email] Logo base64 file not found in any expected location');
  return '';
}

// Get the complete footer logo section with "Powered by" text
// Only renders if logo is available, otherwise returns empty string (no visual gap)
// Uses onerror to hide the entire logo container if CID attachment fails to load
function getFooterLogoSection(): string {
  const logoBase64 = loadLogoBase64();
  if (logoBase64) {
    return `
      <div style="margin-top: 15px;" id="logo-section">
        <p style="margin-bottom: 5px; color: #94a3b8; font-size: 12px;">Powered by</p>
        <img src="cid:lead2lease-logo" alt="Lead2Lease" onerror="this.parentElement.style.display='none'" style="max-width: 150px; height: auto;" />
      </div>`;
  }
  // Return empty string if logo not available - no "Powered by" either
  return '';
}

function getLogoAttachment(): { filename: string; content: Buffer; cid: string; contentType: string } | null {
  const logoBase64 = loadLogoBase64();
  if (!logoBase64) return null;
  
  return {
    filename: 'logo.svg',
    content: Buffer.from(logoBase64, 'base64'),
    cid: 'lead2lease-logo',
    contentType: 'image/svg+xml',
  };
}

export async function sendAppointmentConfirmation(appointment: {
  firstName: string;
  lastName: string;
  email: string;
  appointmentDate: string;
  appointmentTime: string;
  phone?: string;
  company?: string;
  notes?: string;
}) {
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const dateObj = new Date(appointment.appointmentDate);
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const leadEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2560E8 0%, #2560E8 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .appointment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Your Demo is Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${appointment.firstName},</p>
          <p>Thank you for scheduling a demo with Lead2Lease! We're excited to show you how our AI-powered property management platform can transform your business.</p>
          
          <div class="appointment-details">
            <h2 style="margin-top: 0; color: #2563eb;">Appointment Details</h2>
            <div class="detail-row">
              <span class="label">Date:</span> <span class="value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> <span class="value">${formatTime(appointment.appointmentTime)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Duration:</span> <span class="value">30 minutes</span>
            </div>
            ${appointment.company ? `<div class="detail-row"><span class="label">Company:</span> <span class="value">${appointment.company}</span></div>` : ''}
          </div>

          <h3>What to Expect:</h3>
          <ul>
            <li>Live demonstration of our AI-powered lead qualification system</li>
            <li>Discussion of your specific property management needs</li>
            <li>Q&A session tailored to your requirements</li>
            <li>Pricing and implementation timeline overview</li>
          </ul>

          <p><strong>Need to reschedule?</strong> Simply reply to this email or call us.</p>
          
          <div class="footer">
            <p>Lead2Lease - AI-Powered Property Management</p>
            <p>Email: lead2leaseai@gmail.com</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const adminEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .prospect-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .info-row { margin: 8px 0; padding: 8px; border-bottom: 1px solid #e2e8f0; }
        .label { font-weight: bold; color: #64748b; display: inline-block; width: 150px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🔔 New Demo Appointment Scheduled</h2>
        </div>
        <div class="content">
          <div class="prospect-info">
            <h3 style="margin-top: 0;">Prospect Information</h3>
            <div class="info-row">
              <span class="label">Name:</span> ${appointment.firstName} ${appointment.lastName}
            </div>
            <div class="info-row">
              <span class="label">Email:</span> ${appointment.email}
            </div>
            ${appointment.phone ? `<div class="info-row"><span class="label">Phone:</span> ${appointment.phone}</div>` : ''}
            ${appointment.company ? `<div class="info-row"><span class="label">Company:</span> ${appointment.company}</div>` : ''}
            <div class="info-row">
              <span class="label">Date:</span> ${formattedDate}
            </div>
            <div class="info-row">
              <span class="label">Time:</span> ${formatTime(appointment.appointmentTime)}
            </div>
            ${appointment.notes ? `<div class="info-row"><span class="label">Notes:</span> ${appointment.notes}</div>` : ''}
          </div>
          <p><strong>Action Required:</strong> Prepare for the demo and add this appointment to your calendar.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    // Send email to the lead
    await transporter.sendMail({
      from: '"Lead2Lease" <lead2leaseai@gmail.com>',
      to: appointment.email,
      subject: "Demo Appointment Confirmed - Lead2Lease",
      html: leadEmailHtml,
    });

    // Send notification to admin
    await transporter.sendMail({
      from: '"Lead2Lease Notifications" <lead2leaseai@gmail.com>',
      to: "lead2leaseai@gmail.com",
      subject: `New Demo Scheduled: ${appointment.firstName} ${appointment.lastName} - ${formattedDate}`,
      html: adminEmailHtml,
    });

    console.log("[Email] Appointment confirmation emails sent successfully");
  } catch (error) {
    console.error("[Email] Error sending appointment emails:", error);
    throw error;
  }
}

export async function sendShowingCancellationEmail(data: {
  leadName: string;
  leadEmail: string;
  agentEmail?: string;
  agentName?: string;
  propertyName: string;
  propertyAddress?: string;
  unitNumber?: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes?: number;
  cancellationReason: string;
  eventName?: string | null;
  eventDescription?: string | null;
  assignedMember?: any | null;
  organization?: any | null;
  showingId?: string;
}) {
  console.log(`[Email] ===== sendShowingCancellationEmail called =====`);
  console.log(`[Email] Data received:`, {
    leadName: data.leadName,
    leadEmail: data.leadEmail,
    agentEmail: data.agentEmail || 'none',
    propertyName: data.propertyName,
    scheduledDate: data.scheduledDate,
    scheduledTime: data.scheduledTime,
    reasonLength: data.cancellationReason.length,
  });
  
  // Validate EMAIL_PASSWORD is configured
  const emailPassword = process.env.EMAIL_PASSWORD;
  if (!emailPassword) {
    console.error("[Email] EMAIL_PASSWORD not configured - cannot send cancellation email");
    throw new Error("EMAIL_PASSWORD environment variable is not set");
  }

  // Get the email user (from env or default)
  const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";
  console.log(`[Email] Using email account: ${emailUser}`);
  console.log(`[Email] EMAIL_PASSWORD is set: ${!!emailPassword}`);
  
  // Create transporter with validated credentials
  const emailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
  
  console.log(`[Email] Transporter created successfully`);
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const dateObj = new Date(data.scheduledDate + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Build apartment row if unit number provided
  const apartmentRow = data.unitNumber 
    ? `<div class="detail-row"><span class="label"></span> <span class="value" style="color: #64748b;">Apartment ${data.unitNumber}</span></div>`
    : '';

  // Build address row if property address provided
  const addressRow = data.propertyAddress
    ? `<div class="detail-row"><span class="label">Address:</span> <span class="value">${data.propertyAddress}</span></div>${apartmentRow}`
    : apartmentRow;

  // Event name and description section
  const eventNameSection = data.eventName ? `<div class="detail-row"><span class="label">Event:</span> <span class="value" style="font-weight: bold;">${data.eventName}</span></div>` : '';
  const eventDescriptionSection = data.eventDescription ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Description:</span><div class="value" style="margin-top: 5px;">${data.eventDescription.replace(/\n/g, '<br>')}</div></div>` : '';
  
  // Assigned member section
  const assignedMemberSection = data.assignedMember ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Your Contact:</span><div class="value" style="margin-top: 5px;">${data.assignedMember.firstName || ''} ${data.assignedMember.lastName || ''}${data.assignedMember.email ? `<br>Email: ${data.assignedMember.email}` : ''}${data.assignedMember.phone ? `<br>Phone: ${data.assignedMember.phone}` : ''}</div></div>` : '';

  const leadEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; width: 100%; box-sizing: border-box; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; width: 100%; box-sizing: border-box; }
        .showing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .reason-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .ajT { display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; overflow: hidden !important; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">Showing Cancelled</h1>
        </div>
        <div class="content">
          <p>Hi ${data.leadName},</p>
          <p>We're sorry to inform you that your scheduled showing has been cancelled.</p>
          
          ${data.organization ? `
          <div style="margin: 20px 0; padding: 15px; background: white; border-radius: 8px;">
            ${data.organization.name ? `<h3 style="margin: 0 0 5px 0; color: #1e293b; font-size: 18px; font-weight: 600; line-height: 1.2;">${data.organization.name}</h3>` : ''}
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.4;">Property Management Company</p>
          </div>
          ` : ''}
          
          <div class="showing-details">
            <h2 style="margin-top: 0; color: #dc2626;">Cancelled Showing Details</h2>
            ${eventNameSection}
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${data.propertyName}</span>
            </div>
            ${addressRow}
            <div class="detail-row">
              <span class="label">Date:</span> <span class="value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> <span class="value">${formatTime(data.scheduledTime)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Duration:</span> <span class="value">${data.durationMinutes || 30} minutes</span>
            </div>
            ${eventDescriptionSection}
            ${assignedMemberSection}
          </div>

          <div class="reason-box">
            <h3 style="margin-top: 0; color: #dc2626;">Cancellation Reason:</h3>
            <p style="margin-bottom: 0; white-space: pre-wrap;">${data.cancellationReason}</p>
          </div>

          <p>If you have any questions or would like to reschedule, please don't hesitate to reach out to us.</p>
          
          ${data.showingId ? `
          <div style="margin: 30px 0; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #dc2626;">
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #1e293b;">Manage Your Booking</p>
            <p style="margin: 0 0 15px 0; color: #64748b;">View the details of your cancelled booking.</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <a href="${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : (process.env.PUBLIC_URL || 'http://localhost:5000')}/showing/${data.showingId}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View & Manage Booking</a>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #94a3b8;">You can view the details of your cancelled booking from the link above. No account required.</p>
          </div>
          ` : ''}
          
          <div class="footer" style="display: block !important; visibility: visible !important; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px;">Powered by</p>
            <p style="margin: 0; color: #2560E8; font-size: 14px; font-weight: 500;">Lead2Lease</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const agentEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; width: 100%; box-sizing: border-box; }
        .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; width: 100%; box-sizing: border-box; }
        .showing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .reason-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .ajT { display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; overflow: hidden !important; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">Showing Cancelled</h1>
        </div>
        <div class="content">
          <p>Hi ${data.agentName || 'Team Member'},</p>
          <p>This is to notify you that a showing you were assigned to has been cancelled.</p>
          
          <div class="showing-details">
            <h2 style="margin-top: 0; color: #dc2626;">Cancelled Showing Details</h2>
            ${eventNameSection}
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${data.propertyName}</span>
            </div>
            ${addressRow}
            <div class="detail-row">
              <span class="label">Lead:</span> <span class="value">${data.leadName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Date:</span> <span class="value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> <span class="value">${formatTime(data.scheduledTime)}</span>
            </div>
            ${eventDescriptionSection}
          </div>

          <div class="reason-box">
            <h3 style="margin-top: 0; color: #dc2626;">Cancellation Reason:</h3>
            <p style="margin-bottom: 0; white-space: pre-wrap;">${data.cancellationReason}</p>
          </div>

          <p>The lead has been notified of this cancellation via email.</p>
          
          <div class="footer" style="display: block !important; visibility: visible !important; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0; color: #2560E8; font-size: 14px; font-weight: 500;">Lead2Lease</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromEmail = `"Lead2Lease" <${emailUser}>`;
    console.log(`[Email] From email address: ${fromEmail}`);
    
    // Build attachments array (no logo)
    const cancelAttachments: any[] = [];

    // Send email to lead
    if (data.leadEmail) {
      console.log(`[Email] Attempting to send email to lead: ${data.leadEmail}`);
      const leadResult = await emailTransporter.sendMail({
        from: fromEmail,
        to: data.leadEmail,
        subject: `Showing Cancelled - ${data.propertyName}`,
        html: leadEmailHtml,
        attachments: cancelAttachments,
      });
      console.log(`[Email] ✓ Lead email sent successfully!`, {
        messageId: leadResult.messageId,
        response: leadResult.response,
        to: data.leadEmail,
        from: emailUser,
      });
    } else {
      console.warn(`[Email] No lead email provided, skipping lead cancellation email`);
    }

    // Send email to assigned agent
    if (data.agentEmail) {
      console.log(`[Email] Attempting to send email to agent: ${data.agentEmail}`);
      const agentResult = await emailTransporter.sendMail({
        from: fromEmail,
        to: data.agentEmail,
        subject: `Showing Cancelled - ${data.propertyName} (${data.leadName})`,
        html: agentEmailHtml,
        attachments: cancelAttachments,
      });
      console.log(`[Email] ✓ Agent email sent successfully!`, {
        messageId: agentResult.messageId,
        response: agentResult.response,
        to: data.agentEmail,
        from: emailUser,
      });
    } else {
      console.warn(`[Email] No agent email provided, skipping agent cancellation email`);
    }
    
    console.log(`[Email] ===== sendShowingCancellationEmail completed successfully =====`);
  } catch (error) {
    console.error("[Email] ===== ERROR IN sendShowingCancellationEmail =====");
    console.error("[Email] Error sending cancellation email:", error);
    console.error("[Email] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      emailUser: emailUser,
      hasPassword: !!emailPassword,
    });
    throw error;
  }
}

export async function sendShowingRescheduleEmail(data: {
  showingId: string;
  leadName: string;
  leadEmail: string;
  agentEmail?: string;
  agentName?: string;
  propertyName: string;
  propertyAddress: string;
  unitNumber?: string;
  durationMinutes: number;
  managerEmail: string;
  oldScheduledDate: string;
  oldScheduledTime: string;
  newScheduledDate: string;
  newScheduledTime: string;
  eventName?: string | null;
  eventDescription?: string | null;
  assignedMember?: any | null;
  organization?: any | null;
  property?: any | null;
  unit?: any | null;
}) {
  console.log(`[Email] ===== sendShowingRescheduleEmail called =====`);
  console.log(`[Email] Data received:`, {
    leadName: data.leadName,
    leadEmail: data.leadEmail,
    agentEmail: data.agentEmail || 'none',
    propertyName: data.propertyName,
    oldDate: data.oldScheduledDate,
    oldTime: data.oldScheduledTime,
    newDate: data.newScheduledDate,
    newTime: data.newScheduledTime,
  });
  
  // Validate EMAIL_PASSWORD is configured
  const emailPassword = process.env.EMAIL_PASSWORD;
  if (!emailPassword) {
    console.error("[Email] EMAIL_PASSWORD not configured - cannot send reschedule email");
    throw new Error("EMAIL_PASSWORD environment variable is not set");
  }

  // Get the email user (from env or default) - using lead2leaseai@gmail.com
  const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";
  console.log(`[Email] ===== RESCHEDULE EMAIL CONFIGURATION =====`);
  console.log(`[Email] Using email account: ${emailUser}`);
  console.log(`[Email] EMAIL_PASSWORD is set: ${!!emailPassword}`);
  console.log(`[Email] EMAIL_USER from env: ${process.env.EMAIL_USER || 'NOT SET (using default lead2leaseai@gmail.com)'}`);
  
  // Create transporter with validated credentials
  const emailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
  
  console.log(`[Email] Transporter created successfully`);
  const formatTime = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (dateStr: string): string => {
    const dateObj = new Date(dateStr + 'T00:00:00');
    return dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const oldFormattedDate = formatDate(data.oldScheduledDate);
  const newFormattedDate = formatDate(data.newScheduledDate);
  const oldFormattedTime = formatTime(data.oldScheduledTime);
  const newFormattedTime = formatTime(data.newScheduledTime);

  // Helper function to replace variables in event name and description
  const replaceVariables = (text: string | null | undefined): string => {
    if (!text || !data.property || !data.unit) return text || '';
    
    // Format property amenities as comma-separated list
    const propertyAmenitiesStr = data.property.amenities && data.property.amenities.length > 0
      ? data.property.amenities.join(', ')
      : '';
    
    // Format property address (address is a single field in the schema)
    const propertyAddressStr = data.property.address || '';
    
    // Format unit rent with currency
    const unitRentStr = data.unit.monthlyRent 
      ? `$${parseFloat(data.unit.monthlyRent).toLocaleString()}/mo`
      : '';
    
    // Format security deposit with currency
    const securityDepositStr = data.unit.deposit
      ? `$${parseFloat(data.unit.deposit).toLocaleString()}`
      : '';
    
    // Define safe replacement mapping with all available variables
    const variables: Record<string, string> = {
      '{unit_number}': data.unit.unitNumber || '',
      '{bedrooms}': data.unit.bedrooms?.toString() || '',
      '{bathrooms}': data.unit.bathrooms || '',
      '{unit_rent}': unitRentStr,
      '{security_deposit}': securityDepositStr,
      '{property_amenities}': propertyAmenitiesStr,
      '{property_address}': propertyAddressStr,
      '{property_name}': data.property.name || ''
    };
    
    // Replace each variable
    let result = text;
    for (const [placeholder, value] of Object.entries(variables)) {
      // Escape regex special characters in placeholder for safe replacement
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedPlaceholder, 'g'), value);
    }
    
    return result;
  };
  
  // Replace variables in event name and description
  let processedEventName = data.eventName ? replaceVariables(data.eventName) : null;
  let processedEventDescription = data.eventDescription ? replaceVariables(data.eventDescription) : null;

  // Build apartment info for description if unit number provided
  const apartmentInfo = data.unitNumber ? `\nApartment ${data.unitNumber}` : '';
  
  // Build base description with event description if available
  // The event description should be at the very beginning of the ICS description
  let baseDescription = '';
  
  // Log for debugging
  console.log(`[Email] Event description check:`, {
    hasEventDescription: !!data.eventDescription,
    eventDescriptionValue: data.eventDescription || 'null/undefined',
    hasProcessedEventDescription: !!processedEventDescription,
    processedEventDescriptionValue: processedEventDescription || 'null/undefined',
  });
  
  if (processedEventDescription && processedEventDescription.trim()) {
    // If event description exists, use it as the base (it will be at the beginning)
    baseDescription = processedEventDescription;
  } else {
    // Otherwise, use default message
    baseDescription = `Your scheduled showing for ${data.propertyName} has been rescheduled.`;
  }
  // Add address and instructions (but NOT "Booked via Lead2Lease" here - it will be added at the end in ICS)
  baseDescription += `\n\nAddress: ${data.propertyAddress}${apartmentInfo}`;
  baseDescription += `\n\nPlease arrive on time. If you need to cancel or reschedule, please contact us.`;
  // Note: "Booked via Lead2Lease" is added at the end in the ICS generator
  
  console.log(`[Email] Base description for ICS:`, {
    hasEventDescription: !!processedEventDescription,
    eventDescriptionLength: processedEventDescription?.length || 0,
    baseDescriptionLength: baseDescription.length,
    baseDescriptionPreview: baseDescription.substring(0, 200)
  });

  // Build manage booking URL
  const manageBookingUrl = data.showingId 
    ? `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : (process.env.PUBLIC_URL || 'http://localhost:5000')}/showing/${data.showingId}`
    : undefined;

  // Generate updated calendar invite with new date/time
  // Using the same UID so calendar clients recognize it as an update to the existing event
  const calendarInvite = generateCalendarInvite({
    uid: data.showingId,
    title: processedEventName || `Property Showing: ${data.propertyName}`,
    description: baseDescription,
    location: data.propertyAddress,
    startDate: data.newScheduledDate,
    startTime: data.newScheduledTime,
    durationMinutes: data.durationMinutes,
    organizerName: data.organization?.name || "Lead2Lease",
    organizerEmail: data.managerEmail,
    attendeeEmail: data.leadEmail,
    attendeeName: data.leadName,
    unitNumber: data.unitNumber,
    manageBookingUrl: manageBookingUrl,
    assignedContact: data.assignedMember ? {
      name: `${data.assignedMember.firstName || ''} ${data.assignedMember.lastName || ''}`.trim(),
      email: data.assignedMember.email,
      phone: data.assignedMember.phone,
    } : undefined,
    organizationName: data.organization?.name,
  });

  // Build apartment row for email if unit number provided
  const rescheduleApartmentRow = data.unitNumber 
    ? `<div class="detail-row"><span class="label"></span> <span class="value" style="color: #64748b;">Apartment ${data.unitNumber}</span></div>`
    : '';

  const leadEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2560E8 0%, #2560E8 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .showing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2560E8; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .change-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .old-time { text-decoration: line-through; color: #94a3b8; }
        .new-time { color: #2560E8; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">Showing Rescheduled</h1>
        </div>
        <div class="content">
          <p>Hi ${data.leadName},</p>
          <p>Your showing has been rescheduled. Please see the updated details below.</p>
          
          ${data.organization ? `
          <div style="margin: 20px 0; padding: 15px; background: white; border-radius: 8px;">
            ${data.organization.name ? `<h3 style="margin: 0 0 5px 0; color: #1e293b; font-size: 18px; font-weight: 600; line-height: 1.2;">${data.organization.name}</h3>` : ''}
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.4;">Property Management Company</p>
          </div>
          ` : ''}
          
          <div class="change-box">
            <h3 style="margin-top: 0; color: #2560E8;">Schedule Change</h3>
            <div class="detail-row">
              <span class="label">Previous Date & Time:</span> 
              <span class="value old-time">${oldFormattedDate} at ${oldFormattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">New Date & Time:</span> 
              <span class="value new-time">${newFormattedDate} at ${newFormattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">Duration:</span> 
              <span class="value">${data.durationMinutes} minutes</span>
            </div>
          </div>
          
          <div class="showing-details">
            <h2 style="margin-top: 0; color: #2560E8;">Showing Details</h2>
            ${processedEventName ? `<div class="detail-row"><span class="label">Event:</span> <span class="value" style="font-weight: bold;">${processedEventName}</span></div>` : ''}
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${data.propertyName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span> <span class="value">${data.propertyAddress}</span>
            </div>
            ${rescheduleApartmentRow}
            ${processedEventDescription ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Description:</span><div class="value" style="margin-top: 5px;">${processedEventDescription.replace(/\n/g, '<br>')}</div></div>` : ''}
            ${data.assignedMember ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Your Contact:</span><div class="value" style="margin-top: 5px;">${data.assignedMember.firstName || ''} ${data.assignedMember.lastName || ''}${data.assignedMember.email ? `<br>Email: ${data.assignedMember.email}` : ''}${data.assignedMember.phone ? `<br>Phone: ${data.assignedMember.phone}` : ''}</div></div>` : ''}
          </div>

          <p><strong>Updated Calendar Invite Attached</strong><br/>
          An updated calendar invite (.ics file) is attached to this email. Add it to your calendar to update the event with the new date and time.</p>

          <p>If you have any questions or need to make further changes, please don't hesitate to reach out to us.</p>
          
          ${data.showingId ? `
          <div style="margin: 30px 0; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #2560E8;">
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #1e293b;">Manage Your Booking</p>
            <p style="margin: 0 0 15px 0; color: #64748b;">Need to cancel or reschedule your showing?</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <a href="${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : (process.env.PUBLIC_URL || 'http://localhost:5000')}/showing/${data.showingId}" style="display: inline-block; padding: 10px 20px; background: #2560E8; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View & Manage Booking</a>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #94a3b8;">You can cancel or reschedule your showing from the link above. No account required.</p>
          </div>
          ` : ''}
          
          <div class="footer" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px;">Powered by</p>
            <p style="margin: 0; color: #2560E8; font-size: 14px; font-weight: 500;">Lead2Lease</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const agentEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2560E8 0%, #2560E8 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .showing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2560E8; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .change-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 15px; margin: 20px 0; }
        .old-time { text-decoration: line-through; color: #94a3b8; }
        .new-time { color: #2560E8; font-weight: bold; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Showing Rescheduled</h1>
        </div>
        <div class="content">
          <p>Hi ${data.agentName || 'Team Member'},</p>
          <p>This is to notify you that a showing you were assigned to has been rescheduled.</p>
          
          <div class="showing-details">
            <h2 style="margin-top: 0; color: #2560E8;">Showing Details</h2>
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${data.propertyName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span> <span class="value">${data.propertyAddress}</span>
            </div>
            ${rescheduleApartmentRow}
            <div class="detail-row">
              <span class="label">Lead:</span> <span class="value">${data.leadName}</span>
            </div>
          </div>

          <div class="change-box">
            <h3 style="margin-top: 0; color: #2560E8;">Schedule Change</h3>
            <div class="detail-row">
              <span class="label">Previous Date & Time:</span> 
              <span class="value old-time">${oldFormattedDate} at ${oldFormattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">New Date & Time:</span> 
              <span class="value new-time">${newFormattedDate} at ${newFormattedTime}</span>
            </div>
          </div>

          <p>The lead has been notified of this reschedule via email.</p>
          
          <div class="footer" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px;">Powered by</p>
            <p style="margin: 0; color: #2560E8; font-size: 14px; font-weight: 500;">Lead2Lease</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromEmail = `"Lead2Lease" <${emailUser}>`;
    console.log(`[Email] From email address: ${fromEmail}`);
    
    // Build attachments array with calendar invite (no logo)
    const rescheduleAttachments: any[] = [
      {
        filename: 'showing-rescheduled.ics',
        content: calendarInvite,
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      },
    ];
    
    // Agent attachments (no logo, no calendar for agent)
    const agentRescheduleAttachments: any[] = [];
    
    // Send email to lead
    if (data.leadEmail) {
      console.log(`[Email] Attempting to send reschedule email to lead: ${data.leadEmail}`);
      const leadResult = await emailTransporter.sendMail({
        from: fromEmail,
        to: data.leadEmail,
        subject: `Showing Rescheduled - ${data.propertyName}`,
        html: leadEmailHtml,
        attachments: rescheduleAttachments,
      });
      console.log(`[Email] ✓ Lead reschedule email sent successfully!`, {
        messageId: leadResult.messageId,
        response: leadResult.response,
        to: data.leadEmail,
        from: emailUser,
      });
    } else {
      console.warn(`[Email] No lead email provided, skipping lead reschedule email`);
    }

    // Send email to assigned agent
    if (data.agentEmail) {
      console.log(`[Email] Attempting to send reschedule email to agent: ${data.agentEmail}`);
      const agentResult = await emailTransporter.sendMail({
        from: fromEmail,
        to: data.agentEmail,
        subject: `Showing Rescheduled - ${data.propertyName} (${data.leadName})`,
        html: agentEmailHtml,
        attachments: agentRescheduleAttachments,
      });
      console.log(`[Email] ✓ Agent reschedule email sent successfully!`, {
        messageId: agentResult.messageId,
        response: agentResult.response,
        to: data.agentEmail,
        from: emailUser,
      });
    } else {
      console.warn(`[Email] No agent email provided, skipping agent reschedule email`);
    }
    
    console.log(`[Email] ===== sendShowingRescheduleEmail completed successfully =====`);
  } catch (error) {
    console.error("[Email] ===== ERROR IN sendShowingRescheduleEmail =====");
    console.error("[Email] Error sending reschedule email:", error);
    console.error("[Email] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Send notification to support when someone registers
const SUPPORT_EMAIL = "support@lead2lease.ai";

export async function sendRegistrationNotification(user: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  provider?: string | null;
  company?: string | null;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  initialOffer?: string | null;
  createdAt?: Date | null;
}) {
  try {
    const emailPassword = process.env.EMAIL_PASSWORD;
    if (!emailPassword) {
      console.error("[Email] EMAIL_PASSWORD not configured - cannot send registration notification");
      return;
    }

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
    const source = user.provider === "email" ? "Email/Password" : (user.provider || "—");
    const utmParts: string[] = [];
    if (user.utmSource) utmParts.push(`utm_source=${user.utmSource}`);
    if (user.utmMedium) utmParts.push(`utm_medium=${user.utmMedium}`);
    if (user.utmCampaign) utmParts.push(`utm_campaign=${user.utmCampaign}`);
    if (user.utmTerm) utmParts.push(`utm_term=${user.utmTerm}`);
    if (user.utmContent) utmParts.push(`utm_content=${user.utmContent}`);
    const sourceDetails = [
      user.landingPage ? `Landing: ${user.landingPage}` : null,
      user.initialOffer ? `Offer: ${user.initialOffer}` : null,
      utmParts.length ? utmParts.join(", ") : null,
    ].filter(Boolean).join(" | ") || "—";

    const notificationHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e293b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
          .prospect-info { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .info-row { margin: 8px 0; padding: 8px; border-bottom: 1px solid #e2e8f0; }
          .label { font-weight: bold; color: #64748b; display: inline-block; width: 150px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔔 New Account Registration</h2>
          </div>
          <div class="content">
            <div class="prospect-info">
              <h3 style="margin-top: 0;">User Information</h3>
              <div class="info-row">
                <span class="label">Name:</span> ${fullName}
              </div>
              <div class="info-row">
                <span class="label">Email:</span> ${user.email}
              </div>
              ${user.phone ? `<div class="info-row"><span class="label">Phone:</span> ${user.phone}</div>` : ""}
              ${user.company ? `<div class="info-row"><span class="label">Company:</span> ${user.company}</div>` : ""}
              <div class="info-row">
                <span class="label">Source:</span> ${source}
              </div>
              <div class="info-row">
                <span class="label">Source Details:</span> ${sourceDetails}
              </div>
              <div class="info-row">
                <span class="label">Registered At:</span> ${user.createdAt ? new Date(user.createdAt).toLocaleString() : new Date().toLocaleString()}
              </div>
            </div>
            <p style="color: #64748b; font-size: 14px;">
              A new user has registered for an account. Reach out to welcome them and offer onboarding support.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: '"Lead2Lease Notifications" <lead2leaseai@gmail.com>',
      to: SUPPORT_EMAIL,
      subject: `New Registration: ${fullName} (${user.email})`,
      html: notificationHtml,
    });

    console.log(`[Email] Registration notification sent to ${SUPPORT_EMAIL} for: ${user.email}`);
  } catch (error) {
    console.error("[Email] Error sending registration notification:", error);
    // Don't throw - registration should succeed even if notification fails
  }
}

// Send demo request notification with full form + acquisition context
export async function sendDemoRequestNotification(demoRequest: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  countryCode?: string | null;
  company?: string | null;
  unitsUnderManagement?: string | null;
  managedOrOwned?: string | null;
  hqLocation?: string | null;
  currentTools?: string | null;
  agreeTerms?: boolean | null;
  agreeMarketing?: boolean | null;
  initialOffer?: string | null;
  landingPage?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  firstTouchTs?: Date | string | null;
  acquisitionContextJson?: unknown;
  createdAt?: Date | string | null;
}) {
  try {
    const emailPassword = process.env.EMAIL_PASSWORD;
    if (!emailPassword) {
      console.error("[Email] EMAIL_PASSWORD not configured - cannot send demo request notification");
      return;
    }

    const fullPhone = [demoRequest.countryCode || "", demoRequest.phone].filter(Boolean).join(" ").trim() || demoRequest.phone;
    const submittedAt = demoRequest.createdAt
      ? new Date(demoRequest.createdAt).toLocaleString()
      : new Date().toLocaleString();

    const formSection = `
      <div class="info-box" style="background: white; padding: 20px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #2563eb;">
        <h3 style="margin-top: 0; color: #2563eb;">Form Details</h3>
        <div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Name:</span> <span class="value" style="color: #1e293b;">${demoRequest.firstName} ${demoRequest.lastName}</span></div>
        <div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Email:</span> <span class="value" style="color: #1e293b;">${demoRequest.email}</span></div>
        <div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Phone:</span> <span class="value" style="color: #1e293b;">${fullPhone}</span></div>
        ${demoRequest.company ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Organization:</span> <span class="value" style="color: #1e293b;">${demoRequest.company}</span></div>` : ""}
        ${demoRequest.unitsUnderManagement ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Units under management:</span> <span class="value" style="color: #1e293b;">${demoRequest.unitsUnderManagement}</span></div>` : ""}
        ${demoRequest.managedOrOwned ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Managed or owned:</span> <span class="value" style="color: #1e293b;">${demoRequest.managedOrOwned}</span></div>` : ""}
        ${demoRequest.hqLocation ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">HQ location:</span> <span class="value" style="color: #1e293b;">${demoRequest.hqLocation}</span></div>` : ""}
        ${demoRequest.currentTools ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Current tools:</span> <span class="value" style="color: #1e293b;">${demoRequest.currentTools}</span></div>` : ""}
        <div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Agreed to terms:</span> <span class="value" style="color: #1e293b;">${demoRequest.agreeTerms ? "Yes" : "No"}</span></div>
        <div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Marketing opt-in:</span> <span class="value" style="color: #1e293b;">${demoRequest.agreeMarketing ? "Yes" : "No"}</span></div>
        <div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Submitted at:</span> <span class="value" style="color: #1e293b;">${submittedAt}</span></div>
      </div>`;

    const hasAcquisition = demoRequest.initialOffer || demoRequest.landingPage || demoRequest.utmSource || demoRequest.utmMedium || demoRequest.utmCampaign;
    const acquisitionSection = hasAcquisition
      ? `
      <div class="info-box" style="background: white; padding: 20px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #0ea5e9;">
        <h3 style="margin-top: 0; color: #0ea5e9;">Acquisition / Source</h3>
        ${demoRequest.initialOffer ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Offer:</span> <span class="value" style="color: #1e293b;">${demoRequest.initialOffer}</span></div>` : ""}
        ${demoRequest.landingPage ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">Landing page:</span> <span class="value" style="color: #1e293b;">${demoRequest.landingPage}</span></div>` : ""}
        ${demoRequest.utmSource ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">UTM source:</span> <span class="value" style="color: #1e293b;">${demoRequest.utmSource}</span></div>` : ""}
        ${demoRequest.utmMedium ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">UTM medium:</span> <span class="value" style="color: #1e293b;">${demoRequest.utmMedium}</span></div>` : ""}
        ${demoRequest.utmCampaign ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">UTM campaign:</span> <span class="value" style="color: #1e293b;">${demoRequest.utmCampaign}</span></div>` : ""}
        ${demoRequest.utmTerm ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">UTM term:</span> <span class="value" style="color: #1e293b;">${demoRequest.utmTerm}</span></div>` : ""}
        ${demoRequest.utmContent ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">UTM content:</span> <span class="value" style="color: #1e293b;">${demoRequest.utmContent}</span></div>` : ""}
        ${demoRequest.firstTouchTs ? `<div class="info-row" style="margin: 8px 0; padding: 8px;"><span class="label" style="font-weight: bold; color: #64748b; display: inline-block; width: 180px;">First touch:</span> <span class="value" style="color: #1e293b;">${new Date(demoRequest.firstTouchTs).toLocaleString()}</span></div>` : ""}
      </div>`
      : "";

    const notificationHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🔔 New Demo Request (Book Demo Form)</h2>
          </div>
          <div class="content">
            ${formSection}
            ${acquisitionSection}
            <p style="color: #64748b; font-size: 14px; margin-top: 20px;">
              Follow up with this lead to schedule their demo.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: '"Lead2Lease Notifications" <lead2leaseai@gmail.com>',
      to: SUPPORT_EMAIL,
      subject: `New Demo Request: ${demoRequest.firstName} ${demoRequest.lastName} (${demoRequest.email})`,
      html: notificationHtml,
    });

    console.log(`[Email] Demo request notification sent to ${SUPPORT_EMAIL} for: ${demoRequest.email}`);
  } catch (error) {
    console.error("[Email] Error sending demo request notification:", error);
    // Don't throw - demo request is already stored; notification is best-effort
  }
}

export async function sendFoundingPartnerWelcomeEmail(data: {
  email: string;
  name?: string;
  orgName?: string;
}) {
  const startTime = Date.now();
  console.log(`[Email] [sendFoundingPartnerWelcomeEmail] ===== STARTING FOUNDING PARTNER WELCOME EMAIL SEND =====`);
  console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Timestamp: ${new Date().toISOString()}`);
  console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Recipient email: ${data.email}`);
  console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Recipient name: ${data.name || 'N/A'}`);
  console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Organization name: ${data.orgName || 'N/A'}`);
  
  try {
    // Use the same email service pattern as invitations and reminders
    const { getTransporter } = await import("./emailService");
    
  const emailPassword = process.env.EMAIL_PASSWORD;
    const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";
    
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Step 1: Checking environment variables`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] EMAIL_PASSWORD exists: ${!!emailPassword}`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] EMAIL_PASSWORD type: ${typeof emailPassword}`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] EMAIL_USER: ${emailUser}`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] EMAIL_USER source: ${process.env.EMAIL_USER ? 'from env' : 'default'}`);
    
  if (!emailPassword) {
      console.error("[Email] [sendFoundingPartnerWelcomeEmail] ❌ EMAIL_PASSWORD environment variable is not set");
    throw new Error("EMAIL_PASSWORD environment variable is not set");
  }

    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Step 2: Getting transporter`);
    const emailTransporter = getTransporter();
  if (!emailTransporter) {
      console.error(`[Email] [sendFoundingPartnerWelcomeEmail] ❌ Cannot send founding partner welcome email - transporter not available`);
    throw new Error("EMAIL_PASSWORD environment variable is not set");
  }
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] ✅ Transporter obtained successfully`);

    const firstName = data.name?.split(' ')[0] || 'there';
    const baseUrl = getBaseUrlForEmail();

    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Step 3: Generating email content`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Base URL for email links: ${baseUrl}`);
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #FFDF00 0%, #FFD700 100%); color: #000000; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
        .header h1 { margin: 0; font-size: 28px; color: #000000; }
        .crown { font-size: 48px; margin-bottom: 10px; }
        .content { background: #fffbeb; padding: 30px; border-radius: 0 0 12px 12px; }
        .welcome-box { background: white; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FFDF00; }
        .step { display: flex; margin: 15px 0; align-items: flex-start; }
        .step-number { background: linear-gradient(135deg, #FFDF00 0%, #FFD700 100%); color: #000000; width: 40px; height: 40px; min-width: 40px; min-height: 40px; border-radius: 50%; display: inline-block; text-align: center; line-height: 40px; font-weight: bold; margin-right: 15px; flex-shrink: 0; font-size: 16px; box-shadow: 0 2px 4px rgba(255, 223, 0, 0.3); vertical-align: top; }
        .step-content { flex: 1; }
        .step-title { font-weight: bold; color: #1e293b; margin-bottom: 4px; }
        .step-desc { color: #64748b; font-size: 14px; }
        .benefits { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .benefit-item { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
        .benefit-item:last-child { border-bottom: none; }
        .check { color: #22c55e; font-weight: bold; margin-right: 10px; }
        .cta-button { display: inline-block; background: linear-gradient(135deg, #FFDF00 0%, #FFD700 100%); color: #000000; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; }
        .benefit-title { background-color: #FFDF00; color: #000000; font-weight: bold; font-size: 16px; padding: 6px 10px; border-radius: 4px; margin-bottom: 8px; display: inline-block; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .signature { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="crown">&#128081;</div>
          <h1>Welcome to the Founding Partners!</h1>
          <p style="margin: 10px 0 0 0; color: #000000;">You're now part of an exclusive group</p>
        </div>
        <div class="content">
          <div class="welcome-box">
            <p style="margin: 0; font-size: 18px;">Hi ${firstName},</p>
            <p><strong>🎉 Congratulations! You're Now a Lead2Lease Founding Partner Member!</strong></p>
            ${data.orgName ? `<p><strong>Your organization "${data.orgName}"</strong> has been successfully activated with Founding Partner membership.</p>` : '<p>Your payment has been successfully processed and your membership has been activated.</p>'}
            <p>We're thrilled to have you as part of our exclusive founding member community.</p>
            <p>As a Founding Partner, you're not just a customer—you're a founder helping shape the future of property management. Thank you for believing in us and joining us on this journey!</p>
          </div>

          <h3 style="color: #1e293b; margin-bottom: 20px;">Your Onboarding Journey - Let's Get You Set Up:</h3>
          
          <div class="step">
            <div class="step-number" style="background: linear-gradient(135deg, #FFDF00 0%, #FFD700 100%); color: #000000; width: 40px; height: 40px; min-width: 40px; min-height: 40px; border-radius: 50%; display: inline-block; text-align: center; line-height: 40px; font-weight: bold; margin-right: 15px; flex-shrink: 0; font-size: 16px; box-shadow: 0 2px 4px rgba(255, 223, 0, 0.3); vertical-align: top;">1</div>
            <div class="step-content">
              <div class="step-title">Complete Your Profile & Organization Setup</div>
              <div class="step-desc">Start by completing your profile information and setting up your organization details. This helps us personalize your experience and ensures all team members are properly configured.</div>
            </div>
          </div>
          
          <div class="step">
            <div class="step-number" style="background: linear-gradient(135deg, #FFDF00 0%, #FFD700 100%); color: #000000; width: 40px; height: 40px; min-width: 40px; min-height: 40px; border-radius: 50%; display: inline-block; text-align: center; line-height: 40px; font-weight: bold; margin-right: 15px; flex-shrink: 0; font-size: 16px; box-shadow: 0 2px 4px rgba(255, 223, 0, 0.3); vertical-align: top;">2</div>
            <div class="step-content">
              <div class="step-title">Invite Your Team Members</div>
              <div class="step-desc">Add team members and assign them to properties. Set up roles and permissions so everyone has the right level of access to manage leads and showings.</div>
            </div>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${baseUrl}/login" class="cta-button">Start your Lead2Lease journey</a>
            <p style="margin-top: 15px; color: #64748b; font-size: 14px;">Our team will reach out within 24 hours to schedule your white-glove onboarding session</p>
          </div>

          <div class="benefits">
            <h3 style="margin-top: 0;" class="benefit-title">Early Access Features</h3>
            <div class="benefit-item"><span class="check">&#10003;</span> <strong>First to try new AI capabilities</strong></div>
            
            <h3 style="margin-top: 20px;" class="benefit-title">Priority Feature Requests</h3>
            <div class="benefit-item"><span class="check">&#10003;</span> <strong>Shape our development roadmap</strong></div>
            
            <h3 style="margin-top: 20px;" class="benefit-title">Direct Founder Access</h3>
            <div class="benefit-item"><span class="check">&#10003;</span> <strong>Personal communication channel</strong></div>
            
            <h3 style="margin-top: 20px;" class="benefit-title">Lifetime Discount</h3>
            <div class="benefit-item"><span class="check">&#10003;</span> <strong>Get lifetime discount as a founding partner</strong></div>
            
            <h3 style="margin-top: 20px;" class="benefit-title">White-Glove Onboarding</h3>
            <div class="benefit-item"><span class="check">&#10003;</span> <strong>Personalized setup and training included</strong></div>
            
            <h3 style="margin-top: 20px;" class="benefit-title">Custom Made Software</h3>
            <div class="benefit-item"><span class="check">&#10003;</span> <strong>Get a solution that feels custom-built for your business with tailored configurations and workflows</strong></div>
          </div>

          <div class="signature">
            <p style="margin: 0;">Welcome aboard!</p>
            <p style="margin: 5px 0 0 0; font-weight: bold;">The Lead2Lease Team</p>
          </div>

          <div class="footer">
            <p>Questions? Just reply to this email or reach out to <a href="mailto:support@lead2lease.ai" style="color: #FFDF00;">support@lead2lease.ai</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
Congratulations, ${firstName}!

🎉 You're Now a Lead2Lease Founding Partner Member!

${data.orgName ? `Your organization "${data.orgName}" has been successfully activated with Founding Partner membership.` : 'Your payment has been successfully processed and your membership has been activated.'}

We're thrilled to have you as part of our exclusive founding member community. Your payment has been successfully processed and your membership has been activated.

As a Founding Partner, you're not just a customer—you're a founder helping shape the future of property management. Thank you for believing in us and joining us on this journey!

YOUR ONBOARDING JOURNEY - LET'S GET YOU SET UP:

1. Complete Your Profile & Organization Setup
   Start by completing your profile information and setting up your organization details.

2. Invite Your Team Members
   Add team members and assign them to properties. Set up roles and permissions.

Get started: ${baseUrl}/login

Our team will reach out within 24 hours to schedule your white-glove onboarding session.

EARLY ACCESS FEATURES
- First to try new AI capabilities

PRIORITY FEATURE REQUESTS
- Shape our development roadmap

DIRECT FOUNDER ACCESS
- Personal communication channel

LIFETIME DISCOUNT
- Get lifetime discount as a founding partner

WHITE-GLOVE ONBOARDING
- Personalized setup and training included

CUSTOM MADE SOFTWARE
- Get a solution that feels custom-built for your business with tailored configurations and workflows

Questions? Reply to this email or contact support@lead2lease.ai

Welcome aboard!
The Lead2Lease Team
  `;

    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] HTML body length: ${emailHtml.length} chars`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Text body length: ${textContent.length} chars`);

    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Step 4: Preparing email message`);
    const fromEmail = `"Lead2Lease" <${emailUser}>`;
    // No logo attachment needed since footer logo was removed
    const attachments: any[] = [];

    const mailOptions = {
      from: fromEmail,
      to: data.email,
      subject: "🎉 Congratulations! You're Now a Lead2Lease Founding Partner",
      text: textContent,
      html: emailHtml,
      attachments,
    };
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Mail options:`, {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      textLength: mailOptions.text.length,
      htmlLength: mailOptions.html.length,
      attachmentsCount: mailOptions.attachments.length,
    });

    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Step 5: Attempting to send email via SMTP`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] SMTP host: smtp.gmail.com`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] SMTP port: 587`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] SMTP secure: false`);
    
    const sendStartTime = Date.now();
    const result = await emailTransporter.sendMail(mailOptions);
    const sendDuration = Date.now() - sendStartTime;

    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] ===== EMAIL SENT SUCCESSFULLY =====`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] ✅ Founding Partner welcome email sent successfully to ${data.email}`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Message ID: ${result.messageId}`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Response: ${JSON.stringify(result.response || 'No response')}`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Send duration: ${sendDuration}ms`);
    console.log(`[Email] [sendFoundingPartnerWelcomeEmail] Total duration: ${Date.now() - startTime}ms`);
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error(`[Email] [sendFoundingPartnerWelcomeEmail] ===== EMAIL SEND FAILED =====`);
    console.error(`[Email] [sendFoundingPartnerWelcomeEmail] ❌ Failed to send founding partner welcome email`);
    console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error duration: ${errorDuration}ms`);
    console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    
    if (error instanceof Error) {
      console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error message: ${error.message}`);
      console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error stack:`, error.stack);
      
      // Log nodemailer-specific error details if available
      if ((error as any).code) {
        console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error code: ${(error as any).code}`);
      }
      if ((error as any).command) {
        console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error command: ${(error as any).command}`);
      }
      if ((error as any).response) {
        console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error response: ${JSON.stringify((error as any).response)}`);
      }
      if ((error as any).responseCode) {
        console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Error response code: ${(error as any).responseCode}`);
      }
    } else {
      console.error(`[Email] [sendFoundingPartnerWelcomeEmail] Unknown error object:`, error);
    }
    
    throw error;
  }
}