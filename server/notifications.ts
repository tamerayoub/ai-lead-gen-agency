/**
 * Notification service for public showing bookings
 * Sends emails with calendar invites and creates in-app notifications
 */

import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { generateCalendarInvite } from "../shared/calendarInvite";
import type { Showing, Property, Lead, User } from "../shared/schema";
import type { IStorage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "lead2leaseai@gmail.com",
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Lead2Lease logo as base64 - loaded from file with multiple path fallbacks
// Using CID attachments for Gmail compatibility (Gmail blocks base64 data URIs)
let LOGO_BASE64: string | null = null;

function loadLogo(): string | null {
  if (LOGO_BASE64 !== null) return LOGO_BASE64;
  
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
          console.log('[Notifications] Logo loaded from:', logoPath, 'length:', content.length);
          LOGO_BASE64 = content;
          return LOGO_BASE64;
        }
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  console.warn('[Notifications] Logo file not found in any expected location');
  LOGO_BASE64 = '';
  return '';
}

// Get logo as CID attachment for nodemailer
// Gmail blocks base64 data URIs, but CID attachments work across all email clients
function getLogoAttachment(): { filename: string; content: Buffer; cid: string } | null {
  const base64Content = loadLogo();
  if (!base64Content) return null;
  
  return {
    filename: 'logo.svg',
    content: Buffer.from(base64Content, 'base64'),
    cid: 'lead2lease-logo',
  };
}

