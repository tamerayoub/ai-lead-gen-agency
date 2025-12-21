import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

function getCalendarRedirectUri(): string {
  return process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google-calendar/callback`
    : 'http://localhost:5000/api/auth/google-calendar/callback';
}

export function getCalendarAuthUrl(state?: string) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getCalendarRedirectUri()
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    state: state || '',
  });

  return authUrl;
}

export async function getCalendarTokensFromCode(code: string) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    getCalendarRedirectUri()
  );

  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function listCalendars(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

export async function listCalendarEvents(
  accessToken: string,
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date,
  maxResults: number = 100
) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin?.toISOString(),
    timeMax: timeMax?.toISOString(),
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

export async function refreshCalendarToken(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  
  return credentials;
}

export async function registerCalendarWebhook(
  accessToken: string,
  calendarId: string = 'primary',
  channelId: string,
  channelToken: string
) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const webhookUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/calendar/webhook`
    : 'http://localhost:5000/api/calendar/webhook';

  const response = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: channelId,
      type: 'web_hook',
      address: webhookUrl,
      token: channelToken,
    },
  });

  return {
    channelId: response.data.id!,
    resourceId: response.data.resourceId!,
    expiration: response.data.expiration ? new Date(parseInt(response.data.expiration)) : null,
  };
}

export async function stopCalendarWebhook(
  accessToken: string,
  channelId: string,
  resourceId: string
) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.channels.stop({
    requestBody: {
      id: channelId,
      resourceId: resourceId,
    },
  });
}

export async function createOrUpdateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventData: {
    id?: string; // External ID from our database (if updating existing event)
    title: string;
    description?: string | null;
    startTime: Date;
    endTime: Date;
    location?: string | null;
    attendees?: Array<{ email: string; displayName?: string }> | null;
  }
) {
  if (!accessToken) {
    throw new Error("Access token is required");
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth credentials are not configured");
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Format attendees for Google Calendar API
  const attendees = eventData.attendees?.map(attendee => {
    if (!attendee.email) {
      throw new Error(`Invalid attendee: missing email`);
    }
    return {
      email: attendee.email,
      displayName: attendee.displayName || attendee.email,
    };
  }) || [];

  // Validate dates
  if (!(eventData.startTime instanceof Date) || isNaN(eventData.startTime.getTime())) {
    throw new Error("Invalid start time");
  }
  if (!(eventData.endTime instanceof Date) || isNaN(eventData.endTime.getTime())) {
    throw new Error("Invalid end time");
  }
  if (eventData.endTime <= eventData.startTime) {
    throw new Error("End time must be after start time");
  }

  const googleEvent = {
    summary: eventData.title || 'Untitled Event',
    description: eventData.description || undefined,
    location: eventData.location || undefined,
    start: {
      dateTime: eventData.startTime.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: eventData.endTime.toISOString(),
      timeZone: 'UTC',
    },
    attendees: attendees.length > 0 ? attendees : undefined,
  };

  // If we have an external ID, try to update the existing event
  if (eventData.id) {
    try {
      const response = await calendar.events.update({
        calendarId: calendarId || 'primary',
        eventId: eventData.id,
        requestBody: googleEvent,
      });
      if (!response.data || !response.data.id) {
        throw new Error("Google Calendar API returned invalid response");
      }
      return response.data;
    } catch (error: any) {
      // If event doesn't exist (404), create a new one
      if (error.code === 404) {
        const response = await calendar.events.insert({
          calendarId: calendarId || 'primary',
          requestBody: googleEvent,
        });
        if (!response.data || !response.data.id) {
          throw new Error("Google Calendar API returned invalid response when creating event");
        }
        return response.data;
      }
      // Re-throw with more context
      const errorMessage = error?.message || "Unknown error";
      const errorCode = error?.code || "UNKNOWN";
      throw new Error(`Failed to update Google Calendar event: ${errorMessage} (code: ${errorCode})`);
    }
  } else {
    // Create new event
    try {
      const response = await calendar.events.insert({
        calendarId: calendarId || 'primary',
        requestBody: googleEvent,
      });
      if (!response.data || !response.data.id) {
        throw new Error("Google Calendar API returned invalid response when creating event");
      }
      return response.data;
    } catch (error: any) {
      const errorMessage = error?.message || "Unknown error";
      const errorCode = error?.code || "UNKNOWN";
      throw new Error(`Failed to create Google Calendar event: ${errorMessage} (code: ${errorCode})`);
    }
  }
}
