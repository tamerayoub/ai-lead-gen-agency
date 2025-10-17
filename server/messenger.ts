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

/**
 * Check if we're within the 24-hour messaging window
 * @param lastContactAt - Last time the user sent a message
 * @returns true if within 24 hours, false otherwise
 */
export function isWithinMessagingWindow(lastContactAt: Date): boolean {
  const now = new Date();
  const hoursSinceLastContact = (now.getTime() - lastContactAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastContact < 24;
}

export type MessengerMessageTag = 
  | 'CONFIRMED_EVENT_UPDATE' 
  | 'POST_PURCHASE_UPDATE' 
  | 'ACCOUNT_UPDATE';

export interface SendMessengerMessageOptions {
  recipientId: string;
  messageText: string;
  pageAccessToken: string;
  lastContactAt?: Date; // When the user last sent a message
  messageTag?: MessengerMessageTag; // Tag to use if outside 24-hour window
}

export async function sendMessengerMessage(
  options: SendMessengerMessageOptions
): Promise<any> {
  const { recipientId, messageText, pageAccessToken, lastContactAt, messageTag } = options;
  const url = `https://graph.facebook.com/v18.0/me/messages`;
  
  // Determine messaging type based on 24-hour window
  let messagingType = 'RESPONSE';
  const payload: any = {
    recipient: { id: recipientId },
    message: { text: messageText },
  };
  
  // Check if we're within the 24-hour messaging window
  if (lastContactAt) {
    const withinWindow = isWithinMessagingWindow(lastContactAt);
    
    if (!withinWindow) {
      // Outside 24-hour window - must use message tag
      if (!messageTag) {
        const error = new Error('Cannot send message outside 24-hour window without a message tag');
        console.error('[Messenger] 24-hour window expired:', {
          lastContactAt,
          hoursSince: (new Date().getTime() - lastContactAt.getTime()) / (1000 * 60 * 60),
        });
        throw error;
      }
      
      messagingType = 'MESSAGE_TAG';
      payload.tag = messageTag;
      console.log('[Messenger] Outside 24-hour window, using message tag:', messageTag);
    } else {
      console.log('[Messenger] Within 24-hour window, using RESPONSE messaging type');
    }
  }
  
  payload.messaging_type = messagingType;
  
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
      message: error.message,
      messagingType,
      tag: payload.tag
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