// Get the complete footer logo section with "Powered by" text
// Only renders if logo is available, otherwise returns empty string (no visual gap)
// Uses onerror to hide the entire logo container if CID attachment fails to load
function getFooterLogoSection(): string {
  const logoBase64 = loadLogo();
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

/**
 * Format time from 24-hour to 12-hour format
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Format date to readable format
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Send showing confirmation notification to property manager
 */
async function sendManagerNotification(
  showing: Showing,
  property: Property,
  lead: Lead,
  managerEmail: string,
  unitNumber?: string,
  eventName?: string,
  eventDescription?: string,
  assignedMember?: User | null
): Promise<void> {
  // Build description with event name and description prominently displayed
  let descriptionParts: string[] = [];
  
  // Start with event name if available
  if (eventName) {
    descriptionParts.push(`Event: ${eventName}`);
  }
  
  // Add event description if available
  if (eventDescription) {
    descriptionParts.push(`\n${eventDescription}`);
  }
  
  // Add property details
  const apartmentInfo = unitNumber ? `\nApartment ${unitNumber}` : '';
  descriptionParts.push(`\n\nProperty: ${property.name}`);
  descriptionParts.push(`Address: ${property.address}${apartmentInfo}`);
  
  // Add lead information
  descriptionParts.push(`\n\nLead: ${lead.name} (${lead.email})`);
  if (lead.phone) {
    descriptionParts.push(`Lead Phone: ${lead.phone}`);
  }
  
  // Add assigned member info if available
  if (assignedMember) {
    descriptionParts.push(`\n\nAssigned Member:`);
    descriptionParts.push(`${assignedMember.firstName || ''} ${assignedMember.lastName || ''}`);
    if (assignedMember.email) {
      descriptionParts.push(`Email: ${assignedMember.email}`);
    }
    if (assignedMember.phone) {
      descriptionParts.push(`Phone: ${assignedMember.phone}`);
    }
  }
  
  descriptionParts.push(`\n\nBooked via Lead2Lease AI`);
  
  const fullDescription = descriptionParts.join('\n');
  
  const calendarInvite = generateCalendarInvite({
    uid: showing.id,
    title: eventName || `Property Showing: ${property.name}`,
    description: fullDescription,
    location: property.address,
    startDate: showing.scheduledDate,
    startTime: showing.scheduledTime,
    durationMinutes: showing.durationMinutes || 30,
    organizerName: "Lead2Lease",
    organizerEmail: managerEmail,
    attendeeEmail: lead.email,
    attendeeName: lead.name,
    unitNumber: unitNumber,
  });

  const formattedDate = formatDate(showing.scheduledDate);
  const formattedTime = formatTime(showing.scheduledTime);
  
  const baseUrl = process.env.REPL_SLUG 
    ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : 'http://localhost:5000';

  // Build apartment row for email if unit number provided
  const apartmentRow = unitNumber 
    ? `<div class="detail-row"><span class="label"></span> <span class="value" style="color: #64748b;">Apartment ${unitNumber}</span></div>`
    : '';

  // Get organization for profile display
  const organization = await storage.getOrganization(property.orgId);
  
  // Organization details section (without image)
  const orgDetailsSectionManager = organization ? `
    <div style="margin: 20px 0; padding: 15px; background: white; border-radius: 8px;">
      ${organization.name ? `<h3 style="margin: 0 0 5px 0; color: #1e293b; font-size: 18px; font-weight: 600; line-height: 1.2;">${organization.name}</h3>` : ''}
      <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.4;">Property Management Company</p>
    </div>
  ` : '';

  const managerEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; width: 100%; box-sizing: border-box; }
        .header { background: linear-gradient(135deg, #2560E8 0%, #2560E8 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; width: 100%; box-sizing: border-box; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2560E8; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .ajT { display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; overflow: hidden !important; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">New Property Showing Booked</h1>
        </div>
        <div class="content">
          <p><strong>A new showing has been booked via your public booking page!</strong></p>
          
          <div class="booking-details">
            <h2 style="margin-top: 0; color: #2560E8;">Showing Details</h2>
            ${eventName ? `<div class="detail-row"><span class="label">Event:</span> <span class="value" style="font-weight: bold;">${eventName}</span></div>` : ''}
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${property.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span> <span class="value">${property.address}</span>
            </div>
            ${apartmentRow}
            <div class="detail-row">
              <span class="label">Date:</span> <span class="value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> <span class="value">${formattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">Duration:</span> <span class="value">${showing.durationMinutes || 30} minutes</span>
            </div>
            ${eventDescription ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Description:</span><div class="value" style="margin-top: 5px;">${eventDescription.replace(/\n/g, '<br>')}</div></div>` : ''}
            ${assignedMember ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Assigned Member:</span><div class="value" style="margin-top: 5px;">${assignedMember.firstName || ''} ${assignedMember.lastName || ''}${assignedMember.email ? `<br>Email: ${assignedMember.email}` : ''}${assignedMember.phone ? `<br>Phone: ${assignedMember.phone}` : ''}</div></div>` : ''}
          </div>

          <div class="booking-details">
            <h3 style="margin-top: 0; color: #2563eb;">Lead Information</h3>
            <div class="detail-row">
              <span class="label">Name:</span> <span class="value">${lead.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Email:</span> <span class="value">${lead.email}</span>
            </div>
            ${lead.phone ? `<div class="detail-row"><span class="label">Phone:</span> <span class="value">${lead.phone}</span></div>` : ''}
          </div>

          <p style="text-align: center;">
            <a href="${baseUrl}/schedule?showingId=${showing.id}" class="button">View in Dashboard</a>
          </p>

          <p><strong>Calendar Invite Attached</strong><br/>
          A calendar invite (.ics file) is attached to this email. Add it to your Google Calendar, Outlook, or Apple Calendar.</p>
          
          <div class="footer" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px;">Powered by</p>
            <p style="margin: 0; color: #2560E8; font-size: 14px; font-weight: 500;">Lead2Lease</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Build attachments array with calendar invite and logo
  const attachments: any[] = [
    {
      filename: 'showing.ics',
      content: calendarInvite,
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    },
  ];
  
  // Add logo attachment for CID reference (Gmail blocks base64 data URIs)
  const logoAttachment = getLogoAttachment();
  if (logoAttachment) {
    attachments.push(logoAttachment);
  }

  await transporter.sendMail({
    from: '"Lead2Lease Showings" <lead2leaseai@gmail.com>',
    to: managerEmail,
    subject: `New Showing Booked: ${property.name} - ${formattedDate} at ${formattedTime}`,
    html: managerEmailHtml,
    attachments,
  });

  console.log("[Notifications] Manager email sent to", managerEmail);
}

/**
 * Send showing confirmation to the lead/tenant
 */
async function sendLeadConfirmation(
  showing: Showing,
  property: Property,
  lead: Lead,
  managerEmail: string,
  unitNumber?: string,
  storage?: IStorage,
  eventName?: string,
  eventDescription?: string,
  assignedMember?: User | null,
  organization?: any | null
): Promise<void> {
  // Build description with event name and description prominently displayed
  let descriptionParts: string[] = [];
  
  // Start with event name if available
  if (eventName) {
    descriptionParts.push(`Event: ${eventName}`);
  }
  
  // Add event description if available
  if (eventDescription) {
    descriptionParts.push(`\n${eventDescription}`);
  }
  
  // Add property details
  const apartmentInfo = unitNumber ? `\nApartment ${unitNumber}` : '';
  descriptionParts.push(`\n\nProperty: ${property.name}`);
  descriptionParts.push(`Address: ${property.address}${apartmentInfo}`);
  
  // Add event time and duration after address
  const eventTime = formatTime(showing.scheduledTime);
  const endTimeMinutes = (showing.scheduledTime.split(':')[0] as any) * 60 + parseInt(showing.scheduledTime.split(':')[1]) + (showing.durationMinutes || 30);
  const endHours = Math.floor(endTimeMinutes / 60) % 24;
  const endMins = endTimeMinutes % 60;
  const endTimeStr = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  const endTime = formatTime(endTimeStr);
  descriptionParts.push(`\nEvent Time: ${eventTime} - ${endTime} (${showing.durationMinutes || 30} minutes)`);
  
  // Note: Assigned member info is added by calendarInvite function, not here to avoid duplication
  
  descriptionParts.push(`\n\nPlease arrive on time. If you need to cancel or reschedule, please contact us.`);
  
  const fullDescription = descriptionParts.join('\n');
  
  // Build manage booking URL
  const manageBookingUrl = showing.id 
    ? `${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : (process.env.PUBLIC_URL || 'http://localhost:5000')}/showing/${showing.id}`
    : undefined;
  
  const calendarInvite = generateCalendarInvite({
    uid: showing.id,
    title: eventName || `Property Showing: ${property.name}`,
    description: fullDescription,
    location: property.address,
    startDate: showing.scheduledDate,
    startTime: showing.scheduledTime,
    durationMinutes: showing.durationMinutes || 30,
    organizerName: "Lead2Lease",
    organizerEmail: managerEmail,
    attendeeEmail: lead.email,
    attendeeName: lead.name,
    unitNumber: unitNumber,
    manageBookingUrl: manageBookingUrl,
    organizationName: organization?.name,
    assignedContact: assignedMember ? {
      name: `${assignedMember.firstName || ''} ${assignedMember.lastName || ''}`.trim(),
      email: assignedMember.email,
      phone: assignedMember.phone,
    } : undefined,
  });

  const formattedDate = formatDate(showing.scheduledDate);
  const formattedTime = formatTime(showing.scheduledTime);

  // Build apartment row for email if unit number provided
  const apartmentRow = unitNumber 
    ? `<div class="detail-row"><span class="label"></span> <span class="value" style="color: #64748b;">Apartment ${unitNumber}</span></div>`
    : '';

  const leadEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; width: 100%; box-sizing: border-box; }
        .header { background: linear-gradient(135deg, #2560E8 0%, #2560E8 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; width: 100%; box-sizing: border-box; }
        .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2560E8; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .ajT { display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; overflow: hidden !important; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">Your Showing is Confirmed!</h1>
        </div>
        <div class="content">
          <p>Hi ${lead.name},</p>
          <p>Great news! Your property showing has been confirmed.</p>
          
          ${organization ? `
          <div style="margin: 20px 0; padding: 15px; background: white; border-radius: 8px;">
            ${organization.name ? `<h3 style="margin: 0 0 5px 0; color: #1e293b; font-size: 18px; font-weight: 600; line-height: 1.2;">${organization.name}</h3>` : ''}
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.4;">Property Management Company</p>
          </div>
          ` : ''}
          
          <div class="booking-details">
            <h2 style="margin-top: 0; color: #2560E8;">Showing Details</h2>
            ${eventName ? `<div class="detail-row"><span class="label">Event:</span> <span class="value" style="font-weight: bold;">${eventName}</span></div>` : ''}
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${property.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span> <span class="value">${property.address}</span>
            </div>
            ${apartmentRow}
            <div class="detail-row">
              <span class="label">Date:</span> <span class="value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> <span class="value">${formattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">Duration:</span> <span class="value">${showing.durationMinutes || 30} minutes</span>
            </div>
            ${eventDescription ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Description:</span><div class="value" style="margin-top: 5px;">${eventDescription.replace(/\n/g, '<br>')}</div></div>` : ''}
            ${assignedMember ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Your Contact:</span><div class="value" style="margin-top: 5px;">${assignedMember.firstName || ''} ${assignedMember.lastName || ''}${assignedMember.email ? `<br>Email: ${assignedMember.email}` : ''}${assignedMember.phone ? `<br>Phone: ${assignedMember.phone}` : ''}</div></div>` : ''}
          </div>

          <p><strong>Calendar Invite Attached</strong><br/>
          A calendar invite (.ics file) is attached to this email. Add it to your calendar so you don't forget!</p>

          <p>If you need to cancel or reschedule, please contact us as soon as possible.</p>

          <div style="margin: 30px 0; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #2560E8;">
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #1e293b;">Manage Your Booking</p>
            <p style="margin: 0 0 15px 0; color: #64748b;">Need to cancel or reschedule your showing?</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <a href="${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : (process.env.PUBLIC_URL || 'http://localhost:5000')}/showing/${showing.id}" style="display: inline-block; padding: 10px 20px; background: #2560E8; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View & Manage Booking</a>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #94a3b8;">You can cancel or reschedule your showing from the link above. No account required.</p>
          </div>
          
          <div class="footer" style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0 0 5px 0; color: #94a3b8; font-size: 12px;">Powered by</p>
            <p style="margin: 0; color: #2560E8; font-size: 14px; font-weight: 500;">Lead2Lease</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  // Build attachments array with calendar invite (no logo)
  const leadAttachments: any[] = [
    {
      filename: 'showing.ics',
      content: calendarInvite,
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    },
  ];

  await transporter.sendMail({
    from: '"Lead2Lease Showings" <lead2leaseai@gmail.com>',
    to: lead.email,
    subject: `Showing Confirmed: ${property.name} - ${formattedDate} at ${formattedTime}`,
    html: leadEmailHtml,
    attachments: leadAttachments,
  });

  console.log("[Notifications] Lead confirmation sent to", lead.email);
}

/**
 * Create in-app notifications for property managers
 */
async function createInAppNotifications(
  showing: Showing,
  property: Property,
  lead: Lead,
  storage: IStorage
): Promise<void> {
  // Get all users in the property's organization
  // For now, we'll send to all org members. In future, could filter by role/permissions
  const orgUsers = await storage.getUsersByOrg(property.orgId);
  
  const formattedDate = formatDate(showing.scheduledDate);
  const formattedTime = formatTime(showing.scheduledTime);

  // Create notification for each org member
  for (const user of orgUsers) {
    await storage.createNotification({
      userId: user.id,
      orgId: property.orgId,
      title: "New Showing Booked",
      message: `${lead.name} booked a showing for ${property.name} on ${formattedDate} at ${formattedTime}`,
      type: "showing",
      metadata: {
        showingId: showing.id,
        propertyId: property.id,
        leadId: lead.id,
      },
      read: false,
    });
  }

  console.log(`[Notifications] Created in-app notifications for ${orgUsers.length} users`);
}

/**
 * Send all notifications for a public showing booking
 */
export async function notifyPublicShowingBooked(
  showing: Showing,
  property: Property,
  lead: Lead,
  storage: IStorage,
  unitNumber?: string
): Promise<void> {
  try {
    // Validate EMAIL_PASSWORD is configured before attempting to send
    if (!process.env.EMAIL_PASSWORD) {
      console.error("[Notifications] EMAIL_PASSWORD not configured - skipping email notifications");
      // Still create in-app notifications even if email fails
      await createInAppNotifications(showing, property, lead, storage);
      return;
    }

    // Get org users to determine manager email
    const orgUsers = await storage.getUsersByOrg(property.orgId);
    
    // Require at least one org user to send notifications
    if (!orgUsers || orgUsers.length === 0) {
      console.error("[Notifications] No users found for organization - cannot send manager email");
      // Lead confirmation can still be sent without manager
      const organization = await storage.getOrganization(property.orgId);
      await sendLeadConfirmation(showing, property, lead, "lead2leaseai@gmail.com", unitNumber, storage, undefined, undefined, undefined, organization);
      return;
    }

    // Use first org user's email as manager/organizer
    // TODO: In production, should query for users with 'manager' or 'owner' role
    const managerEmail = orgUsers[0].email;

    // Get assigned member details if assignedTo exists
    let assignedMember: User | null = null;
    if (showing.assignedTo) {
      assignedMember = await storage.getUser(showing.assignedTo) || null;
    }

    // Get event description from unit or property settings
    let eventDescription = "";
    let unit: any = null;
    if ((showing as any).unitId) {
      unit = await storage.getPropertyUnit((showing as any).unitId, property.orgId);
      const unitSettings = await storage.getUnitSchedulingSettings((showing as any).unitId, property.orgId);
      const propertySettings = await storage.getPropertySchedulingSettings(property.id, property.orgId);
      eventDescription = unitSettings?.customEventDescription || propertySettings?.eventDescription || "";
    } else {
      const propertySettings = await storage.getPropertySchedulingSettings(property.id, property.orgId);
      eventDescription = propertySettings?.eventDescription || "";
    }

    // Replace variables in event description
    if (eventDescription) {
      // Format property amenities as comma-separated list
      const propertyAmenitiesStr = property.amenities && property.amenities.length > 0
        ? property.amenities.join(', ')
        : '';
      
      // Format property address
      const propertyAddressParts = [
        property.address,
        (property as any).city,
        (property as any).state,
        (property as any).zipCode
      ].filter(Boolean);
      const propertyAddressStr = propertyAddressParts.join(', ');
      
      // Format unit rent with currency (if unit exists)
      const unitRentStr = unit?.monthlyRent 
        ? `$${parseFloat(unit.monthlyRent).toLocaleString()}/mo`
        : '';
      
      // Format security deposit with currency (if unit exists)
      const securityDepositStr = unit?.deposit
        ? `$${parseFloat(unit.deposit).toLocaleString()}`
        : '';
      
      // Define safe replacement mapping with all available variables
      const variables: Record<string, string> = {
        '{unit_number}': unit?.unitNumber || '',
        '{bedrooms}': unit?.bedrooms?.toString() || (property as any).bedrooms?.toString() || '',
        '{bathrooms}': unit?.bathrooms || (property as any).bathrooms || '',
        '{unit_rent}': unitRentStr,
        '{security_deposit}': securityDepositStr,
        '{property_amenities}': propertyAmenitiesStr,
        '{property_address}': propertyAddressStr,
        '{property_name}': property.name || ''
      };
      
      // Replace each variable
      for (const [placeholder, value] of Object.entries(variables)) {
        // Escape regex special characters in placeholder for safe replacement
        const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        eventDescription = eventDescription.replace(new RegExp(escapedPlaceholder, 'g'), value);
      }
    }

    // Event name is stored in showing.title (already has variables replaced)
    const eventName = showing.title || `Showing for ${property.name}`;

    // Fetch organization for email display
    const organization = await storage.getOrganization(property.orgId);

    // Send notifications in parallel
    await Promise.all([
      sendManagerNotification(showing, property, lead, managerEmail, unitNumber, eventName, eventDescription, assignedMember),
      sendLeadConfirmation(showing, property, lead, managerEmail, unitNumber, storage, eventName, eventDescription, assignedMember, organization),
      createInAppNotifications(showing, property, lead, storage),
    ]);

    console.log("[Notifications] All public showing notifications sent successfully");
  } catch (error) {
    console.error("[Notifications] Error sending public showing notifications:", error);
    // Don't throw - we don't want notification failures to prevent booking
    // The showing is already created, notifications are best-effort
  }
}
