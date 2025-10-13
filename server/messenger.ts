import axios from "axios";

export interface MessengerWebhookEvent {
  object: string;
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        attachments?: any[];
      };
      postback?: {
        title: string;
        payload: string;
      };
    }>;
  }>;
}

export interface MessengerMessage {
  senderId: string;
  recipientId: string;
  messageId: string;
  text: string;
  timestamp: number;
}

export async function sendMessengerMessage(
  recipientId: string,
  messageText: string,
  pageAccessToken: string
): Promise<any> {
  const url = `https://graph.facebook.com/v18.0/me/messages`;
  
  const payload = {
    recipient: { id: recipientId },
    message: { text: messageText },
    messaging_type: 'RESPONSE'
  };
  
  try {
    const response = await axios.post(url, payload, {
      params: { access_token: pageAccessToken },
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('[Messenger] Message sent successfully:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('[Messenger] Failed to send message:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

export function parseMessengerWebhook(body: MessengerWebhookEvent): MessengerMessage[] {
  const messages: MessengerMessage[] = [];
  
  if (body.object !== 'page') {
    return messages;
  }
  
  for (const entry of body.entry) {
    for (const event of entry.messaging) {
      if (event.message && event.message.text) {
        messages.push({
          senderId: event.sender.id,
          recipientId: event.recipient.id,
          messageId: event.message.mid,
          text: event.message.text,
          timestamp: event.timestamp
        });
      }
    }
  }
  
  return messages;
}

export async function getMessengerUserProfile(
  userId: string,
  pageAccessToken: string
): Promise<{ first_name: string; last_name: string; profile_pic: string }> {
  const url = `https://graph.facebook.com/v18.0/${userId}`;
  
  try {
    const response = await axios.get(url, {
      params: {
        fields: 'first_name,last_name,profile_pic',
        access_token: pageAccessToken
      }
    });
    
    return response.data;
  } catch (error: any) {
    console.error('[Messenger] Failed to get user profile:', error.response?.data || error.message);
    throw error;
  }
}
