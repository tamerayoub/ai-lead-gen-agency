import axios from "axios";

const OUTLOOK_SCOPES = [
  "https://graph.microsoft.com/Mail.Read",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "offline_access",
  "openid",
  "profile",
  "email"
];

export function getOutlookAuthUrl(userId: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/integrations/outlook/callback`
    : 'http://localhost:5000/api/integrations/outlook/callback';
  
  const scopes = OUTLOOK_SCOPES.join(' ');
  
  // Use common tenant for both personal and work accounts
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${userId}` +
    `&response_mode=query`;
  
  return authUrl;
}

export async function getOutlookTokensFromCode(code: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.REPLIT_DEV_DOMAIN 
    ? `https://${process.env.REPLIT_DEV_DOMAIN}/api/integrations/outlook/callback`
    : 'http://localhost:5000/api/integrations/outlook/callback';
  
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  // NOTE: Do NOT include 'scope' parameter when exchanging code for tokens
  // Microsoft uses the scopes from the authorization request
  const params = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  
  console.log('[Outlook] Token exchange request:', {
    url: tokenUrl,
    clientId,
    redirectUri,
    hasClientSecret: !!clientSecret,
    secretStartsWith: clientSecret?.substring(0, 8) + '...',
    secretLength: clientSecret?.length || 0,
    looksLikeUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientSecret || ''),
    codeLength: code.length
  });
  
  try {
    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    console.log('[Outlook] Token exchange successful, scopes:', response.data.scope);
    
    return {
      access_token: response.data.access_token,
      refresh_token: response.data.refresh_token,
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
      scope: response.data.scope
    };
  } catch (error: any) {
    console.error('[Outlook] Token exchange failed:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      error: error.response?.data?.error,
      errorDescription: error.response?.data?.error_description,
      message: error.message
    });
    throw error;
  }
}

export async function refreshOutlookToken(refreshToken: string) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  
  const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  
  // NOTE: Do NOT include 'scope' parameter for refresh tokens either
  const params = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  
  const response = await axios.post(tokenUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
  
  return {
    access_token: response.data.access_token,
    refresh_token: response.data.refresh_token,
    expires_in: response.data.expires_in
  };
}

export async function listOutlookMessages(
  accessToken: string,
  maxResults: number = 20,
  checkCancellation?: () => boolean
) {
  const allMessages: any[] = [];
  let nextLink: string | null = `https://graph.microsoft.com/v1.0/me/messages?$top=${Math.min(maxResults, 999)}&$orderby=receivedDateTime desc`;
  
  while (nextLink && allMessages.length < maxResults) {
    if (checkCancellation && checkCancellation()) {
      console.log(`[Outlook] Sync cancelled during message fetch`);
      break;
    }
    
    const response: any = await axios.get(nextLink, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const messages = response.data.value || [];
    allMessages.push(...messages);
    
    nextLink = response.data['@odata.nextLink'] || null;
    
    if (allMessages.length >= maxResults) {
      break;
    }
  }
  
  return allMessages.slice(0, maxResults);
}

export async function getOutlookMessage(accessToken: string, messageId: string) {
  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}

export async function sendOutlookReply(
  accessToken: string,
  messageId: string,
  replyText: string,
  replyTo: { name: string; email: string }
) {
  const replyBody = {
    message: {
      toRecipients: [
        {
          emailAddress: {
            name: replyTo.name,
            address: replyTo.email
          }
        }
      ]
    },
    comment: replyText
  };
  
  await axios.post(
    `https://graph.microsoft.com/v1.0/me/messages/${messageId}/reply`,
    replyBody,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
}

export async function getUserProfile(accessToken: string) {
  const response = await axios.get(
    'https://graph.microsoft.com/v1.0/me',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return {
    email: response.data.mail || response.data.userPrincipalName,
    displayName: response.data.displayName
  };
}
