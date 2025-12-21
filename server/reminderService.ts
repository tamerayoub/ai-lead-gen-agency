/**
 * Reminder service for scheduled showings
 * Checks for upcoming showings and sends reminder emails based on configured reminder settings
 */

import nodemailer from "nodemailer";
import type { IStorage } from "./storage";
import type { Showing, Property, Lead, PropertyUnit } from "../shared/schema";

interface ReminderSettings {
  enabled: boolean;
  count: number;
  times: number[]; // Array of minutes before event
  message?: string;
  email?: boolean;
  text?: boolean;
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
 * Get reminder settings for a showing (unit-level or property-level)
 */
async function getReminderSettings(
  showing: Showing,
  storage: IStorage
): Promise<ReminderSettings | null> {
  // First check unit-level settings if unitId exists
  if (showing.unitId) {
    const unitSettings = await storage.getUnitSchedulingSettings(showing.unitId, showing.orgId);
    if (unitSettings?.customReminderSettings) {
      const custom = unitSettings.customReminderSettings as any;
      if (custom.enabled === true) {
        return {
          enabled: true,
          count: custom.count || 1,
          times: custom.times || [1440],
          message: custom.message,
          email: custom.email !== false,
          text: custom.text || false,
        };
      }
    }
  }

  // Fall back to property-level settings
  const propertySettings = await storage.getPropertySchedulingSettings(showing.propertyId, showing.orgId);
  if (propertySettings?.reminderSettings) {
    const reminder = propertySettings.reminderSettings as any;
    if (reminder.enabled === true) {
      return {
        enabled: true,
        count: reminder.count || 1,
        times: reminder.times || [1440],
        message: reminder.message,
        email: reminder.email !== false,
        text: reminder.text || false,
      };
    }
  }

  return null;
}

/**
 * Send reminder email to lead
 */
async function sendReminderEmailToLead(
  showing: Showing,
  property: Property,
  lead: Lead,
  unitNumber?: string,
  reminderMessage?: string,
  eventName?: string,
  eventDescription?: string,
  assignedMember?: { email: string; firstName?: string | null; lastName?: string | null; phone?: string | null } | null
): Promise<void> {
  // Validate EMAIL_PASSWORD is configured (same as reschedule email)
  const emailPassword = process.env.EMAIL_PASSWORD;
  if (!emailPassword) {
    console.error("[Reminders] EMAIL_PASSWORD not configured - cannot send reminder email");
    throw new Error("EMAIL_PASSWORD environment variable is not set");
  }

  // Get the email user (from env or default) - using lead2leaseai@gmail.com
  const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";
  console.log(`[Reminders] ===== REMINDER EMAIL CONFIGURATION =====`);
  console.log(`[Reminders] Using email account: ${emailUser}`);
  console.log(`[Reminders] EMAIL_PASSWORD is set: ${!!emailPassword}`);
  console.log(`[Reminders] EMAIL_USER from env: ${process.env.EMAIL_USER || 'NOT SET (using default lead2leaseai@gmail.com)'}`);

  // Create transporter with validated credentials (same as reschedule email)
  const emailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });

  console.log(`[Reminders] Transporter created successfully`);

  const formattedDate = formatDate(showing.scheduledDate);
  const formattedTime = formatTime(showing.scheduledTime);
  const apartmentInfo = unitNumber ? `\nApartment ${unitNumber}` : '';

  const message = reminderMessage || `This is a reminder for your upcoming showing at ${property.name}.`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .showing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reminder: Upcoming Showing</h1>
        </div>
        <div class="content">
          <p>Hi ${lead.name || 'there'},</p>
          <p>${message}</p>
          
          <div class="showing-details">
            <h2 style="margin-top: 0; color: #2563eb;">Showing Details</h2>
            ${eventName ? `<div class="detail-row"><span class="label">Event:</span> <span class="value" style="font-weight: bold;">${eventName}</span></div>` : ''}
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${property.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span> <span class="value">${property.address}</span>
            </div>
            ${unitNumber ? `<div class="detail-row"><span class="label">Apartment:</span> <span class="value">${unitNumber}</span></div>` : ''}
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

          <p><strong>Please arrive on time.</strong> If you need to cancel or reschedule, please contact us.</p>
          
          <div class="footer">
            <p>Lead2Lease - AI-Powered Leasing Automation Software</p>
            <p>Email: lead2leaseai@gmail.com</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await emailTransporter.sendMail({
    from: `"Lead2Lease Showings" <${emailUser}>`,
    to: lead.email,
    subject: `Reminder: Showing at ${property.name} - ${formattedDate} at ${formattedTime}`,
    html: emailHtml,
  });

  console.log(`[Reminders] ===== REMINDER EMAIL SENT TO LEAD =====`);
  console.log(`[Reminders] Reminder email sent to ${lead.email} for showing ${showing.id}`);
  console.log(`[Reminders] Property: ${property.name}, Date: ${formattedDate}, Time: ${formattedTime}`);
}

