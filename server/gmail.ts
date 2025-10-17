import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify"
];

export function getGmailOAuth2Client(): OAuth2Client {
  const redirectUri = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/integrations/gmail/callback`
    : 'http://localhost:5000/api/integrations/gmail/callback';
    
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

export function getGmailAuthUrl(userId: string): string {
  const oauth2Client = getGmailOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state: userId // Pass user ID to identify who's authenticating
  });
}

export async function getGmailTokensFromCode(code: string) {
  const oauth2Client = getGmailOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getGmailClient(tokens: { access_token: string; refresh_token?: string }) {
  const oauth2Client = getGmailOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function listMessages(
  tokens: any, 
  maxResults: number = 20,
  checkCancellation?: () => boolean
) {
  const gmail = await getGmailClient(tokens);
  const allMessages: any[] = [];
  const seenIds = new Set<string>(); // Track unique message IDs
  let pageToken: string | undefined = undefined;
  
  // Gmail API max per page is 500, so we need to paginate for larger requests
  const perPage = Math.min(maxResults, 500);
  let page = 0;
  
  while (allMessages.length < maxResults) {
    // Check for cancellation before each page fetch
    if (checkCancellation && checkCancellation()) {
      console.log(`[Gmail] Sync cancelled during email fetch at page ${page}`);
      break;
    }

    page++;
    const response: any = await gmail.users.messages.list({
      userId: "me",
      maxResults: perPage,
      pageToken,
    });
    
    const messages = response.data.messages || [];
    
    // Only add unique messages
    for (const msg of messages) {
      if (msg.id && !seenIds.has(msg.id)) {
        seenIds.add(msg.id);
        allMessages.push(msg);
        
        if (allMessages.length >= maxResults) {
          break;
        }
      }
    }
    
    if (maxResults > 500) {
      console.log(`   Fetched page ${page}: ${allMessages.length} unique emails (${seenIds.size} total seen)...`);
    }
    
    // Check if there are more pages
    pageToken = response.data.nextPageToken;
    if (!pageToken || messages.length === 0) {
      break;
    }
  }
  
  return allMessages.slice(0, maxResults);
}

export async function getMessage(tokens: any, messageId: string) {
  const gmail = await getGmailClient(tokens);
  const response = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full"
  });
  return response.data;
}

export async function sendReply(
  tokens: any,
  {
    to,
    subject,
    body,
    threadId,
    inReplyTo,
    references
  }: {
    to: string;
    subject: string;
    body: string;
    threadId?: string;
    inReplyTo?: string;
    references?: string;
  }
) {
  const gmail = await getGmailClient(tokens);

  const messageParts = [
    `To: ${to}`,
    `Subject: Re: ${subject}`,
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : []),
    ...(references ? [`References: ${references}`] : []),
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body
  ];

  const raw = messageParts.join('\n');
  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      ...(threadId && { threadId })
    }
  });

  return response.data;
}

export async function sendEmail(
  tokens: any,
  {
    to,
    subject,
    body
  }: {
    to: string;
    subject: string;
    body: string;
  }
) {
  const gmail = await getGmailClient(tokens);

  const messageParts = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    body
  ];

  const raw = messageParts.join('\n');
  const encodedMessage = Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage
    }
  });

  return response.data;
}

export async function getGmailUserEmail(tokens: any): Promise<string> {
  const gmail = await getGmailClient(tokens);
  const profile = await gmail.users.getProfile({ userId: "me" });
  return profile.data.emailAddress || "";
}
