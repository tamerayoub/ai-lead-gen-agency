import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "lead2leaseai@gmail.com",
    pass: process.env.EMAIL_PASSWORD,
  },
});

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
        .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
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