/**
 * Send reminder email to assigned member
 */
async function sendReminderEmailToAssignedMember(
  showing: Showing,
  property: Property,
  assignedMember: { email: string; firstName?: string | null; lastName?: string | null },
  lead: Lead,
  unitNumber?: string,
  reminderMessage?: string,
  eventName?: string,
  eventDescription?: string
): Promise<void> {
  // Validate EMAIL_PASSWORD is configured (same as reschedule email)
  const emailPassword = process.env.EMAIL_PASSWORD;
  if (!emailPassword) {
    console.error("[Reminders] EMAIL_PASSWORD not configured - cannot send reminder email");
    throw new Error("EMAIL_PASSWORD environment variable is not set");
  }

  // Get the email user (from env or default) - using lead2leaseai@gmail.com
  const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";

  // Create transporter with validated credentials (same as reschedule email)
  const emailTransporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });

  const formattedDate = formatDate(showing.scheduledDate);
  const formattedTime = formatTime(showing.scheduledTime);
  const apartmentInfo = unitNumber ? `\nApartment ${unitNumber}` : '';
  const memberName = assignedMember.firstName && assignedMember.lastName
    ? `${assignedMember.firstName} ${assignedMember.lastName}`
    : assignedMember.email;

  const message = reminderMessage || `This is a reminder for your upcoming showing at ${property.name}.`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
        .showing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Reminder: Upcoming Showing</h1>
        </div>
        <div class="content">
          <p>Hi ${memberName},</p>
          <p>${message}</p>
          
          <div class="showing-details">
            <h2 style="margin-top: 0; color: #2563eb;">Showing Details</h2>
            <div class="detail-row">
              <span class="label">Lead:</span> <span class="value">${lead.name || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${property.name}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span> <span class="value">${property.address}</span>
            </div>
            ${unitNumber ? `<div class="detail-row"><span class="label">Apartment:</span> <span class="value">${unitNumber}</span></div>` : ''}
            <div class="detail-row">
              <span class="label">Date:</span> <span class="value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> <span class="value">${formattedTime}</span>
            </div>
            <div class="detail-row">
              <span class="label">Duration:</span> <span class="value">${showing.durationMinutes || 30} minutes</span>
            </div>
          </div>

          <p><strong>Please be prepared for the showing.</strong> If you need to cancel or reschedule, please contact the lead.</p>
          
          <div class="footer">
            <p>Lead2Lease - AI-Powered Leasing Automation Software</p>
            <p>Email: lead2leaseai@gmail.com</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  await emailTransporter.sendMail({
    from: `"Lead2Lease Showings" <${emailUser}>`,
    to: assignedMember.email,
    subject: `Reminder: Showing at ${property.name} - ${formattedDate} at ${formattedTime}`,
    html: emailHtml,
  });

  console.log(`[Reminders] ===== REMINDER EMAIL SENT TO ASSIGNED MEMBER =====`);
  console.log(`[Reminders] Reminder email sent to ${assignedMember.email} for showing ${showing.id}`);
  console.log(`[Reminders] Property: ${property.name}, Date: ${formattedDate}, Time: ${formattedTime}`);
}

/**
 * Check and send reminders for upcoming showings
 */
