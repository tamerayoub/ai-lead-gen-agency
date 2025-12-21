/**
 * Reminder Scheduler Service
 * Checks for upcoming showings and sends reminder emails to leads
 * Runs periodically (every 1 minute) to check for reminders that need to be sent
 */

import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { DateTime } from "luxon";
import { storage } from "./storage";
import { db } from "./db";
import { showings, propertySchedulingSettings, properties, leads, propertyUnits } from "@shared/schema";
import { eq, and, gte, lte, or, inArray, not, isNull } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ReminderSettings {
  enabled: boolean;
  count: number;
  times: number[]; // Array of times in minutes before showing
  message?: string;
  email?: boolean;
  text?: boolean;
}

// Create transporter function to ensure it uses current env vars
function getTransporter() {
  const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";
  const emailPassword = process.env.EMAIL_PASSWORD;
  
  if (!emailPassword) {
    console.error("[Reminder Scheduler] ⚠️ EMAIL_PASSWORD not set - cannot send reminder emails");
    return null;
  }
  
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
}

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
          console.log('[Reminder] Logo base64 loaded from:', logoPath, 'length:', content.length);
          LOGO_BASE64_CONTENT = content;
          return LOGO_BASE64_CONTENT;
        }
      }
    } catch (error) {
      // Continue to next path
    }
  }
  
  console.warn('[Reminder] Logo base64 file not found in any expected location');
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
 * Format reminder time for display (e.g., "1 hour", "30 minutes")
 */
