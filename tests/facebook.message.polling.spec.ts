import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Helper function to generate random delay between 2-3 seconds
const randomDelay = () => Math.floor(Math.random() * 1000) + 2000;

// Helper function to generate random delay between 1-2 seconds
const shortDelay = () => Math.floor(Math.random() * 1000) + 1000;

// Helper function to extract listing ID from Facebook Marketplace item URL
function extractListingId(url: string): string | null {
  // URL format: https://www.facebook.com/marketplace/item/638680695215754/?referralSurface=...
  const match = url.match(/\/marketplace\/item\/(\d+)/);
  return match ? match[1] : null;
}

// Helper function to extract profile ID from Facebook profile URL
function extractProfileId(url: string): string | null {
  // URL format: https://www.facebook.com/marketplace/profile/1043854170/?referralSurface=...
  const match = url.match(/\/marketplace\/profile\/(\d+)/);
  return match ? match[1] : null;
}

// Helper function to extract conversation ID from messages URL
function extractConversationId(url: string): string | null {
  // URL format: https://www.facebook.com/messages/t/389917088531093/
  const match = url.match(/\/messages\/t\/(\d+)/);
  return match ? match[1] : null;
}

// Helper function to extract profile name from the profile page
async function extractProfileName(page: any): Promise<string | null> {
  try {
    // Wait a bit for the profile page to load
    await page.waitForTimeout(1000);
    
    // Common UI text to skip (not profile names)
    const uiTextToSkip = [
      'Notifications',
      'Messages',
      'Marketplace',
      'See all',
      'Close',
      'Joined Facebook',
      'active listings',
      'More options',
      'View buyer',
      'See details',
    ];
    
    // Strategy 1: Target the specific profile header structure
    // The name is in div.x1e56ztr.x1xmf6yo within the profile container
    // Based on HTML structure: div.x78zum5.xdt5ytf.x1wsgfga > div.x1e56ztr.x1xmf6yo > span[dir="auto"]
    try {
      const name = await page.evaluate((skipList) => {
        // Find the profile header area - look for the container that has profile info
        // Target div.x78zum5.xdt5ytf.x1wsgfga first (profile header container)
        const profileContainers = Array.from(document.querySelectorAll('div.x78zum5.xdt5ytf.x1wsgfga'));
        
        for (const container of profileContainers) {
          // Find div.x1e56ztr.x1xmf6yo inside this container
          const profileDivs = container.querySelectorAll('div.x1e56ztr.x1xmf6yo');
          
          for (const div of profileDivs) {
            // Get the first span with dir="auto" in this div
            const span = div.querySelector('span[dir="auto"]');
            if (span) {
              const text = span.textContent?.trim() || '';
              
              // Skip if it's in the skip list (UI text)
              if (skipList.some(skip => text.toLowerCase() === skip.toLowerCase())) {
                continue;
              }
              
              // Check if it looks like a person's name
              // Prefer names with spaces (first + last name)
              if (
                text.length >= 2 &&
                text.length <= 50 &&
                !/^\d+$/.test(text) && // Not just numbers
                /^[A-Za-z\s'-]+$/.test(text) && // Only letters, spaces, hyphens, apostrophes
                !skipList.some(skip => text.toLowerCase().includes(skip.toLowerCase())) // Not UI text
              ) {
                // Prefer multi-word names (first + last)
                if (text.includes(' ')) {
                  // Check if it has proper name capitalization (First Last)
                  const words = text.split(' ');
                  const hasProperCapitalization = words.every(word => 
                    word.length > 0 && word[0] === word[0].toUpperCase()
                  );
                  
                  if (hasProperCapitalization && words.length >= 2) {
                    return text;
                  }
                } else if (text.length >= 3) {
                  // Single word name (at least 3 chars)
                  if (text[0] === text[0].toUpperCase() && text.slice(1) === text.slice(1).toLowerCase()) {
                    return text;
                  }
                }
              }
            }
          }
        }
        return null;
      }, uiTextToSkip);
      
      if (name) {
        console.log(`[Facebook Message Polling 2] ✅ Extracted profile name (Strategy 1): ${name}`);
        return name;
      }
    } catch (e) {
      console.log(`[Facebook Message Polling 2] Strategy 1 failed: ${e}`);
    }
    
    // Strategy 2: Look for spans near profile-related indicators
    try {
      const name = await page.evaluate((skipList) => {
        // Look for spans that are in a profile header context
        // Profile header usually has specific class combinations
        const possibleContainers = Array.from(document.querySelectorAll('div[class*="x78zum5"][class*="xdt5ytf"]'));
        
        for (const container of possibleContainers) {
          const spans = container.querySelectorAll('span[dir="auto"]');
          for (const span of spans) {
            const text = span.textContent?.trim() || '';
            
            // Skip UI text
            if (skipList.some(skip => text.toLowerCase().includes(skip.toLowerCase()))) {
              continue;
            }
            
            // Check if it looks like a name with multiple words (first + last name)
            if (
              text.length >= 3 &&
              text.length <= 50 &&
              text.includes(' ') && // Has space (first last name)
              !/^\d+$/.test(text) &&
              /^[A-Za-z\s'-]+$/.test(text)
            ) {
              return text;
            }
          }
        }
        return null;
      }, uiTextToSkip);
      
      if (name) {
        console.log(`[Facebook Message Polling 2] ✅ Extracted profile name (Strategy 2): ${name}`);
        return name;
      }
    } catch (e) {
      console.log(`[Facebook Message Polling 2] Strategy 2 failed: ${e}`);
    }
    
    // Strategy 3: Fallback - find any text that looks like a name (but skip common UI text)
    try {
      const allSpans = await page.locator('span[dir="auto"]').all();
      
      for (const span of allSpans) {
        const text = await span.textContent();
        if (text && text.trim()) {
          const trimmedText = text.trim();
          
          // Skip UI text
          if (uiTextToSkip.some(skip => trimmedText.toLowerCase().includes(skip.toLowerCase()))) {
            continue;
          }
          
          // Skip common patterns
          if (
            trimmedText.match(/^\d+$/) || // Just numbers
            trimmedText.length < 3 || // Too short
            trimmedText.length > 50 || // Too long
            !trimmedText.includes(' ') && trimmedText.length < 4 // Single word less than 4 chars
          ) {
            continue;
          }
          
          // Prefer names with spaces (first + last name)
          if (
            trimmedText.includes(' ') &&
            trimmedText.match(/^[A-Za-z\s'-]+$/) &&
            trimmedText.length >= 3 &&
            trimmedText.length <= 50
          ) {
            console.log(`[Facebook Message Polling 2] ✅ Extracted profile name (Strategy 3): ${trimmedText}`);
            return trimmedText;
          }
        }
      }
    } catch (e) {
      console.log(`[Facebook Message Polling 2] Strategy 3 failed: ${e}`);
    }
    
    return null;
  } catch (error) {
    console.log(`[Facebook Message Polling 2] ⚠️ Error extracting profile name: ${error}`);
    return null;
  }
}

// Helper function to extract messages from a conversation
async function extractMessages(page: any): Promise<Array<{
  messageId: string;
  text: string;
  timestamp: string;
  from: 'lead' | 'me';
}>> {
  const messages: Array<{
    messageId: string;
    text: string;
    timestamp: string;
    from: 'lead' | 'me';
  }> = [];
  
  const seenMessages = new Set<string>(); // Track text+timestamp combinations to avoid duplicates
  
  try {
    // Check if page is still open before proceeding
    if (page.isClosed()) {
      console.log(`[Facebook Message Polling 2] ⚠️ Page is closed, cannot extract messages`);
      return [];
    }
    
    // Wait a bit for messages to load
    try {
      await page.waitForTimeout(1000);
    } catch (e) {
      if (page.isClosed()) {
        console.log(`[Facebook Message Polling 2] ⚠️ Page closed during wait, cannot extract messages`);
        return [];
      }
      throw e;
    }
    
    // Scroll to top of conversation to load all messages
    try {
      if (!page.isClosed()) {
        await page.evaluate(() => {
          const messageContainer = document.querySelector('div[role="log"]') || 
                                  document.querySelector('[role="row"]')?.closest('div');
          if (messageContainer) {
            messageContainer.scrollTop = 0;
          }
        });
        if (!page.isClosed()) {
          await page.waitForTimeout(1000);
        }
      }
    } catch (e) {
      // Continue even if scroll fails, but check if page is closed
      if (page.isClosed()) {
        console.log(`[Facebook Message Polling 2] ⚠️ Page closed during scroll, cannot extract messages`);
        return [];
      }
    }
    
    // Check if page is still open before extracting
    if (page.isClosed()) {
      console.log(`[Facebook Message Polling 2] ⚠️ Page is closed, cannot extract messages`);
      return [];
    }
    
    // Extract messages using evaluate to access DOM directly
    const extractedMessages = await page.evaluate(() => {
      const result: Array<{
        text: string;
        timestamp: string | null;
        from: 'lead' | 'me';
      }> = [];
      
      // Find all message rows (div[role="row"] in conversation)
      // Filter to only rows that contain actual message content
      const allRows = Array.from(document.querySelectorAll('div[role="row"]'));
      const messageRows = allRows.filter(row => {
        // Check if this row contains message text (not just UI elements)
        const hasMessageText = row.querySelector('div[dir="auto"], span[dir="auto"]');
        if (!hasMessageText) return false;
        
        // Skip rows that are clearly UI elements (like header, buttons, etc.)
        const text = row.textContent?.trim() || '';
        if (text.match(/^(Enter|See all|Notifications|Messages|Marketplace|Close)$/i)) {
          return false;
        }
        
        return true;
      });
      
       for (const row of messageRows) {
         try {
           // Determine if message is from lead or me based on HTML structure
           // Lead messages: Have the lead's name in an <h5> tag (e.g., "Stivi")
           // My messages: Have "You sent" in an <h5> tag
           // Also check message bubble classes: x18lvrbx = lead, xyk4ms5 = me
           let isFromMe = false;
           
           // Strategy 1: Check for "You sent" text in h5 tag (my messages)
           const h5Elements = row.querySelectorAll('h5[dir="auto"]');
           for (const h5 of h5Elements) {
             const h5Text = h5.textContent?.trim() || '';
             if (h5Text.toLowerCase().includes('you sent') || h5Text.toLowerCase() === 'you') {
               isFromMe = true;
               break;
             }
             // If h5 contains a name (not "You sent"), it's from the lead
             if (h5Text.length > 0 && !h5Text.toLowerCase().includes('you sent')) {
               isFromMe = false;
               break;
             }
           }
           
           // Strategy 2: Check message bubble class differences
           // Lead messages have class ending in x18lvrbx
           // My messages have class ending in xyk4ms5
           if (h5Elements.length === 0) {
             const messageBubbles = row.querySelectorAll('div[dir="auto"][class*="x1gslohp"]');
             for (const bubble of messageBubbles) {
               const className = bubble.className || '';
               if (className.includes('xyk4ms5')) {
                 isFromMe = true;
                 break;
               }
               if (className.includes('x18lvrbx')) {
                 isFromMe = false;
                 break;
               }
             }
           }
           
           // Strategy 3: Fallback to flex alignment if structure-based detection didn't work
           if (h5Elements.length === 0) {
             let element: Element | null = row;
             let depth = 0;
             
             while (element && element !== document.body && depth < 10) {
               const style = window.getComputedStyle(element);
               const alignItems = style.alignItems || style.getPropertyValue('align-items');
               const textAlign = style.textAlign || style.getPropertyValue('text-align');
               
               // Check for right alignment (my messages)
               if (alignItems === 'flex-end' || alignItems === 'end' || textAlign === 'right') {
                 isFromMe = true;
                 break;
               }
               
               // Check for left alignment (lead messages)
               if (alignItems === 'flex-start' || alignItems === 'start' || textAlign === 'left') {
                 isFromMe = false;
                 break;
               }
               
               element = element.parentElement;
               depth++;
             }
           }
          
          // Extract message text - target actual message content divs
          // Real messages are in divs with specific classes like "x1gslohp x14z9mp x12nagc x1lziwak x1yc453h x126k92a"
          // These are the actual conversation bubbles, not system messages
          let messageText = '';
          
          // Strategy 1: Look for divs with the specific message bubble classes
          // These divs contain actual user messages - they have classes like "x1gslohp x14z9mp x12nagc"
          const allDivs = row.querySelectorAll('div[dir="auto"]');
          
          for (const elem of allDivs) {
            const text = elem.textContent?.trim() || '';
            const className = elem.className || '';
            
            // Check if this div has the message bubble classes (actual messages)
            // Real messages have these key classes: x1gslohp, x14z9mp, x12nagc, x1yc453h, x126k92a
            const hasMessageBubbleClass = className.includes('x1gslohp') && 
                                          className.includes('x14z9mp') && 
                                          className.includes('x12nagc') &&
                                          className.includes('x1yc453h');
            
            // Skip system messages even if they have similar classes
            const systemMessagePatterns = [
              /messages and calls are secured with end-to-end encryption/i,
              /facebook marketplace assistant/i,
              /^\d+ new message/i,
              /started this chat/i,
              /message sent/i,
              /waiting for your response/i,
              /marked the listing/i,
              /view buyer/i,
              /it looks like you listed this item/i,
              /have you sold this item/i,
              /yes, sold on facebook/i,
              /yes, sold elsewhere/i,
              /no, edit listing/i,
              /no, haven't sold/i,
              /over \d+ weeks? ago/i,
              /over \d+ days? ago/i,
            ];
            
            const isSystemMessage = systemMessagePatterns.some(pattern => pattern.test(text));
            
            if (isSystemMessage) {
              continue; // Skip system messages
            }
            
            // Also check if text contains multiple button options (Facebook Marketplace Assistant pattern)
            // These messages often have text like "Yes, sold on FacebookYes, sold elsewhereNo, edit listing"
            const hasButtonOptions = /yes.*sold.*facebook|yes.*sold.*elsewhere|no.*edit|no.*haven't sold/i.test(text);
            if (hasButtonOptions) {
              continue; // Skip messages with button options (Facebook Assistant)
            }
            
            // Check for Facebook Marketplace Assistant messages that contain repeated questions
            // Pattern: "It looks like you listed... Have you sold this item?" repeated multiple times
            if (/it looks like you listed.*it looks like you listed/i.test(text)) {
              continue; // Skip repeated Facebook Assistant messages
            }
            
            // Check if message contains button text concatenated (Facebook Assistant pattern)
            // Real messages don't have "Yes, sold on FacebookYes, sold elsewhere" concatenated
            if (/(yes|no).*(yes|no).*(yes|no)/i.test(text) && text.length > 50) {
              continue; // Skip messages with multiple button options concatenated
            }
            
            if (hasMessageBubbleClass && text.length > 2 && !isSystemMessage) {
              // This looks like an actual message bubble
              messageText = text;
              break; // Use the first valid message bubble found
            }
          }
          
          // Strategy 2: If no message bubble found, try to find any div[dir="auto"] but filter carefully
          if (!messageText) {
            const allDirAutoDivs = row.querySelectorAll('div[dir="auto"]');
            for (const elem of allDirAutoDivs) {
              const text = elem.textContent?.trim() || '';
              const className = elem.className || '';
              
              // Skip system messages and UI text
              const systemMessagePatterns = [
                /messages and calls are secured with end-to-end encryption/i,
                /facebook marketplace assistant/i,
                /^\d+ new message/i,
                /started this chat/i,
                /message sent/i,
                /waiting for your response/i,
                /marked the listing as/i,
                /view buyer/i,
                /you:/i,
                /sent \d+[dw] ago/i,
                /it looks like you listed this item/i,
                /have you sold this item/i,
                /yes, sold on facebook/i,
                /yes, sold elsewhere/i,
                /no, edit listing/i,
                /no, haven't sold/i,
                /over \d+ weeks? ago/i,
                /over \d+ days? ago/i,
              ];
              
              const isSystemMessage = systemMessagePatterns.some(pattern => pattern.test(text));
              
              // Skip if it's a system message or UI text
              if (isSystemMessage) {
                continue;
              }
              
              // Check for Facebook Marketplace Assistant button patterns
              const hasButtonPattern = /yes.*sold.*facebook|yes.*sold.*elsewhere|no.*edit|no.*haven't sold/i.test(text);
              if (hasButtonPattern) {
                continue; // Skip messages with button patterns
              }
              
              // Check for repeated Facebook Assistant messages
              if (/it looks like you listed.*it looks like you listed/i.test(text)) {
                continue; // Skip repeated Facebook Assistant messages
              }
              
              // Check for concatenated button options
              if (/(yes|no).*(yes|no).*(yes|no)/i.test(text) && text.length > 50) {
                continue; // Skip messages with multiple button options concatenated
              }
              
              // Skip if it contains only names or UI elements
              if (text.match(/^(Enter|See all|Notifications|Messages|Marketplace|Close)$/i)) {
                continue;
              }
              
              // Skip if it's just a name or very short
              if (text.length < 3 || text.length > 500) {
                continue;
              }
              
              // Skip if it's just numbers or timestamps
              if (text.match(/^\d+$/) || text.match(/^\d+[hmdw]|ago|yesterday|today|\d+\/\d+\/\d+|\d+:\d+$/i)) {
                continue;
              }
              
              // Check if this looks like an actual message (has message bubble classes or is in a message container)
              const hasMessageClasses = className.includes('x1gslohp') || 
                                       className.includes('x14z9mp') ||
                                       className.includes('x12nagc');
              
              // If it has message classes or is a reasonable length message, use it
              if (hasMessageClasses || (text.length >= 5 && !text.includes('·') && !text.includes('View'))) {
                messageText = text;
                break;
              }
            }
          }
          
          // Skip if no meaningful message text found
          if (!messageText || messageText.length < 3) {
            continue;
          }
          
          // Final filter: exclude any remaining system messages
          const finalSystemPatterns = [
            /messages and calls are secured/i,
            /facebook marketplace assistant/i,
            /^\d+ new message/i,
            /started this chat/i,
            /message sent/i,
            /waiting for your response/i,
            /marked the listing/i,
            /view buyer/i,
            /it looks like you listed this item/i,
            /have you sold this item/i,
            /yes, sold on facebook/i,
            /yes, sold elsewhere/i,
            /no, edit listing/i,
            /no, haven't sold/i,
            /over \d+ weeks? ago/i,
            /over \d+ days? ago/i,
          ];
          
          if (finalSystemPatterns.some(pattern => pattern.test(messageText))) {
            continue; // Skip this message
          }
          
          // Check for Facebook Marketplace Assistant button patterns
          // These messages contain button text concatenated together
          const hasButtonPattern = /yes.*sold.*facebook|yes.*sold.*elsewhere|no.*edit|no.*haven't sold/i.test(messageText);
          if (hasButtonPattern) {
            continue; // Skip messages with button patterns
          }
          
          // Check if message is too long and contains repeated text (Facebook Assistant pattern)
          // Real messages are usually shorter and don't repeat the same question multiple times
          if (messageText.length > 100 && /it looks like you listed.*it looks like you listed/i.test(messageText)) {
            continue; // Skip repeated Facebook Assistant messages
          }
          
          // Extract timestamp if available
          let timestamp: string | null = null;
          
          // First, check for abbr elements with aria-label (common timestamp format)
          const abbrElements = row.querySelectorAll('abbr[aria-label]');
          for (const abbr of abbrElements) {
            const ariaLabel = abbr.getAttribute('aria-label');
            if (ariaLabel && (ariaLabel.includes('ago') || ariaLabel.match(/\d+:\d+/) || ariaLabel.match(/\d+\/\d+\/\d+/))) {
              timestamp = ariaLabel;
              break;
            }
          }
          
          // Also check for time text in spans
          if (!timestamp) {
            const allSpans = row.querySelectorAll('span');
            for (const span of allSpans) {
              const text = span.textContent?.trim() || '';
              if (text.match(/\d+[hm]|ago|yesterday|today|\d+\/\d+\/\d+|\d+:\d+/i)) {
                timestamp = text;
                break;
              }
            }
          }
          
          if (messageText) {
            result.push({
              text: messageText,
              timestamp: timestamp || 'unknown',
              from: isFromMe ? 'me' : 'lead'
            });
          }
        } catch (e) {
          // Skip this message if extraction fails
          continue;
        }
      }
      
      return result;
    });
    
    // Process extracted messages and create message IDs
    for (const msg of extractedMessages) {
      // Create unique key based on text + timestamp for duplicate detection
      const messageKey = `${msg.text}|${msg.timestamp}`;
      
      // Skip duplicates
      if (seenMessages.has(messageKey)) {
        continue;
      }
      seenMessages.add(messageKey);
      
      // Generate stable message ID (hash of text + timestamp)
      // Remove special characters and limit length for stable ID
      const textHash = msg.text.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const timestampHash = msg.timestamp.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const messageId = `msg_${textHash}_${timestampHash}`.substring(0, 100); // Limit to 100 chars
      
      messages.push({
        messageId,
        text: msg.text,
        timestamp: msg.timestamp,
        from: msg.from
      });
    }
    
    console.log(`[Facebook Message Polling 2] ✅ Extracted ${messages.length} messages (${messages.filter(m => m.from === 'lead').length} from lead, ${messages.filter(m => m.from === 'me').length} from me)`);
    
    return messages;
  } catch (error) {
    console.log(`[Facebook Message Polling 2] ⚠️ Error extracting messages: ${error}`);
    return [];
  }
}

test('test', async ({ page, browserName }) => {
  // Only run on Chromium to avoid running on Firefox/WebKit
  if (browserName !== 'chromium') {
    test.skip();
    return;
  }
  // Increase timeout for Facebook operations (50 conversations can take 15-20 minutes)
  test.setTimeout(1200000); // 20 minutes
  
  // Use server port (5000) by default - same as facebook.message.polling.spec.ts
  // This ensures the script uses localhost in development and can be overridden via env var
  let appBaseURL = process.env.PLAYWRIGHT_BASE_URL;
  if (!appBaseURL) {
    appBaseURL = 'http://localhost:5000';
  }
  
  // Session-first: PLAYWRIGHT_STORAGE_STATE_PATH when spawned by server. Fallback: env creds for local dev.
  const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE_PATH;
  // FACEBOOK_EMAIL/PASSWORD: from env (local) or passed by server from Key Vault (fallback when storageState fails)
  const facebookEmail = process.env.FACEBOOK_EMAIL || process.env.PLAYWRIGHT_FB_EMAIL || '';
  const facebookPassword = process.env.FACEBOOK_PASSWORD || process.env.PLAYWRIGHT_FB_PASSWORD || '';

  if (!storageStatePath && (!facebookEmail || !facebookPassword)) {
    throw new Error('No auth: set PLAYWRIGHT_STORAGE_STATE_PATH (spawned by server) or FACEBOOK_EMAIL/FACEBOOK_PASSWORD (local dev). For Key Vault fallback, ensure ALLOW_HARD_LOGIN_FALLBACK and reconnect to store creds.');
  }

  console.log(`[Facebook Message Polling] Auth: ${storageStatePath ? 'storageState' : 'env credentials'}`);
  console.log(`[Facebook Message Polling] App Base URL: ${appBaseURL}`);
  if (storageStatePath) {
    const resolvedPath = path.resolve(storageStatePath);
    const exists = fs.existsSync(resolvedPath);
    console.log(`[Facebook Message Polling] storageState path: ${resolvedPath} (exists: ${exists})`);
    if (!exists) {
      console.warn('[Facebook Message Polling] ⚠️  storageState file not found - session auth may fail');
    }
  }
  
  // Verify server is accessible before starting
  console.log(`[Facebook Message Polling 2] Verifying server is accessible at ${appBaseURL}...`);
  try {
    const secretToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
    const testResponse = await fetch(`${appBaseURL}/api/facebook-messages/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretToken, conversations: [] }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    
    if (testResponse) {
      console.log(`[Facebook Message Polling 2] ✅ Server is accessible (status: ${testResponse.status})`);
    } else {
      console.warn(`[Facebook Message Polling 2] ⚠️  Could not verify server accessibility - will continue anyway`);
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error(`[Facebook Message Polling 2] ❌ Server timeout - is the server running at ${appBaseURL}?`);
    } else {
      console.warn(`[Facebook Message Polling 2] ⚠️  Server check failed: ${error?.message} - will continue anyway`);
    }
  }

  const safeWait = async (ms: number) => {
    try {
      await page.waitForTimeout(ms);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Target page') && msg.includes('closed')) return;
      throw e;
    }
  };
  
  // Step 1: Navigate to Facebook; login only if not using storageState (session-first)
  console.log('[Facebook Message Polling] Navigating to Facebook...');
  await page.goto('https://www.facebook.com/');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000); // Facebook may redirect to login/checkpoint 1-2s after load

  // Detect if we're on login page (storageState may fail in headed mode)
  const isOnLoginPage = () => page.url().includes('/login') || page.url().includes('/checkpoint');
  const hasLoginForm = async () => {
    const emailInput = page.locator('input[name="email"], input[type="email"], [data-testid="royal_email"]').first();
    return await emailInput.isVisible({ timeout: 2000 }).catch(() => false);
  };

  const needLogin = !storageStatePath || isOnLoginPage() || (await hasLoginForm());

  if (needLogin && facebookEmail && facebookPassword) {
    if (storageStatePath) {
      console.log('[Facebook Message Polling] storageState failed (on login page) - falling back to Key Vault credential login');
    } else {
      console.log('[Facebook Message Polling] Filling login form (env credentials)...');
    }
    try {
      const emailInput = page.locator('input[name="email"], input[type="email"], [data-testid="royal_email"]').first();
      const passInput = page.locator('input[name="pass"], input[type="password"], [data-testid="royal_pass"]').first();
      await emailInput.fill(facebookEmail);
      await safeWait(shortDelay());
      await passInput.fill(facebookPassword);
      await safeWait(shortDelay());
      const loginUrlBefore = page.url();
      await page.locator('button[name="login"], [data-testid="royal_login_button"]').first().click();
      await safeWait(shortDelay());
      try {
        await Promise.race([
          page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/checkpoint') && url.hostname.includes('facebook.com'), { timeout: 30000 }),
          page.waitForSelector('div[role="main"], [aria-label="Shortcuts"], [aria-label="Navigation"]', { timeout: 30000 }),
          page.waitForLoadState('networkidle', { timeout: 30000 }),
        ]);
      } catch {
        const currentUrl = page.url();
        if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint') || currentUrl === loginUrlBefore) {
          throw new Error(`Login timeout - still on login page. URL: ${currentUrl}`);
        }
      }
      await safeWait(randomDelay());
    } catch (err) {
      throw new Error(`Login failed: ${err instanceof Error ? err.message : String(err)}. Ensure FACEBOOK_EMAIL/FACEBOOK_PASSWORD or Key Vault creds are correct.`);
    }
  } else if (needLogin && !(facebookEmail && facebookPassword)) {
    throw new Error('On Facebook login page but no credentials. Set FACEBOOK_EMAIL/FACEBOOK_PASSWORD or reconnect with Key Vault credentials.');
  } else {
    console.log('[Facebook Message Polling] Using storageState auth - session valid');
  }
  
  // Handle any popups/dialogs that appear after login (try multiple common popup patterns)
  console.log('[Facebook Message Polling 2] Checking for post-login popups/dialogs...');
  const popupSelectors = [
    'button[aria-label="Close"]',
    'div[role="dialog"] button:has-text("Close")',
    'div[role="dialog"] button:has-text("Not Now")',
    'div[role="dialog"] button:has-text("Skip")',
    '[aria-label="Close"]',
    'button:has-text("Close")',
  ];
  
  for (const selector of popupSelectors) {
    try {
      const popupButton = page.locator(selector).first();
      if (await popupButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await popupButton.click();
        await page.waitForTimeout(shortDelay());
        console.log(`[Facebook Message Polling 2] Closed popup using selector: ${selector}`);
        break; // Only close one popup
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }
  
  // Wait a bit more for any remaining dialogs to settle
  await page.waitForTimeout(randomDelay());
  
  // Step 2: Navigate to Marketplace - try shortcuts menu first, then direct nav
  console.log('[Facebook Message Polling 2] Navigating to Marketplace...');
  try {
    await page.getByLabel('Shortcuts').getByRole('link', { name: 'Marketplace' }).click({ timeout: 5000 });
    await page.waitForTimeout(shortDelay());
    console.log('[Facebook Message Polling 2] Clicked Marketplace from shortcuts menu');
  } catch (error) {
    console.log('[Facebook Message Polling 2] Shortcuts menu not found, trying direct navigation...');
    try {
      await page.goto('https://www.facebook.com/marketplace', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(shortDelay());
      console.log('[Facebook Message Polling 2] Navigated directly to Marketplace');
    } catch (navError) {
      console.log('[Facebook Message Polling 2] Direct navigation failed, searching for Marketplace link...');
      const marketplaceLink = page.getByRole('link', { name: /marketplace/i }).first();
      if (await marketplaceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await marketplaceLink.click();
        await page.waitForTimeout(shortDelay());
        console.log('[Facebook Message Polling 2] Found and clicked Marketplace link');
      } else {
        throw new Error('Could not find Marketplace link');
      }
    }
  }
  await page.waitForTimeout(randomDelay());
  console.log('[Facebook Message Polling 2] Current URL after Marketplace navigation:', page.url());
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  // Handle login popup if we landed on login page (storageState may have failed) and we have creds
  if (facebookEmail && facebookPassword) {
    const onLogin = page.url().includes('/login') || page.url().includes('/checkpoint');
    const hasPopup = await page.locator('input[name="email"], input[type="email"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (onLogin || hasPopup) {
      console.log('[Facebook Message Polling] Login required at Marketplace, filling credentials...');
      try {
        await page.locator('input[name="email"]').first().fill(facebookEmail);
        await safeWait(shortDelay());
        await page.locator('input[name="pass"]').first().fill(facebookPassword);
        await safeWait(shortDelay());
        await page.locator('button[name="login"]').first().click();
        await page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/checkpoint'), { timeout: 15000 }).catch(() => {});
        await safeWait(shortDelay());
        console.log('[Facebook Message Polling] Login handled');
      } catch {
        console.log('[Facebook Message Polling] Login popup handling skipped');
      }
    }
  }

  // Step 3: Click Messenger button, then Marketplace tab in Messenger panel
  console.log('[Facebook Message Polling 2] Step 1: Clicking Messenger button...');
  const messengerSelectors = [
    () => page.locator('[aria-label="Messenger"]').first(),
    () => page.locator('[aria-label="Chat"]').first(),
    () => page.locator('[aria-label="Messages"]').first(),
    () => page.getByRole('button', { name: 'Messenger' }).or(page.getByRole('link', { name: 'Messenger' })).first(),
    () => page.locator('a[href*="messenger.com"], a[href*="/messages"]').first(),
  ];
  let messengerClicked = false;
  for (const sel of messengerSelectors) {
    try {
      const btn = sel();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click({ timeout: 10000 });
        await page.waitForTimeout(shortDelay());
        console.log('[Facebook Message Polling 2] ✅ Clicked Messenger button');
        messengerClicked = true;
        break;
      }
    } catch { /* try next */ }
  }
  if (!messengerClicked) throw new Error('Could not find Messenger button - Facebook UI may have changed');

  // Click Marketplace tab in Messenger panel
  console.log('[Facebook Message Polling 2] Step 2: Clicking Marketplace button...');
  try {
    const marketplaceSvg = page.locator('svg[viewBox="0 0 16 16"]').filter({
      has: page.locator('path[d*="M1.137 2.519A2.131"]')
    }).first();
    const buttonHandle = await marketplaceSvg.evaluateHandle((el) => {
      let current = el.parentElement;
      while (current && current.tagName !== 'BODY') {
        if (current.tagName === 'BUTTON' || current.getAttribute('role') === 'button') return current;
        current = current.parentElement;
      }
      return null;
    });
    if (buttonHandle?.asElement()) await buttonHandle.asElement()!.click();
    else await marketplaceSvg.click();
  } catch {
    await page.getByRole('button', { name: /Marketplace.*new message/i }).click({ timeout: 10000 }).catch(() => {});
  }
  await page.waitForTimeout(shortDelay());
  console.log('[Facebook Message Polling 2] ✅ Clicked Marketplace button');

  await page.waitForTimeout(randomDelay());
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(randomDelay());
  
  // Step 3: Wait 20 seconds for conversations to load in DOM
  console.log('[Facebook Message Polling 2] Step 3: Waiting 20 seconds for conversations to load in DOM...');
  await page.waitForTimeout(20000); // 20 seconds
  console.log('[Facebook Message Polling 2] ✅ Waited 20 seconds, conversations should be loaded');
  
  // Step 4: Collect all conversations from DOM
  
  // Find all conversation links by querying the DOM directly (inspector approach)
  // This gets all links in the DOM in the order they appear, not just visible ones
  console.log('[Facebook Message Polling 2] Finding all conversation links using DOM query...');
  
  // Wait for at least one conversation to appear
  let attempts = 0;
  const maxConversationAttempts = 10;
  let conversationHrefs: string[] = [];
  
  while (conversationHrefs.length === 0 && attempts < maxConversationAttempts) {
    await page.waitForTimeout(shortDelay());
    
    // Use page.evaluate() to query the DOM directly - this accesses the full DOM tree
    // Get conversations in the order they appear in the DOM (which matches visual order)
    const currentUrl = page.url();
    console.log(`[Facebook Message Polling 2] Current URL when extracting conversations: ${currentUrl}`);
    
    const extractionResult = await page.evaluate((maxCount) => {
      // Find all anchor tags with href starting with "/messages/t/"
      // querySelectorAll returns elements in document order (top to bottom, left to right)
      const allLinks = Array.from(document.querySelectorAll('a[href^="/messages/t/"]'));
      
      // Extract hrefs while preserving order (use Map to track first occurrence)
      const hrefMap = new Map<string, number>(); // href -> index in DOM
      const orderedHrefs: string[] = [];
      
      for (let i = 0; i < allLinks.length; i++) {
        const link = allLinks[i];
        const href = link.getAttribute('href');
        if (href) {
          // Remove query parameters to get clean conversation ID
          const cleanHref = href.split('?')[0];
          
          // Validate: Ensure the href contains a conversation ID (not just "/messages/t/")
          // Pattern: /messages/t/ followed by at least one digit
          const conversationIdMatch = cleanHref.match(/\/messages\/t\/(\d+)/);
          if (!conversationIdMatch || !conversationIdMatch[1]) {
            // Skip invalid hrefs (missing conversation ID)
            continue;
          }
          
          // Only add if we haven't seen this href before (deduplicate while preserving order)
          if (!hrefMap.has(cleanHref)) {
            hrefMap.set(cleanHref, i);
            orderedHrefs.push(cleanHref);
          }
        }
      }
      
      // Return both the count and the hrefs for debugging
      return {
        totalLinks: allLinks.length,
        uniqueHrefs: orderedHrefs.slice(0, maxCount),
        allHrefs: orderedHrefs
      };
    }, 50); // Limit to 50 conversations max
    
    console.log(`[Facebook Message Polling 2] DOM Query Results: Found ${extractionResult.totalLinks} total links, ${extractionResult.allHrefs.length} unique conversations`);
    conversationHrefs = extractionResult.uniqueHrefs;
    
    attempts++;
    if (conversationHrefs.length > 0) {
      console.log(`[Facebook Message Polling 2] Found ${conversationHrefs.length} unique conversations in DOM (in order) after ${attempts} attempts`);
      break;
    }
  }
  
  if (conversationHrefs.length === 0) {
    // Final attempt: wait for at least one conversation link to appear
    try {
      await page.waitForSelector('a[href^="/messages/t/"]', { timeout: 5000 });
      conversationHrefs = await page.evaluate((maxCount) => {
        const allLinks = Array.from(document.querySelectorAll('a[href^="/messages/t/"]'));
        const hrefMap = new Map<string, number>();
        const orderedHrefs: string[] = [];
        
        for (let i = 0; i < allLinks.length; i++) {
          const link = allLinks[i];
          const href = link.getAttribute('href');
          if (href) {
            const cleanHref = href.split('?')[0];
            
            // Validate: Ensure the href contains a conversation ID (not just "/messages/t/")
            // Pattern: /messages/t/ followed by at least one digit
            const conversationIdMatch = cleanHref.match(/\/messages\/t\/(\d+)/);
            if (!conversationIdMatch || !conversationIdMatch[1]) {
              // Skip invalid hrefs (missing conversation ID)
              continue;
            }
            
            if (!hrefMap.has(cleanHref)) {
              hrefMap.set(cleanHref, i);
              orderedHrefs.push(cleanHref);
            }
          }
        }
        return orderedHrefs.slice(0, maxCount);
      }, 50);
    } catch (error) {
      console.log(`[Facebook Message Polling 2] Could not find conversations after ${maxConversationAttempts} attempts`);
      throw new Error('No conversations found in DOM');
    }
  }
  
  console.log(`[Facebook Message Polling 2] Found ${conversationHrefs.length} unique conversations in DOM (in order)`);
  
  // If we found less than 50, try scrolling to load more (Facebook uses virtual scrolling)
  if (conversationHrefs.length < 50) {
    console.log(`[Facebook Message Polling 2] Found ${conversationHrefs.length} conversations, attempting to load more by scrolling...`);
    
    // Aggressively scroll to load all conversations
    let previousCount = conversationHrefs.length;
    let noNewConversationsCount = 0;
    const maxScrollAttempts = 20; // Increase scroll attempts
    
    for (let scrollAttempt = 0; scrollAttempt < maxScrollAttempts && conversationHrefs.length < 50; scrollAttempt++) {
      // Scroll the conversation list container
      await page.evaluate(() => {
        // Find the scrollable container that has conversation links
        const containers = Array.from(document.querySelectorAll('div[role="main"], div[style*="overflow"], div[class*="scroll"], div[class*="Scroll"]'));
        for (const container of containers) {
          const hasLinks = container.querySelector('a[href^="/messages/t/"]');
          if (hasLinks && container.scrollHeight > container.clientHeight) {
            // Scroll to bottom
            container.scrollTop = container.scrollHeight;
            return;
          }
        }
        // Fallback: try to find any scrollable div with conversation links
        const allDivs = Array.from(document.querySelectorAll('div'));
        for (const div of allDivs) {
          if (div.scrollHeight > div.clientHeight) {
            const hasLinks = div.querySelector('a[href^="/messages/t/"]');
            if (hasLinks) {
              div.scrollTop = div.scrollHeight;
              return;
            }
          }
        }
        // Final fallback: scroll the window
        window.scrollBy(0, 2000);
      });
      
      // Wait longer for lazy loading to complete
      await page.waitForTimeout(shortDelay() * 3);
      
      // Re-query the DOM for more conversations, preserving order
      const newHrefs = await page.evaluate((args: { maxCount: number; existingHrefs: string[] }) => {
        const { maxCount, existingHrefs } = args;
        const allLinks = Array.from(document.querySelectorAll('a[href^="/messages/t/"]'));
        const existingSet = new Set<string>(existingHrefs);
        const hrefMap = new Map<string, number>();
        const orderedHrefs: string[] = [...existingHrefs]; // Start with existing ones in order
        
        // Add new hrefs in DOM order
        for (let i = 0; i < allLinks.length; i++) {
          const link = allLinks[i];
          const href = link.getAttribute('href');
          if (href) {
            const cleanHref = href.split('?')[0];
            
            // Validate: Ensure the href contains a conversation ID (not just "/messages/t/")
            // Pattern: /messages/t/ followed by at least one digit
            const conversationIdMatch = cleanHref.match(/\/messages\/t\/(\d+)/);
            if (!conversationIdMatch || !conversationIdMatch[1]) {
              // Skip invalid hrefs (missing conversation ID)
              continue;
            }
            
            if (!existingSet.has(cleanHref) && !hrefMap.has(cleanHref)) {
              hrefMap.set(cleanHref, i);
              orderedHrefs.push(cleanHref); // Add new ones at the end in DOM order
            }
          }
        }
        
        return orderedHrefs.slice(0, maxCount);
      }, { maxCount: 50, existingHrefs: conversationHrefs }) as string[];
      
      if (newHrefs.length > conversationHrefs.length) {
        console.log(`[Facebook Message Polling 2] Scroll ${scrollAttempt + 1}: Found ${newHrefs.length} total conversations (was ${conversationHrefs.length}, +${newHrefs.length - conversationHrefs.length} new)`);
        conversationHrefs = newHrefs; // Keep the ordered list
        previousCount = conversationHrefs.length;
        noNewConversationsCount = 0; // Reset counter
      } else {
        noNewConversationsCount++;
        if (noNewConversationsCount >= 3) {
          // No new conversations after 3 attempts, stop scrolling
          console.log(`[Facebook Message Polling 2] No new conversations loaded after ${noNewConversationsCount} scroll attempts, stopping`);
          break;
        }
      }
      
      // If we've reached 50, stop
      if (conversationHrefs.length >= 50) {
        console.log(`[Facebook Message Polling 2] ✅ Reached target of 50 conversations`);
        break;
      }
    }
    
    console.log(`[Facebook Message Polling 2] Final count: ${conversationHrefs.length} conversations after scrolling`);
  }
  
  if (conversationHrefs.length === 0) {
    throw new Error('No conversations found');
  }
  
  console.log(`[Facebook Message Polling 2] Step 4: Found ${conversationHrefs.length} conversations in DOM`);
  console.log(`[Facebook Message Polling 2] Will process ${conversationHrefs.length} conversations (max 50)`);
  
  // Data structure to collect conversation data with IDs
  const collectedConversations: Array<{
    conversationId: string | null;
    conversationUrl: string;
    listingId: string | null;
    profileId: string | null;
    profileName: string | null;
    messages?: Array<{
      messageId: string;
      text: string;
      timestamp: string;
      from: 'lead' | 'me';
    }>;
  }> = [];
  
  // Track failed saves to retry at the end
  const failedSaves: Array<{
    conversationId: string | null;
    listingId: string | null;
    profileId: string | null;
    profileName: string | null;
  }> = [];
  
  // Helper function to check if server is accessible
  const checkServerHealth = async (): Promise<boolean> => {
    try {
      const healthUrl = `${appBaseURL}/api/health`;
      const response = await fetch(healthUrl, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000) 
      }).catch(() => null);
      return response?.ok || false;
    } catch {
      // If health endpoint doesn't exist, try the actual endpoint
      return true; // Assume server is up if we can't check
    }
  };
  
  // Helper function to save a single conversation to the database with retry logic
  const saveConversationToDatabase = async (conv: {
    conversationId: string | null;
    listingId: string | null;
    profileId: string | null;
    profileName: string | null;
    existingLeadId?: string | null; // Optional: leadId if conversation already exists
    messages?: Array<{
      messageId: string;
      text: string;
      timestamp: string;
      from: 'lead' | 'me';
    }>;
  }, retryCount = 0): Promise<{ success: boolean; messagesStored?: number }> => {
    // Allow save if we have either profileId (for new leads) or existingLeadId (for existing conversations)
    // Also allow if we have conversationId and messages (backend can find the lead by conversationId)
    if (!conv.profileId && !conv.existingLeadId && !conv.conversationId) {
      console.log(`[Facebook Message Polling 2] ⚠️  Skipping save - missing profileId, existingLeadId, and conversationId`);
      return { success: false };
    }
    
    // If we have messages but no profileId/existingLeadId, we can still save if conversationId exists
    // The backend will find the lead by conversationId
    if (!conv.profileId && !conv.existingLeadId && conv.conversationId && (!conv.messages || conv.messages.length === 0)) {
      console.log(`[Facebook Message Polling 2] ⚠️  Skipping save - no messages to save`);
      return { success: false };
    }
    
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds between retries
    const requestTimeout = 30000; // 30 second timeout (increased from 10)
    
    try {
      const secretToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
      // Get orgId from environment variable (set by the server when spawning the process)
      const orgId = process.env.FACEBOOK_POLLING_ORG_ID;
      if (orgId) {
        console.log(`[Facebook Message Polling 2] 📌 Using orgId from environment: ${orgId}`);
      } else {
        console.log(`[Facebook Message Polling 2] ⚠️  No orgId in environment, will use user's default org`);
      }
      
      const requestBody = {
        secretToken,
        orgId: orgId, // Pass the orgId to ensure messages are saved to the correct organization
        conversations: [{
          conversationId: conv.conversationId,
          listingId: conv.listingId,
          profileId: conv.profileId,
          profileName: conv.profileName,
          facebookEmail: storageStatePath ? null : facebookEmail,
          messages: conv.messages || [], // Include extracted messages with IDs
          conversationName: null, // Not extracting name for now
        }],
      };
      
      const apiUrl = `${appBaseURL}/api/facebook-messages/process`;
      if (retryCount === 0) {
        console.log(`[Facebook Message Polling 2] 💾 Saving conversation to database...`);
      } else {
        console.log(`[Facebook Message Polling 2] 🔄 Retrying save (attempt ${retryCount + 1}/${maxRetries})...`);
      }
      
      // Add a small delay before each save to avoid overwhelming the server
      if (retryCount === 0) {
        await page.waitForTimeout(500); // 500ms delay before first attempt
      } else {
        await page.waitForTimeout(retryDelay * retryCount); // Exponential backoff
      }
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout);
      
      const processResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log(`[Facebook Message Polling 2] Response status: ${processResponse.status} ${processResponse.statusText}`);
      console.log(`[Facebook Message Polling 2] Response URL: ${processResponse.url}`);
      
      // Get response text first to check if it's JSON or HTML
      const responseText = await processResponse.text();
      const contentType = processResponse.headers.get('content-type') || '';
      
      if (!processResponse.ok) {
        console.error(`[Facebook Message Polling 2] ❌ API returned error status: ${processResponse.status}`);
        console.error(`[Facebook Message Polling 2] Response content-type: ${contentType}`);
        console.error(`[Facebook Message Polling 2] Response body (first 500 chars): ${responseText.substring(0, 500)}`);
        throw new Error(`Failed to save conversation: ${processResponse.status} ${responseText.substring(0, 200)}`);
      }
      
      // Check if response is JSON
      if (!contentType.includes('application/json')) {
        console.error(`[Facebook Message Polling 2] ❌ API returned non-JSON response`);
        console.error(`[Facebook Message Polling 2] Request URL: ${apiUrl}`);
        console.error(`[Facebook Message Polling 2] Response URL: ${processResponse.url}`);
        console.error(`[Facebook Message Polling 2] Response status: ${processResponse.status}`);
        console.error(`[Facebook Message Polling 2] Content-Type: ${contentType}`);
        console.error(`[Facebook Message Polling 2] Response body (first 500 chars): ${responseText.substring(0, 500)}`);
        
        // Check if URL was redirected
        if (processResponse.url !== apiUrl) {
          console.error(`[Facebook Message Polling 2] ⚠️  Request was redirected from ${apiUrl} to ${processResponse.url}`);
        }
        
        // Suggest checking server logs
        console.error(`[Facebook Message Polling 2] 💡 TROUBLESHOOTING:`);
        console.error(`[Facebook Message Polling 2]   1. Check if server is running and endpoint is deployed`);
        console.error(`[Facebook Message Polling 2]   2. Check server logs for: "[Facebook Messages] 📥 Received request"`);
        console.error(`[Facebook Message Polling 2]   3. Verify endpoint exists at: ${apiUrl}`);
        console.error(`[Facebook Message Polling 2]   4. Check if appBaseURL is correct: ${appBaseURL}`);
        
        throw new Error(`API returned HTML instead of JSON. The endpoint may not be accessible. Check server logs.`);
      }
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[Facebook Message Polling 2] ❌ Failed to parse JSON response`);
        console.error(`[Facebook Message Polling 2] Response body (first 500 chars): ${responseText.substring(0, 500)}`);
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
      }
      
      const resultData = result.results?.[0] || result;
      const messagesStored = resultData?.messagesStored ?? (result.messagesStored ?? 0);
      
      console.log(`[Facebook Message Polling 2] ✅ Saved conversation to database:`, {
        profileId: conv.profileId,
        profileName: conv.profileName,
        listingId: conv.listingId,
        conversationId: conv.conversationId,
        messagesStored: messagesStored,
        result: resultData,
      });
      return { success: true, messagesStored };
    } catch (error: any) {
      // Check if it's a network error that we should retry
      const isNetworkError = error?.name === 'TypeError' && error?.message?.includes('fetch failed') ||
                            error?.name === 'AbortError' ||
                            error?.code === 'ECONNREFUSED' ||
                            error?.code === 'ETIMEDOUT';
      
      // Only retry if we haven't exceeded max retries
      if (isNetworkError && retryCount < maxRetries) {
        console.error(`[Facebook Message Polling 2] ⚠️  Network error (attempt ${retryCount + 1}/${maxRetries}): ${error.message}`);
        console.log(`[Facebook Message Polling 2] 🔄 Will retry after delay...`);
        // Retry with exponential backoff
        return await saveConversationToDatabase(conv, retryCount + 1);
      }
      
      // Log the error
      if (error?.name === 'AbortError') {
        console.error(`[Facebook Message Polling 2] ❌ Request timeout after ${requestTimeout / 1000} seconds`);
        console.error(`[Facebook Message Polling 2] 💡 The server may be slow or not responding. Check if server is running at ${appBaseURL}`);
      } else if (error?.code === 'ECONNREFUSED') {
        console.error(`[Facebook Message Polling 2] ❌ Connection refused - is the server running at ${appBaseURL}?`);
      } else {
        console.error(`[Facebook Message Polling 2] ❌ Error saving conversation to database: ${error?.message || error}`);
        if (error?.stack) {
          console.error(`[Facebook Message Polling 2] Error stack: ${error.stack.substring(0, 500)}`);
        }
      }
      
      return { success: false };
    }
  };
  
  // Track consecutive conversations with no new messages
  let consecutiveNoNewMessages = 0;
  const MAX_CONSECUTIVE_NO_NEW_MESSAGES = 3;
  let stoppedEarly = false;
  
  // Process each conversation by navigating directly to the URL
  for (let i = 0; i < conversationHrefs.length; i++) {
    try {
      const targetHref = conversationHrefs[i];
      
      // Validate href before processing
      if (!targetHref || targetHref === '/messages/t/' || !targetHref.match(/\/messages\/t\/(\d+)/)) {
        console.log(`[Facebook Message Polling 2] ⚠️ Skipping invalid conversation href: ${targetHref}`);
        continue;
      }
      
      const fullUrl = `https://www.facebook.com${targetHref}`;
      console.log(`[Facebook Message Polling 2] Processing conversation ${i + 1}/${conversationHrefs.length}: ${fullUrl}`);
      
      // Extract conversation ID from URL
      const conversationId = extractConversationId(fullUrl);
      if (!conversationId) {
        console.log(`[Facebook Message Polling 2] ⚠️ Could not extract conversation ID from URL: ${fullUrl}, skipping`);
        continue;
      }
      console.log(`[Facebook Message Polling 2] Conversation ID: ${conversationId}`);
      
      // OPTIMIZATION: Check if conversation exists and if last message is already in database
      const orgId = process.env.FACEBOOK_POLLING_ORG_ID;
      let conversationExists = false;
      let existingLeadId: string | null = null;
      let lastMessageInDb: { content: string; timestamp: string; type?: string } | null = null;
      let shouldSkipConversation = false;
      
      if (conversationId) {
        if (!orgId) {
          console.log(`[Facebook Message Polling 2] ⚠️ No orgId in environment - optimization check will use user's default org`);
        }
        
        try {
          const secretToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
          console.log(`[Facebook Message Polling 2] 🔍 Checking conversation status for conversationId: ${conversationId}${orgId ? `, orgId: ${orgId}` : ' (will use user default)'}`);
          
          const checkResponse = await fetch(`${appBaseURL}/api/facebook-messages/check-conversation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secretToken, conversationId, orgId: orgId || null }),
            signal: AbortSignal.timeout(5000),
          });
          
          if (checkResponse.ok) {
            const checkData = await checkResponse.json();
            conversationExists = checkData.exists;
            existingLeadId = checkData.leadId || null;
            lastMessageInDb = checkData.lastMessage || null;
            
            if (conversationExists && lastMessageInDb) {
              console.log(`[Facebook Message Polling 2] ✅ Conversation exists with last message in DB (leadId: ${existingLeadId})`);
            } else if (conversationExists && !lastMessageInDb) {
              console.log(`[Facebook Message Polling 2] ⚠️ Conversation exists but has no messages in DB (leadId: ${existingLeadId})`);
            } else {
              console.log(`[Facebook Message Polling 2] ℹ️ Conversation does not exist in DB - will process normally`);
            }
          } else {
            const errorText = await checkResponse.text().catch(() => 'Unknown error');
            console.log(`[Facebook Message Polling 2] ⚠️ Check conversation API returned status ${checkResponse.status}: ${errorText}`);
          }
        } catch (error) {
          console.log(`[Facebook Message Polling 2] ⚠️ Error checking conversation status: ${error}, will proceed with normal extraction`);
        }
      } else {
        console.log(`[Facebook Message Polling 2] ⚠️ No conversationId extracted from URL - cannot check optimization`);
      }
      
      // Initialize data for this conversation
      let listingId: string | null = null;
      let profileId: string | null = null;
      let profileName: string | null = null;
      
      // OPTIMIZATION: If conversation exists, we can skip extracting listing/profile IDs (they're already in DB)
      // But we still need to navigate to extract messages if needed
      const skipIdExtraction = conversationExists && existingLeadId;
      
      if (skipIdExtraction) {
        console.log(`[Facebook Message Polling 2] ⚡ Conversation exists - skipping listing/profile ID extraction, will only extract new messages if needed`);
      }
      
      // Step 5: Navigate to conversation URL (for first conversation, or all if processing multiple)
      console.log(`[Facebook Message Polling 2] Step 5: Navigating to conversation: ${fullUrl}`);
      try {
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(shortDelay());
        console.log('[Facebook Message Polling 2] ✅ Navigated to conversation');
      } catch (error) {
        console.log(`[Facebook Message Polling 2] ❌ Direct navigation failed: ${error}`);
        // Continue to next conversation if navigation fails
        continue;
      }
      
      // Step 6: Handle restore popup only on the first conversation when navigating to /messages URL
      if (i === 0) {
        console.log('[Facebook Message Polling 2] Step 6: Handling restore popup (first conversation only)...');
        try {
          await page.getByRole('button', { name: 'Close' }).nth(1).click();
  await page.getByRole('button', { name: 'Don\'t restore messages' }).click();
          console.log('[Facebook Message Polling 2] ✅ Handled restore popup');
        } catch (error) {
          console.log('[Facebook Message Polling 2] Restore popup not found or already dismissed, continuing...');
        }
      }
      
      // Step 7: Verify we're in the conversation and extract lead info
      console.log('[Facebook Message Polling 2] Step 7: Verifying we are in the conversation...');
      const currentUrl = page.url();
      const expectedPath = targetHref.split('?')[0]; // Remove query params for comparison
      
      if (!currentUrl.includes(expectedPath)) {
        console.log(`[Facebook Message Polling 2] URL mismatch. Expected: ${expectedPath}, Got: ${currentUrl}`);
        // Try waiting a bit more and check again
        await page.waitForTimeout(shortDelay() * 2);
        const newUrl = page.url();
        if (!newUrl.includes(expectedPath)) {
          console.log(`[Facebook Message Polling 2] Still not in conversation. Current URL: ${newUrl}`);
        }
      } else {
        console.log(`[Facebook Message Polling 2] ✅ Successfully navigated to conversation`);
      }
      
      // Wait for conversation to load - look for message input or conversation-specific elements
      try {
        await page.waitForSelector('[role="textbox"], [data-testid*="message"], div[class*="x6s0dn4"], [aria-label*="Message"]', { timeout: 10000 });
        console.log('[Facebook Message Polling 2] Conversation loaded successfully');
      } catch (error) {
        console.log(`[Facebook Message Polling 2] Conversation elements not found, but continuing...`);
      }
      
      await page.waitForTimeout(shortDelay());
      
      // Click "See details" link dynamically and extract listing ID (skip if conversation exists)
      if (!skipIdExtraction) {
        // Wait 0.75 seconds after conversation loads before looking for "See details" link
        await page.waitForTimeout(750);
        console.log('[Facebook Message Polling 2] Looking for "See details" link...');
        try {
        const seeDetailsLink = page.getByRole('link', { name: 'See details', exact: true });
        if (await seeDetailsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          // Get href before clicking to extract listing ID
          const seeDetailsHref = await seeDetailsLink.getAttribute('href').catch(() => null);
          if (seeDetailsHref) {
            // If href is relative, construct full URL
            const seeDetailsUrl = seeDetailsHref.startsWith('http') ? seeDetailsHref : `https://www.facebook.com${seeDetailsHref}`;
            listingId = extractListingId(seeDetailsUrl);
            if (listingId) {
              console.log(`[Facebook Message Polling 2] Found listing ID from href: ${listingId}`);
            }
          }
          
          // Click and wait for navigation
          await Promise.all([
            page.waitForURL(/marketplace\/item\//, { timeout: 10000 }).catch(() => {}),
            seeDetailsLink.click()
          ]);
          await page.waitForTimeout(shortDelay());
          
          // Get the actual URL after navigation to extract listing ID
          const listingUrl = page.url();
          listingId = extractListingId(listingUrl);
          if (listingId) {
            console.log(`[Facebook Message Polling 2] ✅ Extracted listing ID: ${listingId} from URL: ${listingUrl}`);
          } else {
            console.log(`[Facebook Message Polling 2] ⚠️ Could not extract listing ID from URL: ${listingUrl}`);
          }
        } else {
          console.log('[Facebook Message Polling 2] "See details" link not found, skipping...');
        }
        } catch (error) {
          console.log(`[Facebook Message Polling 2] Error clicking "See details": ${error}`);
        }
      } else {
        console.log('[Facebook Message Polling 2] ⏭️ Skipping "See details" extraction - conversation already exists');
      }
      
      // Close the listing details if it opened
      try {
        const closeButton = page.getByRole('banner').getByRole('button', { name: 'Close' });
        if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(shortDelay());
          console.log('[Facebook Message Polling 2] Closed listing details');
        }
      } catch (error) {
        // Ignore if close button not found
      }
      
      // Navigate back to conversation if we're not there
      if (!page.url().includes('/messages/t/')) {
        try {
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          await page.waitForTimeout(shortDelay());
        } catch (error) {
          console.log(`[Facebook Message Polling 2] Error navigating back to conversation: ${error}`);
        }
      }
      
      // Click "More options" to access "View buyer" and extract profile ID (skip if conversation exists)
      if (!skipIdExtraction) {
        try {
          // Check if page is still open before proceeding
          if (page.isClosed()) {
            console.log(`[Facebook Message Polling 2] ⚠️ Page is closed, skipping "View buyer" extraction`);
            throw new Error('Page is closed');
          }
          
          const moreOptionsButton = page.getByRole('button', { name: 'More options', exact: true });
          if (await moreOptionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await moreOptionsButton.click();
            await page.waitForTimeout(shortDelay());
            
            // Check if page is still open
            if (page.isClosed()) {
              console.log(`[Facebook Message Polling 2] ⚠️ Page closed after clicking "More options"`);
              throw new Error('Page is closed');
            }
            
            // Click "View buyer" with shorter timeout to avoid hanging
            const viewBuyerMenuItem = page.getByRole('menuitem', { name: 'View buyer' });
            if (await viewBuyerMenuItem.isVisible({ timeout: 5000 }).catch(() => false)) {
              // Click and wait for navigation with timeout protection
              try {
                await Promise.race([
                  Promise.all([
                    page.waitForURL(/marketplace\/profile\//, { timeout: 8000 }).catch(() => {}),
                    viewBuyerMenuItem.click()
                  ]),
                  // Add a timeout to prevent hanging
                  new Promise((_, reject) => setTimeout(() => reject(new Error('View buyer navigation timeout')), 10000))
                ]);
              } catch (error: any) {
                console.log(`[Facebook Message Polling 2] ⚠️ View buyer navigation timeout or error: ${error?.message || error}`);
                // Continue anyway - we might still be able to extract profile ID from URL
              }
              
              // Check if page is still open before accessing URL
              if (!page.isClosed()) {
                await page.waitForTimeout(shortDelay());
                
                // Get the actual URL after navigation to extract profile ID
                const profileUrl = page.url();
                profileId = extractProfileId(profileUrl);
                if (profileId) {
                  console.log(`[Facebook Message Polling 2] ✅ Extracted profile ID: ${profileId} from URL: ${profileUrl}`);
                } else {
                  console.log(`[Facebook Message Polling 2] ⚠️ Could not extract profile ID from URL: ${profileUrl}`);
                }
                
                // Extract profile name from the profile page
                profileName = await extractProfileName(page);
                if (!profileName) {
                  console.log(`[Facebook Message Polling 2] ⚠️ Could not extract profile name`);
                }
              } else {
                console.log(`[Facebook Message Polling 2] ⚠️ Page closed during profile extraction`);
              }
            } else {
              console.log(`[Facebook Message Polling 2] ⚠️ "View buyer" menu item not found`);
            }
          } else {
            console.log(`[Facebook Message Polling 2] ⚠️ "More options" button not found`);
          }
        } catch (error: any) {
          console.log(`[Facebook Message Polling 2] Error accessing "View buyer": ${error?.message || error}`);
          // Don't throw - continue processing even if profile extraction fails
          // The conversation can still be saved with just conversationId and listingId
        }
      } else {
        console.log('[Facebook Message Polling 2] ⏭️ Skipping "View buyer" extraction - conversation already exists');
      }
      
      // Close the profile view if page is still open
      if (!page.isClosed()) {
        try {
          const closeProfileButton = page.getByRole('button', { name: 'Close' });
          if (await closeProfileButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await closeProfileButton.click();
            await page.waitForTimeout(shortDelay());
            console.log('[Facebook Message Polling 2] Closed profile view');
          }
        } catch (error) {
          // Ignore if close button not found
        }
      } else {
        console.log(`[Facebook Message Polling 2] ⚠️ Page is closed, skipping profile view close`);
      }
      
      // Navigate back to conversation if page is still open
      if (!page.isClosed()) {
        let currentUrlAfterProfile: string;
        try {
          currentUrlAfterProfile = page.url();
        } catch (error: any) {
          console.log(`[Facebook Message Polling 2] ⚠️ Cannot get page URL (page may be closed): ${error?.message || error}`);
          throw new Error('Page closed - cannot continue processing this conversation');
        }
        
        if (!currentUrlAfterProfile.includes(`/messages/t/${conversationId}`)) {
          console.log('[Facebook Message Polling 2] Navigating back to conversation to extract messages...');
          try {
            await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(shortDelay());
            
            // Wait for conversation to load
            try {
              await page.waitForSelector('[role="textbox"], [data-testid*="message"], div[class*="x6s0dn4"], [aria-label*="Message"]', { timeout: 10000 });
            } catch (error) {
              console.log(`[Facebook Message Polling 2] Conversation elements not found after navigation, but continuing...`);
            }
          } catch (error: any) {
            console.log(`[Facebook Message Polling 2] Error navigating back to conversation: ${error?.message || error}`);
            // If navigation fails and page is closed, we can't continue processing this conversation
            if (page.isClosed()) {
              throw new Error('Page closed during navigation');
            }
          }
        }
      } else {
        console.log(`[Facebook Message Polling 2] ⚠️ Page is closed, cannot navigate back to conversation`);
      }
      
      // OPTIMIZATION: If conversation exists, check last message first before extracting all messages
      let messages: Array<{
        messageId: string;
        text: string;
        timestamp: string;
        from: 'lead' | 'me';
      }> = [];
      
      if (conversationExists && existingLeadId && lastMessageInDb) {
        // First, extract just the last message to check if it exists in DB
        console.log('[Facebook Message Polling 2] Conversation exists - checking last message first...');
        
        try {
          // Extract all messages to get the last one (we need to scroll to see it)
          const allMessages = await extractMessages(page);
          
          if (allMessages.length > 0) {
            const lastMessageFromPage = allMessages[allMessages.length - 1]; // Last message in array (most recent)
            
            // Check if the last message from page exists in DB
            const secretToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
            const requestBody: any = {
              secretToken,
              leadId: existingLeadId,
              messageContent: lastMessageFromPage.text,
            };
            // Only include timestamp if it's valid (not "unknown")
            if (lastMessageFromPage.timestamp && lastMessageFromPage.timestamp !== 'unknown') {
              requestBody.timestamp = lastMessageFromPage.timestamp;
            }
            
            const checkMessageResponse = await fetch(`${appBaseURL}/api/facebook-messages/check-message`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(requestBody),
              signal: AbortSignal.timeout(5000),
            });
            
            if (checkMessageResponse.ok) {
              const checkMessageData = await checkMessageResponse.json();
              if (checkMessageData.exists) {
                console.log(`[Facebook Message Polling 2] ✅ Last message already exists in DB - no new messages found`);
                shouldSkipConversation = true;
                messages = []; // No new messages
              } else {
                console.log(`[Facebook Message Polling 2] ⚠️ Last message from page not found in DB - extracting messages backwards from last message`);
                
                // Extract messages backwards: start from the last message and work backwards
                // Messages are already in chronological order from DOM extraction (oldest to newest)
                const chronologicalMessages = [...allMessages];
                const newMessages: typeof chronologicalMessages = [];
                
                // Work backwards from the last message (most recent) to find where to stop
                // Start from the last message and continue backwards until we find one that exists in DB
                for (let j = chronologicalMessages.length - 1; j >= 0; j--) {
                  const msg = chronologicalMessages[j];
                  
                  // Check if this message exists in DB
                  try {
                    const requestBody: any = {
                      secretToken,
                      leadId: existingLeadId,
                      messageContent: msg.text,
                    };
                    // Only include timestamp if it's valid (not "unknown")
                    if (msg.timestamp && msg.timestamp !== 'unknown') {
                      requestBody.timestamp = msg.timestamp;
                    }
                    
                    const checkMsgResponse = await fetch(`${appBaseURL}/api/facebook-messages/check-message`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(requestBody),
                      signal: AbortSignal.timeout(3000),
                    });
                    
                    if (checkMsgResponse.ok) {
                      const checkMsgData = await checkMsgResponse.json();
                      if (checkMsgData.exists) {
                        // Found a message that exists in DB - stop here, we've found the last saved message
                        console.log(`[Facebook Message Polling 2] Found existing message at index ${j} (message: "${msg.text.substring(0, 50)}..."), stopping extraction`);
                        break;
                      } else {
                        // This message doesn't exist in DB - add it to new messages
                        // Since we're going backwards, we'll reverse the array at the end to get chronological order
                        newMessages.unshift(msg); // Add to beginning to maintain chronological order
                      }
                    }
                  } catch (error) {
                    // If check fails, assume it's new and add it
                    newMessages.unshift(msg);
                  }
                }
                
                // newMessages is now in chronological order (oldest to newest)
                messages = newMessages;
                console.log(`[Facebook Message Polling 2] ✅ Extracted ${messages.length} new messages (working backwards from last message)`);
              }
            } else {
              console.log(`[Facebook Message Polling 2] ⚠️ Error checking last message (status ${checkMessageResponse.status}), will process all messages`);
              messages = allMessages; // Fallback: process all messages
            }
          } else {
            console.log(`[Facebook Message Polling 2] ⚠️ No messages extracted from conversation`);
            messages = [];
          }
        } catch (error) {
          console.log(`[Facebook Message Polling 2] ⚠️ Error checking last message: ${error}, will extract all messages`);
          // Fallback: extract all messages if check fails
          messages = await extractMessages(page);
          console.log(`[Facebook Message Polling 2] ✅ Extracted ${messages.length} messages from conversation (fallback)`);
        }
      } else {
        // Conversation doesn't exist or no last message in DB - extract all messages normally
        console.log('[Facebook Message Polling 2] Extracting messages from conversation...');
        messages = await extractMessages(page);
        console.log(`[Facebook Message Polling 2] ✅ Extracted ${messages.length} messages from conversation`);
      }
      
      // Note: Timestamps are created when messages are saved to DB, not extracted from DOM
      // Messages are already in chronological order from DOM extraction, so no need to sort
      // The database will assign proper timestamps when saving
      
      // Log message details
      if (messages.length > 0) {
        const leadMessages = messages.filter(m => m.from === 'lead');
        const myMessages = messages.filter(m => m.from === 'me');
        console.log(`[Facebook Message Polling 2] Messages breakdown: ${leadMessages.length} from lead, ${myMessages.length} from me`);
        
        // Log ALL messages (not just first 3)
        console.log(`[Facebook Message Polling 2] All messages:`);
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const preview = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
          console.log(`[Facebook Message Polling 2]   [${i + 1}/${messages.length}] [${msg.from.toUpperCase()}] ${preview} (${msg.timestamp}) [ID: ${msg.messageId}]`);
        }
      } else {
        // Distinguish between "no messages extracted" vs "no new messages" (all filtered out)
        if (conversationExists && existingLeadId) {
          console.log(`[Facebook Message Polling 2] ⚠️ No new messages found in this conversation`);
        } else {
          console.log(`[Facebook Message Polling 2] ⚠️ No messages found in this conversation`);
        }
      }
      
      // Store the collected data for this conversation
      const conversationData = {
        conversationId,
        conversationUrl: fullUrl,
        listingId,
        profileId,
        profileName,
        existingLeadId: existingLeadId || null, // Include existingLeadId if conversation exists
        messages,
      };
      collectedConversations.push(conversationData);
      
      console.log(`[Facebook Message Polling 2] ✅ Collected data for conversation ${i + 1}:`, {
        conversationId,
        listingId,
        profileId,
        profileName,
        messageCount: messages.length,
        leadMessageCount: messages.filter(m => m.from === 'lead').length,
        myMessageCount: messages.filter(m => m.from === 'me').length,
      });
      
      // Save immediately to database after each conversation (skip if conversation is up to date)
      let messagesStored = 0;
      if (!shouldSkipConversation) {
        const saveResult = await saveConversationToDatabase(conversationData);
        if (!saveResult.success && conversationData.profileId) {
          // Track failed saves for retry at the end
          failedSaves.push(conversationData);
          messagesStored = 0; // Failed save means no messages stored
        } else if (saveResult.success) {
          // Get messagesStored from the API response
          messagesStored = saveResult.messagesStored || 0;
        }
      } else {
        console.log(`[Facebook Message Polling 2] ⏭️ Skipping save - conversation is up to date`);
        messagesStored = 0; // No new messages
      }
      
      // Check if this conversation qualifies for early stopping:
      // 1. Conversation exists in database
      // 2. Last message is from the lead (not from Lead2Lease/me)
      // 3. Last message is already in database (no new messages)
      const isLeadLastMessage = lastMessageInDb?.type === 'incoming' || lastMessageInDb?.type === 'received';
      const qualifiesForEarlyStop = conversationExists && isLeadLastMessage && (messagesStored === 0 || shouldSkipConversation);
      
      if (qualifiesForEarlyStop) {
        consecutiveNoNewMessages++;
        console.log(`[Facebook Message Polling 2] 📊 Consecutive conversations with lead's last message already in DB: ${consecutiveNoNewMessages}/${MAX_CONSECUTIVE_NO_NEW_MESSAGES}`);
        
        // If we've hit the threshold (3 consecutive conversations with lead's last message already saved), stop processing
        if (consecutiveNoNewMessages === MAX_CONSECUTIVE_NO_NEW_MESSAGES) {
          console.log(`[Facebook Message Polling 2] ✅ All messages are caught up - last ${MAX_CONSECUTIVE_NO_NEW_MESSAGES} conversations have lead's last message already in database. Stopping polling.`);
          console.log(`[Facebook Message Polling 2] Processed ${i + 1} out of ${conversationHrefs.length} conversations before stopping.`);
          stoppedEarly = true;
          break; // Exit the loop
        }
      } else {
        // Reset counter if:
        // - Conversation doesn't exist
        // - Last message is from Lead2Lease/me (not from lead)
        // - We found new messages
        if (consecutiveNoNewMessages > 0) {
          const reason = !conversationExists ? 'conversation is new' : 
                        !isLeadLastMessage ? 'last message is from Lead2Lease' : 
                        'found new messages';
          console.log(`[Facebook Message Polling 2] 📊 Resetting consecutive counter - ${reason}`);
        }
        consecutiveNoNewMessages = 0;
        if (messagesStored > 0) {
          console.log(`[Facebook Message Polling 2] 📊 Found ${messagesStored} new message(s) - resetting consecutive counter`);
        }
      }
      
      // Note: The hover actions on specific text elements are removed as they're not essential
      // and the text content can vary between conversations
      
      // No need to go back to conversation list - we'll navigate directly to the next URL
      // Wait a bit before processing next conversation
      if (!page.isClosed()) {
        await page.waitForTimeout(shortDelay());
      }
      
    } catch (error) {
      console.error(`[Facebook Message Polling 2] Error processing conversation ${i + 1}: ${error}`);
      // On error, don't increment the consecutive counter (errors don't count as "no new messages")
      // Continue to next conversation - no need to go back to list since we navigate directly
      // Check if page is still open before waiting
      try {
        if (!page.isClosed()) {
          await page.waitForTimeout(shortDelay());
        } else {
          console.log(`[Facebook Message Polling 2] ⚠️ Page is closed, skipping wait`);
        }
      } catch (waitError) {
        console.log(`[Facebook Message Polling 2] ⚠️ Could not wait (page may be closed): ${waitError}`);
      }
    }
  }
  
  // Log completion message
  if (stoppedEarly) {
    console.log(`[Facebook Message Polling 2] ✅ All messages are caught up - last ${MAX_CONSECUTIVE_NO_NEW_MESSAGES} conversations have lead's last message already in database`);
  }
  
  console.log('[Facebook Message Polling 2] Finished processing all conversations');
  console.log(`[Facebook Message Polling 2] Collected data for ${collectedConversations.length} conversations:`);
  
  // Summary
  const withListingId = collectedConversations.filter(c => c.listingId).length;
  const withProfileId = collectedConversations.filter(c => c.profileId).length;
  const withConversationId = collectedConversations.filter(c => c.conversationId).length;
  const withAllThree = collectedConversations.filter(c => c.listingId && c.profileId && c.conversationId).length;
  
  // Calculate message statistics
  const totalMessages = collectedConversations.reduce((sum, c) => sum + (c.messages?.length || 0), 0);
  const totalLeadMessages = collectedConversations.reduce((sum, c) => sum + (c.messages?.filter(m => m.from === 'lead').length || 0), 0);
  const totalMyMessages = collectedConversations.reduce((sum, c) => sum + (c.messages?.filter(m => m.from === 'me').length || 0), 0);
  const withMessages = collectedConversations.filter(c => c.messages && c.messages.length > 0).length;
  
  console.log(`[Facebook Message Polling 2] Final Summary:`);
  console.log(`  - Total conversations processed: ${collectedConversations.length}`);
  console.log(`  - Conversations with profile ID: ${withProfileId}`);
  console.log(`  - Conversations with listing ID: ${withListingId}`);
  console.log(`  - Conversations with conversation ID: ${withConversationId}`);
  console.log(`  - Conversations with all three IDs: ${withAllThree}`);
  console.log(`  - Conversations with messages: ${withMessages}`);
  console.log(`  - Total messages extracted: ${totalMessages} (${totalLeadMessages} from leads, ${totalMyMessages} from me)`);
  
  // Retry failed saves
  if (failedSaves.length > 0) {
    console.log(`[Facebook Message Polling 2] 🔄 Retrying ${failedSaves.length} failed saves...`);
    await page.waitForTimeout(shortDelay() * 2); // Wait a bit before retrying
    
    for (let i = 0; i < failedSaves.length; i++) {
      const failedConv = failedSaves[i];
      console.log(`[Facebook Message Polling 2] Retrying save ${i + 1}/${failedSaves.length}...`);
      const retryResult = await saveConversationToDatabase(failedConv);
      if (retryResult.success) {
        console.log(`[Facebook Message Polling 2] ✅ Successfully saved on retry: ${failedConv.profileId}`);
      } else {
        console.error(`[Facebook Message Polling 2] ❌ Still failed after retry: ${failedConv.profileId}`);
      }
      await page.waitForTimeout(shortDelay()); // Delay between retries
    }
    
    console.log(`[Facebook Message Polling 2] Completed retry attempts for ${failedSaves.length} conversations`);
  }
  
  console.log(`[Facebook Message Polling 2] ✅ Message polling completed`);
});