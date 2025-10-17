import axios from "axios";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const REDIRECT_URI = `${process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5000'}/api/integrations/facebook/callback`;

interface FacebookTokens {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
  category: string;
}

export function getFacebookAuthUrl(userId: string): string {
  if (!FACEBOOK_APP_ID) {
    throw new Error("FACEBOOK_APP_ID is not configured");
  }

  const scopes = [
    'pages_manage_metadata',      // Access to page metadata
    'pages_read_engagement',       // Read page content
    'pages_messaging',             // Send and receive messages
    'pages_show_list'              // List all pages user manages
  ].join(',');

  const params = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: REDIRECT_URI,
    scope: scopes,
    state: userId,
    response_type: 'code'
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

export async function getFacebookTokensFromCode(code: string): Promise<FacebookTokens> {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    throw new Error("Facebook credentials are not configured");
  }

  const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token`;
  
  const params = {
    client_id: FACEBOOK_APP_ID,
    client_secret: FACEBOOK_APP_SECRET,
    redirect_uri: REDIRECT_URI,
    code
  };

  try {
    const response = await axios.get(tokenUrl, { params });
    console.log('[Facebook OAuth] Successfully exchanged code for token');
    return response.data;
  } catch (error: any) {
    console.error('[Facebook OAuth] Token exchange failed:', error.response?.data || error.message);
    throw new Error('Failed to exchange Facebook authorization code for tokens');
  }
}

export async function getFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const url = 'https://graph.facebook.com/v18.0/me/accounts';
  
  try {
    const response = await axios.get(url, {
      params: {
        access_token: userAccessToken,
        fields: 'id,name,access_token,category'
      }
    });

    console.log('[Facebook] Retrieved pages:', response.data.data?.length || 0);
    return response.data.data || [];
  } catch (error: any) {
    console.error('[Facebook] Failed to get pages:', error.response?.data || error.message);
    throw new Error('Failed to retrieve Facebook pages');
  }
}

export async function getLongLivedPageAccessToken(
  shortLivedToken: string
): Promise<{ access_token: string }> {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    throw new Error("Facebook credentials are not configured");
  }

  const url = 'https://graph.facebook.com/v18.0/oauth/access_token';
  
  try {
    const response = await axios.get(url, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: FACEBOOK_APP_ID,
        client_secret: FACEBOOK_APP_SECRET,
        fb_exchange_token: shortLivedToken
      }
    });

    console.log('[Facebook] Exchanged for long-lived token');
    return response.data;
  } catch (error: any) {
    console.error('[Facebook] Failed to get long-lived token:', error.response?.data || error.message);
    throw new Error('Failed to exchange for long-lived token');
  }
}

export async function subscribePage(pageId: string, pageAccessToken: string): Promise<void> {
  const url = `https://graph.facebook.com/v18.0/${pageId}/subscribed_apps`;
  
  try {
    await axios.post(url, {}, {
      params: {
        access_token: pageAccessToken,
        subscribed_fields: 'messages,messaging_postbacks,message_deliveries,message_reads'
      }
    });
    
    console.log('[Facebook] Successfully subscribed to page webhooks:', pageId);
  } catch (error: any) {
    console.error('[Facebook] Failed to subscribe page:', error.response?.data || error.message);
    throw new Error('Failed to subscribe page to webhooks');
  }
}