function formatReminderTime(minutes: number): string {
  if (minutes >= 1440) {
    const days = Math.floor(minutes / 1440);
    return days === 1 ? '1 day' : `${days} days`;
  } else if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes} minutes`;
}

/**
 * Send reminder email to lead
 */
async function sendReminderEmail(
  leadEmail: string,
  leadName: string,
  propertyName: string,
  propertyAddress: string,
  unitNumber: string | null,
  scheduledDate: string,
  scheduledTime: string,
  reminderMinutes: number,
  customMessage?: string,
  eventName?: string | null,
  eventDescription?: string | null,
  assignedUser?: any | null,
  organization?: any | null,
  showingId?: string,
  durationMinutes?: number | null
): Promise<boolean> {
  // Organization parameter kept for backward compatibility but not used
  const formattedDate = formatDate(scheduledDate);
  const formattedTime = formatTime(scheduledTime);
  const reminderTimeStr = formatReminderTime(reminderMinutes);
  
  const apartmentInfo = unitNumber ? `<div class="detail-row"><span class="label">Unit:</span> <span class="value">Apartment ${unitNumber}</span></div>` : '';
  
  // Event name and description section
  const eventNameSection = eventName ? `<div class="detail-row"><span class="label">Event:</span> <span class="value" style="font-weight: bold;">${eventName}</span></div>` : '';
  const eventDescriptionSection = eventDescription ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Description:</span><div class="value" style="margin-top: 5px;">${eventDescription.replace(/\n/g, '<br>')}</div></div>` : '';
  
  // Duration section
  const durationSection = durationMinutes ? `<div class="detail-row"><span class="label">Duration:</span> <span class="value">${durationMinutes} minutes</span></div>` : '';
  
  // Assigned member section
  const assignedMemberSection = assignedUser ? `<div class="detail-row" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e2e8f0;"><span class="label">Your Contact:</span><div class="value" style="margin-top: 5px;">${assignedUser.firstName || ''} ${assignedUser.lastName || ''}${assignedUser.email ? `<br>Email: ${assignedUser.email}` : ''}${assignedUser.phone ? `<br>Phone: ${assignedUser.phone}` : ''}</div></div>` : '';
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; width: 100%; box-sizing: border-box; }
        .header { background: linear-gradient(135deg, #2560E8 0%, #2560E8 100%); color: white; padding: 15px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; width: 100%; box-sizing: border-box; }
        .reminder-badge { background: #fef3c7; color: #92400e; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 15px; }
        .showing-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2560E8; }
        .detail-row { margin: 10px 0; }
        .label { font-weight: bold; color: #64748b; }
        .value { color: #1e293b; }
        .custom-message { background: #e0f2fe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9; }
        .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; }
        .ajT { display: none !important; visibility: hidden !important; height: 0 !important; width: 0 !important; overflow: hidden !important; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 20px;">Showing Reminder</h1>
        </div>
        <div class="content">
          <div class="reminder-badge">Starting in ${reminderTimeStr}</div>
          
          <p>Hi ${leadName},</p>
          <p>This is a friendly reminder about your upcoming property showing!</p>
          
          ${organization ? `
          <div style="margin: 20px 0; padding: 15px; background: white; border-radius: 8px;">
            ${organization.name ? `<h3 style="margin: 0 0 5px 0; color: #1e293b; font-size: 18px; font-weight: 600; line-height: 1.2;">${organization.name}</h3>` : ''}
            <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.4;">Property Management Company</p>
          </div>
          ` : ''}
          
          <div class="showing-details">
            <h2 style="margin-top: 0; color: #2560E8;">Showing Details</h2>
            ${eventNameSection}
            <div class="detail-row">
              <span class="label">Property:</span> <span class="value">${propertyName}</span>
            </div>
            <div class="detail-row">
              <span class="label">Address:</span> <span class="value">${propertyAddress}</span>
            </div>
            ${apartmentInfo}
            <div class="detail-row">
              <span class="label">Date:</span> <span class="value">${formattedDate}</span>
            </div>
            <div class="detail-row">
              <span class="label">Time:</span> <span class="value">${formattedTime}</span>
            </div>
            ${durationSection}
            ${eventDescriptionSection}
            ${assignedMemberSection}
          </div>
          
          ${customMessage ? `<div class="custom-message"><p style="margin: 0;">${customMessage}</p></div>` : ''}
          
          <p>We look forward to seeing you!</p>
          
          ${showingId ? `
          <div style="margin: 30px 0; padding: 20px; background: white; border-radius: 8px; border-left: 4px solid #2560E8;">
            <p style="margin: 0 0 15px 0; font-weight: bold; color: #1e293b;">Manage Your Booking</p>
            <p style="margin: 0 0 15px 0; color: #64748b;">Need to cancel or reschedule your showing?</p>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <a href="${process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : (process.env.PUBLIC_URL || 'http://localhost:5000')}/showing/${showingId}" style="display: inline-block; padding: 10px 20px; background: #2560E8; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">View & Manage Booking</a>
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

  const emailText = `
Showing Reminder - Starting in ${reminderTimeStr}

Hi ${leadName},

This is a friendly reminder about your upcoming property showing!

Showing Details:
Property: ${propertyName}
Address: ${propertyAddress}${unitNumber ? `\nUnit: Apartment ${unitNumber}` : ''}
Date: ${formattedDate}
Time: ${formattedTime}${durationMinutes ? `\nDuration: ${durationMinutes} minutes` : ''}${eventDescription ? `\n\nDescription:\n${eventDescription}` : ''}

${customMessage ? `\n${customMessage}\n` : ''}

We look forward to seeing you!

If you need to reschedule or cancel, please contact us as soon as possible.

Powered by Lead2Lease
  `.trim();

  try {
    // Get transporter (creates new one each time to ensure fresh credentials)
    const transporter = getTransporter();
    if (!transporter) {
      console.error(`[Reminder Scheduler] Cannot send reminder - transporter not available (EMAIL_PASSWORD not set)`);
      return false;
    }
    
    // Build attachments array (no logo)
    const reminderAttachments: any[] = [];
    
    const emailUser = process.env.EMAIL_USER || "lead2leaseai@gmail.com";

    console.log(`[Reminder Scheduler] Attempting to send reminder email to ${leadEmail}...`);
    const result = await transporter.sendMail({
      from: `"Lead2Lease" <${emailUser}>`,
      to: leadEmail,
      subject: `Reminder: Property Showing in ${reminderTimeStr} - ${propertyName}`,
      text: emailText,
      html: emailHtml,
      attachments: reminderAttachments,
    });
    
    console.log(`[Reminder Scheduler] ✅ Successfully sent ${reminderTimeStr} reminder to ${leadEmail} for showing at ${propertyName}`);
    console.log(`[Reminder Scheduler] Email message ID: ${result.messageId}`);
    return true;
  } catch (error: any) {
    console.error(`[Reminder Scheduler] ❌ Failed to send reminder email to ${leadEmail}:`, error);
    console.error(`[Reminder Scheduler] Error details:`, {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    return false;
  }
}

export class ReminderScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;
  private checkIntervalMs: number = 60 * 1000; // Check every 1 minute

  constructor(checkIntervalMs?: number) {
    if (checkIntervalMs) {
      this.checkIntervalMs = checkIntervalMs;
    }
  }

  async start() {
    if (this.intervalId) {
      console.log("[Reminder Scheduler] Already running");
      return;
    }

    // Check if email password is configured
    if (!process.env.EMAIL_PASSWORD) {
      console.warn("[Reminder Scheduler] ⚠️ EMAIL_PASSWORD not set, reminder emails will not be sent");
      // Still start the scheduler so we can log when reminders would be sent
    } else {
      console.log("[Reminder Scheduler] ✓ EMAIL_PASSWORD is configured");
    }

    console.log(`[Reminder Scheduler] Starting with ${this.checkIntervalMs / 1000}s interval`);
    
    this.intervalId = setInterval(() => {
      this.processReminders().catch(error => {
        console.error("[Reminder Scheduler] Error during processing:", error);
      });
    }, this.checkIntervalMs);

    // Run initial check after 5 seconds (reduced from 15 for faster startup)
    setTimeout(() => {
      this.processReminders().catch(error => {
        console.error("[Reminder Scheduler] Error during initial check:", error);
      });
    }, 5000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[Reminder Scheduler] Stopped");
    }
  }

  private async processReminders() {
    if (this.isProcessing) {
      console.log("[Reminder Scheduler] Processing already in progress, skipping");
      return;
    }

    this.isProcessing = true;
    
    // Log start of processing
    console.log(`[Reminder Scheduler] ===== Starting reminder check at ${new Date().toISOString()} =====`);
    console.log(`[Reminder Scheduler] EMAIL_PASSWORD configured: ${!!process.env.EMAIL_PASSWORD}`);
    console.log(`[Reminder Scheduler] EMAIL_USER: ${process.env.EMAIL_USER || 'lead2leaseai@gmail.com (default)'}`);

    try {
      // Get all confirmed/approved showings in the future (not just next 24 hours)
      // We need to check all upcoming showings because reminders can be configured for any time before the showing
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Fetch upcoming showings with their property and lead info
      // Get all showings that are scheduled for today or in the future
      const upcomingShowings = await db
        .select({
          showing: showings,
          property: properties,
          lead: leads,
          unit: propertyUnits,
        })
        .from(showings)
        .innerJoin(properties, eq(showings.propertyId, properties.id))
        .leftJoin(leads, eq(showings.leadId, leads.id))
        .leftJoin(propertyUnits, eq(showings.unitId, propertyUnits.id))
        .where(
          and(
            or(
              eq(showings.status, 'confirmed'),
              eq(showings.status, 'approved'),
              eq(showings.status, 'pending')
            ),
            gte(showings.scheduledDate, todayStr) // Get all showings from today onwards
          )
        );

      if (upcomingShowings.length === 0) {
        console.log(`[Reminder Scheduler] No upcoming showings found`);
        return;
      }

      console.log(`[Reminder Scheduler] Found ${upcomingShowings.length} upcoming showings to check`);

      // Process each showing
      for (const { showing, property, lead, unit } of upcomingShowings) {
        if (!lead || !lead.email) {
          console.log(`[Reminder Scheduler] Skipping showing ${showing.id}: no lead or email`);
          continue;
        }

        // Get reminder settings for this showing (unit settings override property settings)
        let reminderSettings: ReminderSettings | null = null;

        if (showing.unitId && unit) {
          // Check unit-level settings first (stored directly on propertyUnits table)
          // customReminderSettings directly contains the reminder config if enabled
          const customSettings = (unit as any).customReminderSettings;
          
          // If customReminderSettings exists and is enabled, use it
          if (customSettings && customSettings.enabled) {
            reminderSettings = {
              enabled: true,
              count: customSettings.count || 1,
              times: customSettings.times || [60],
              message: customSettings.message,
              email: customSettings.email !== false,
              text: customSettings.text || false,
            };
          }
        }

        // Fall back to property-level settings if no unit settings
        if (!reminderSettings) {
          const propSettings = await db
            .select()
            .from(propertySchedulingSettings)
            .where(eq(propertySchedulingSettings.propertyId, property.id))
            .limit(1);

          if (propSettings.length > 0) {
            const settings = propSettings[0].reminderSettings as any;
            if (settings && settings.enabled) {
              reminderSettings = {
                enabled: true,
                count: settings.count || 1,
                times: settings.times || [60],
                message: settings.message,
                email: settings.email !== false,
                text: settings.text || false,
              };
            }
          }
        }

        // Skip if no reminder settings or not enabled
        if (!reminderSettings || !reminderSettings.enabled || !reminderSettings.email) {
          console.log(`[Reminder Scheduler] Skipping showing ${showing.id}: reminders disabled or not configured`);
          continue;
        }
        
        // Check if EMAIL_PASSWORD is set before attempting to send
        if (!process.env.EMAIL_PASSWORD) {
          console.warn(`[Reminder Scheduler] ⚠️ Cannot send reminder for showing ${showing.id}: EMAIL_PASSWORD not configured`);
          continue;
        }
        
        console.log(`[Reminder Scheduler] Processing showing ${showing.id} with ${reminderSettings.times.length} reminder(s) configured: ${reminderSettings.times.join(', ')}min`);
        console.log(`[Reminder Scheduler] Reminder settings:`, {
          enabled: reminderSettings.enabled,
          email: reminderSettings.email,
          times: reminderSettings.times,
          count: reminderSettings.count,
        });

        // Calculate showing time using property timezone for accurate reminder timing
        // The scheduled time is in the property's local timezone, so we need to
        // construct the DateTime in that timezone, then compare to current UTC time
        const propertyTimezone = property.timezone || 'America/Chicago';
        const [hours, minutes] = showing.scheduledTime.split(':').map(Number);
        
        // Create the showing DateTime in the property's timezone
        const showingDateTime = DateTime.fromObject(
          {
            year: parseInt(showing.scheduledDate.split('-')[0]),
            month: parseInt(showing.scheduledDate.split('-')[1]),
            day: parseInt(showing.scheduledDate.split('-')[2]),
            hour: hours,
            minute: minutes,
            second: 0
          },
          { zone: propertyTimezone }
        );
        
        // Get current time in the property's timezone for accurate comparison
        const nowDateTime = DateTime.now().setZone(propertyTimezone);

        // Calculate minutes until showing (comparing both in the same timezone)
        const minutesUntilShowing = Math.floor(showingDateTime.diff(nowDateTime, 'minutes').minutes);
        
        console.log(`[Reminder Scheduler] Showing ${showing.id} timing:`, {
          scheduledDate: showing.scheduledDate,
          scheduledTime: showing.scheduledTime,
          propertyTimezone,
          showingDateTime: showingDateTime.toISO(),
          nowDateTime: nowDateTime.toISO(),
          minutesUntilShowing,
        });

        // Skip if showing is in the past
        if (minutesUntilShowing < 0) {
          console.log(`[Reminder Scheduler] Skipping showing ${showing.id}: showing is in the past (${minutesUntilShowing} minutes ago)`);
          continue;
        }

        // Get already sent reminders - handle both array and null/undefined cases
        let remindersSent: number[] = [];
        if (showing.remindersSent) {
          if (Array.isArray(showing.remindersSent)) {
            remindersSent = showing.remindersSent;
          } else if (typeof showing.remindersSent === 'string') {
            try {
              remindersSent = JSON.parse(showing.remindersSent);
            } catch (e) {
              console.warn(`[Reminder Scheduler] Failed to parse remindersSent for showing ${showing.id}:`, e);
              remindersSent = [];
            }
          }
        }
        
        console.log(`[Reminder Scheduler] Showing ${showing.id} - Already sent reminders: [${remindersSent.join(', ')}]`);

        // Check each configured reminder time
        // Tolerance window: 5 minutes to account for 60-second polling and clock drift
        // We check if we're within the window: (reminderTime - tolerance) <= minutesUntilShowing <= (reminderTime + tolerance)
        // This ensures we send the reminder when we're at or just past the reminder time, with some buffer
        const TOLERANCE_MINUTES = 5;
        
        for (const reminderTime of reminderSettings.times) {
          // Skip if this reminder was already sent
          if (remindersSent.includes(reminderTime)) {
            console.log(`[Reminder Scheduler] Reminder ${reminderTime}min already sent for showing ${showing.id}`);
            continue;
          }

          // Check if it's time to send this reminder
          // The reminder should send when we're at or just past the reminder time
          // For a 15-minute reminder with 8:15am event:
          //   - At 8:00am (15 min away): minutesUntilShowing = 15, SEND (exactly at reminder time)
          //   - At 8:01am (14 min away): minutesUntilShowing = 14, SEND (just past reminder time, within tolerance)
          //   - At 8:02am (13 min away): minutesUntilShowing = 13, SEND (within tolerance)
          //   - At 8:03am (12 min away): minutesUntilShowing = 12, SEND (within tolerance)
          //   - At 7:58am (17 min away): minutesUntilShowing = 17, DON'T SEND (too early)
          //
          // Window: (reminderTime - tolerance) <= minutesUntilShowing <= (reminderTime + tolerance)
          // This ensures we send when we're at the reminder time or just past it (within tolerance)
          const isWithinReminderWindow = 
            minutesUntilShowing >= (reminderTime - TOLERANCE_MINUTES) && 
            minutesUntilShowing <= (reminderTime + TOLERANCE_MINUTES);
          
          // Log detailed timing info for debugging (only log if close to window to reduce noise)
          const timeDiff = Math.abs(minutesUntilShowing - reminderTime);
          if (timeDiff <= 60 || isWithinReminderWindow) {
            console.log(`[Reminder Scheduler] Checking ${reminderTime}min reminder for showing ${showing.id}:`, {
              minutesUntilShowing,
              reminderTime,
              tolerance: TOLERANCE_MINUTES,
              windowStart: reminderTime - TOLERANCE_MINUTES,
              windowEnd: reminderTime + TOLERANCE_MINUTES,
              isWithinWindow: isWithinReminderWindow,
              minutesUntilShowingPositive: minutesUntilShowing > 0,
              willSend: isWithinReminderWindow && minutesUntilShowing > 0,
            });
          }
          
          if (isWithinReminderWindow && minutesUntilShowing > 0) {
            console.log(`[Reminder Scheduler] ✅ Time to send ${reminderTime}min reminder for showing ${showing.id}`);
            console.log(`[Reminder Scheduler]   - Showing: ${showing.scheduledDate} at ${showing.scheduledTime}`);
            console.log(`[Reminder Scheduler]   - Minutes until showing: ${minutesUntilShowing}`);
            console.log(`[Reminder Scheduler]   - Lead: ${lead.email} (${lead.name})`);
            
            // Fetch event name, description from booking settings with variable replacement
            let eventName = showing.title || null;
            let eventDescription: string | null = null;
            
            // Helper function to replace variables in text (shared for both event name and description)
            const replaceVariables = (text: string): string => {
              if (!text || !unit || !property) return text || '';
              
              // Format property amenities as comma-separated list
              const propertyAmenitiesStr = property.amenities && property.amenities.length > 0
                ? property.amenities.join(', ')
                : '';
              
              // Format property address
              const propertyAddressParts = [
                property.address,
                property.city,
                property.state,
                property.zipCode
              ].filter(Boolean);
              const propertyAddressStr = propertyAddressParts.join(', ');
              
              // Format unit rent with currency
              const unitRentStr = unit.monthlyRent 
                ? `$${parseFloat(unit.monthlyRent).toLocaleString()}/mo`
                : '';
              
              // Format security deposit with currency
              const securityDepositStr = unit.deposit
                ? `$${parseFloat(unit.deposit).toLocaleString()}`
                : '';
              
              // Define safe replacement mapping with all available variables
              const variables: Record<string, string> = {
                '{unit_number}': unit.unitNumber || '',
                '{bedrooms}': unit.bedrooms?.toString() || '',
                '{bathrooms}': unit.bathrooms || '',
                '{unit_rent}': unitRentStr,
                '{security_deposit}': securityDepositStr,
                '{property_amenities}': propertyAmenitiesStr,
                '{property_address}': propertyAddressStr,
                '{property_name}': property.name || ''
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
            
            // Fetch booking settings to get event description with variable replacement
            try {
              if (showing.unitId && unit) {
                // Try unit-level settings first
                const unitSettings = await storage.getUnitSchedulingSettings(showing.unitId, property.orgId);
                if (unitSettings?.customEventDescription) {
                  eventDescription = unitSettings.customEventDescription;
                } else if (unitSettings?.customEventName && !eventName) {
                  eventName = unitSettings.customEventName;
                }
              }
              
              // Fall back to property-level settings if no unit-level description
              if (!eventDescription) {
                const propertySettings = await storage.getPropertySchedulingSettings(property.id, property.orgId);
                if (propertySettings?.eventDescription) {
                  eventDescription = propertySettings.eventDescription;
                } else if (propertySettings?.eventName && !eventName) {
                  eventName = propertySettings.eventName;
                }
              }
              
              // Apply variable replacement to event description if we have unit and property data
              if (eventDescription && unit && property) {
                eventDescription = replaceVariables(eventDescription);
              }
              
              // Apply variable replacement to event name if needed
              if (eventName && unit && property) {
                eventName = replaceVariables(eventName);
              }
            } catch (error) {
              console.warn(`[Reminder Scheduler] Could not fetch booking settings for showing ${showing.id}:`, error);
              // Fall back to showing.description if booking settings fetch fails
              if (!eventDescription) {
                eventDescription = showing.description || null;
              }
            }
            
            let assignedUser = null;
            if (showing.assignedTo) {
              try {
                assignedUser = await storage.getUser(showing.assignedTo);
              } catch (error) {
                console.warn(`[Reminder Scheduler] Could not fetch assigned user ${showing.assignedTo}:`, error);
              }
            }
            const organization = await storage.getOrganization(property.orgId);
            
            const success = await sendReminderEmail(
              lead.email,
              lead.name || 'Valued Customer',
              property.name,
              property.address,
              unit?.unitNumber || null,
              showing.scheduledDate,
              showing.scheduledTime,
              reminderTime,
              reminderSettings.message,
              eventName,
              eventDescription,
              assignedUser,
              organization,
              showing.id,
              showing.durationMinutes || null
            );

            if (success) {
              // Mark this reminder as sent
              const updatedRemindersSent = [...remindersSent, reminderTime];
              await db
                .update(showings)
                .set({ 
                  remindersSent: updatedRemindersSent,
                  reminderSent: true 
                })
                .where(eq(showings.id, showing.id));
              
              console.log(`[Reminder Scheduler] ✅ Marked reminder ${reminderTime}min as sent for showing ${showing.id}`);
            } else {
              console.error(`[Reminder Scheduler] ❌ Failed to send reminder ${reminderTime}min for showing ${showing.id}`);
            }
          } else {
            // Log when we're close but not in window (for debugging)
            const timeDiff = Math.abs(minutesUntilShowing - reminderTime);
            if (timeDiff <= 5) {
              console.log(`[Reminder Scheduler] ⏳ Reminder ${reminderTime}min for showing ${showing.id}: ${minutesUntilShowing}min until showing (${timeDiff}min from reminder time)`);
            }
          }
        }
      }
    } catch (error) {
      console.error("[Reminder Scheduler] ❌ Error processing reminders:", error);
      console.error("[Reminder Scheduler] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    } finally {
      this.isProcessing = false;
      console.log(`[Reminder Scheduler] ===== Finished reminder check =====`);
    }
  }
}

export const reminderScheduler = new ReminderScheduler();