export async function checkAndSendReminders(storage: IStorage): Promise<void> {
  try {
    // Validate EMAIL_PASSWORD before processing
    if (!process.env.EMAIL_PASSWORD) {
      console.error("[Reminders] EMAIL_PASSWORD not configured - skipping reminder check");
      return;
    }

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split('T')[0];

    console.log(`[Reminders] ===== STARTING REMINDER CHECK =====`);
    console.log(`[Reminders] Current time: ${now.toISOString()}`);
    console.log(`[Reminders] Current date: ${today}`);

    // Get all upcoming showings (today and future, not cancelled)
    const allShowings = await storage.getAllShowings();
    const upcomingShowings = allShowings.filter(showing => {
      if (showing.status === 'cancelled') return false;
      const showingDate = showing.scheduledDate;
      const showingTime = showing.scheduledTime.split(':').map(Number);
      const showingMinutes = showingTime[0] * 60 + showingTime[1];
      const showingDateTime = new Date(`${showingDate}T${showing.scheduledTime}:00`);

      // Only process showings in the future
      return showingDateTime > now;
    });

    console.log(`[Reminders] Found ${upcomingShowings.length} upcoming showings (out of ${allShowings.length} total)`);

    for (const showing of upcomingShowings) {
      try {
        console.log(`[Reminders] Processing showing ${showing.id}:`);
        console.log(`[Reminders]   - Date: ${showing.scheduledDate}, Time: ${showing.scheduledTime}`);
        console.log(`[Reminders]   - Property ID: ${showing.propertyId}, Unit ID: ${showing.unitId || 'none'}`);
        console.log(`[Reminders]   - Lead ID: ${showing.leadId || 'none'}`);
        
        const reminderSettings = await getReminderSettings(showing, storage);
        if (!reminderSettings) {
          console.log(`[Reminders]   - No reminder settings found (reminders disabled or not configured)`);
          continue;
        }
        if (!reminderSettings.enabled) {
          console.log(`[Reminders]   - Reminders disabled in settings`);
          continue;
        }
        if (!reminderSettings.email) {
          console.log(`[Reminders]   - Email reminders disabled (only SMS enabled)`);
          continue;
        }
        console.log(`[Reminders]   - Reminder settings found: ${reminderSettings.count} reminder(s), times: ${reminderSettings.times.join(', ')} minutes before`);

        // Get property, lead, assigned member, and unit details
        const property = await storage.getProperty(showing.propertyId, showing.orgId);
        if (!property) {
          console.log(`[Reminders]   - Property not found: ${showing.propertyId}`);
          continue;
        }

        const lead = showing.leadId ? await storage.getLead(showing.leadId, showing.orgId) : null;
        if (!lead) {
          console.log(`[Reminders]   - Lead not found: ${showing.leadId}`);
          continue;
        }

        // Get assigned member if assignedTo exists
        let assignedMember: { email: string; firstName?: string | null; lastName?: string | null } | null = null;
        if (showing.assignedTo) {
          const assignedUser = await storage.getUser(showing.assignedTo);
          if (assignedUser && assignedUser.email) {
            assignedMember = {
              email: assignedUser.email,
              firstName: assignedUser.firstName,
              lastName: assignedUser.lastName,
            };
            console.log(`[Reminders]   - Assigned member found: ${assignedMember.email}`);
          } else {
            console.log(`[Reminders]   - Assigned member not found or has no email: ${showing.assignedTo}`);
          }
        } else {
          console.log(`[Reminders]   - No assigned member for this showing`);
        }

        let unitNumber: string | undefined;
        if (showing.unitId) {
          const unit = await storage.getPropertyUnit(showing.unitId, showing.orgId);
          unitNumber = unit?.unitNumber;
        }

        // Get event name (from showing.title) and description
        const eventName = showing.title || null;
        let eventDescription = "";
        if (showing.unitId) {
          const unitSettings = await storage.getUnitSchedulingSettings(showing.unitId, showing.orgId);
          const propertySettings = await storage.getPropertySchedulingSettings(property.id, showing.orgId);
          eventDescription = unitSettings?.customEventDescription || propertySettings?.eventDescription || "";
        } else {
          const propertySettings = await storage.getPropertySchedulingSettings(property.id, showing.orgId);
          eventDescription = propertySettings?.eventDescription || "";
        }

        // Get full assigned member details (including phone)
        let fullAssignedMember: { email: string; firstName?: string | null; lastName?: string | null; phone?: string | null } | null = null;
        if (assignedMember) {
          const assignedUser = await storage.getUser(showing.assignedTo!);
          if (assignedUser) {
            fullAssignedMember = {
              email: assignedUser.email,
              firstName: assignedUser.firstName,
              lastName: assignedUser.lastName,
              phone: assignedUser.phone,
            };
          }
        }

        // Calculate time until showing
        const showingDate = showing.scheduledDate;
        const showingTime = showing.scheduledTime.split(':').map(Number);
        const showingDateTime = new Date(`${showingDate}T${showing.scheduledTime}:00`);
        const minutesUntilShowing = Math.floor((showingDateTime.getTime() - now.getTime()) / (1000 * 60));
        
        console.log(`[Reminders]   - Minutes until showing: ${minutesUntilShowing}`);
        console.log(`[Reminders]   - Reminder times configured: ${reminderSettings.times.join(', ')} minutes before`);
        
        // Check if we need to send a reminder for any of the configured times
        for (const reminderMinutes of reminderSettings.times) {
          // Check if we're within the reminder window (within 3 minutes of the reminder time to account for timing)
          // Expanded window to ensure we catch reminders even with slight cron job delays
          const timeDifference = reminderMinutes - minutesUntilShowing;
          console.log(`[Reminders]   - Checking reminder time ${reminderMinutes} min: timeDifference=${timeDifference}, minutesUntilShowing=${minutesUntilShowing}`);
          
          if (timeDifference >= -3 && timeDifference <= 3) {
            console.log(`[Reminders]   - ✓ Within reminder window! Sending reminders...`);
            
            // Send reminder to lead
            try {
              await sendReminderEmailToLead(
                showing,
                property,
                lead,
                unitNumber,
                reminderSettings.message,
                eventName || undefined,
                eventDescription || undefined,
                fullAssignedMember
              );
              console.log(`[Reminders]   - ✓ Sent reminder to LEAD for showing ${showing.id} (${reminderMinutes} minutes before)`);
            } catch (emailError: any) {
              console.error(`[Reminders]   - ✗ Failed to send reminder to LEAD for showing ${showing.id}:`, emailError);
              console.error(`[Reminders] Email error details:`, {
                message: emailError.message,
                stack: emailError.stack,
                name: emailError.name,
              });
            }

            // Send reminder to assigned member if they exist
            if (assignedMember) {
              try {
                await sendReminderEmailToAssignedMember(
                  showing,
                  property,
                  assignedMember,
                  lead,
                  unitNumber,
                  reminderSettings.message,
                  eventName || undefined,
                  eventDescription || undefined
                );
                console.log(`[Reminders]   - ✓ Sent reminder to ASSIGNED MEMBER for showing ${showing.id} (${reminderMinutes} minutes before)`);
              } catch (emailError: any) {
                console.error(`[Reminders]   - ✗ Failed to send reminder to ASSIGNED MEMBER for showing ${showing.id}:`, emailError);
                console.error(`[Reminders] Email error details:`, {
                  message: emailError.message,
                  stack: emailError.stack,
                  name: emailError.name,
                });
              }
            } else {
              console.log(`[Reminders]   - No assigned member to send reminder to`);
            }
          } else {
            console.log(`[Reminders]   - Not yet time for ${reminderMinutes} min reminder (need ${reminderMinutes} min before, currently ${minutesUntilShowing} min before)`);
          }
        }
      } catch (error) {
        console.error(`[Reminders] Error processing reminder for showing ${showing.id}:`, error);
      }
    }
  } catch (error) {
    console.error("[Reminders] Error checking reminders:", error);
  }
}

/**
 * Start the reminder checking service
 * Runs every minute to check for reminders that need to be sent
 */
export function startReminderService(storage: IStorage): void {
  console.log("[Reminders] Starting reminder service");
  
  // Check immediately on start
  checkAndSendReminders(storage).catch(err => {
    console.error("[Reminders] Error in initial reminder check:", err);
  });

  // Then check every minute
  setInterval(() => {
    checkAndSendReminders(storage).catch(err => {
      console.error("[Reminders] Error in reminder check:", err);
    });
  }, 60 * 1000); // Every minute

  console.log("[Reminders] Reminder service started - checking every minute");
}

