import { test, expect } from '@playwright/test';

// Helper function to generate random delay between 2-3 seconds
const randomDelay = () => Math.floor(Math.random() * 1000) + 2000;

// Helper function to generate random delay between 1-2 seconds
const shortDelay = () => Math.floor(Math.random() * 1000) + 1000;

test('Send Facebook messages from Lead2Lease', async ({ page }) => {
  // Increase timeout to 5 minutes to allow for 2FA
  test.setTimeout(300000); // 5 minutes
  // Use server port (5000) by default - same as facebook.message.polling2.spec.ts
  // This ensures the script uses localhost in development and can be overridden via env var
  let appBaseURL = process.env.PLAYWRIGHT_BASE_URL;
  if (!appBaseURL) {
    appBaseURL = 'http://localhost:5000';
  }
  
  // Session-first: PLAYWRIGHT_STORAGE_STATE_PATH when spawned by server. Fallback: env or Key Vault creds.
  const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE_PATH;
  const facebookEmail = process.env.FACEBOOK_EMAIL || process.env.PLAYWRIGHT_FB_EMAIL || '';
  const facebookPassword = process.env.FACEBOOK_PASSWORD || process.env.PLAYWRIGHT_FB_PASSWORD || '';

  if (!storageStatePath && (!facebookEmail || !facebookPassword)) {
    throw new Error('No auth: set PLAYWRIGHT_STORAGE_STATE_PATH (spawned by server) or FACEBOOK_EMAIL/FACEBOOK_PASSWORD (local dev). For Key Vault fallback, ensure ALLOW_HARD_LOGIN_FALLBACK and reconnect.');
  }

  console.log(`[Facebook Send Message] Auth: ${storageStatePath ? 'storageState' : 'env credentials'}`);
  console.log(`[Facebook Send Message] App Base URL: ${appBaseURL}`);
  
  const secretToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';

  // Verify server is accessible before starting
  console.log(`[Facebook Send Message] Verifying server is accessible at ${appBaseURL}...`);
  try {
    const testResponse = await fetch(`${appBaseURL}/api/facebook-messages/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secretToken, conversations: [] }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    
    if (testResponse) {
      console.log(`[Facebook Send Message] ✅ Server is accessible (status: ${testResponse.status})`);
    } else {
      console.warn(`[Facebook Send Message] ⚠️  Could not verify server accessibility - will continue anyway`);
    }
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error(`[Facebook Send Message] ❌ Server timeout - is the server running at ${appBaseURL}?`);
    } else {
      console.warn(`[Facebook Send Message] ⚠️  Server check failed: ${error?.message} - will continue anyway`);
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

  // Step 1: Navigate to Facebook; detect login page and fallback to creds if storageState fails
  console.log('[Facebook Send Message] Navigating to Facebook...');
  await page.goto('https://www.facebook.com/');
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const isOnLoginPage = () => page.url().includes('/login') || page.url().includes('/checkpoint');
  const hasLoginForm = async () => {
    const emailInput = page.locator('input[name="email"], input[type="email"], [data-testid="royal_email"]').first();
    return await emailInput.isVisible({ timeout: 2000 }).catch(() => false);
  };
  const needLogin = !storageStatePath || isOnLoginPage() || (await hasLoginForm());

  if (needLogin && facebookEmail && facebookPassword) {
    if (storageStatePath) {
      console.log('[Facebook Send Message] storageState failed (on login page) - falling back to Key Vault credential login');
    } else {
      console.log('[Facebook Send Message] Filling login form (env credentials)...');
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
    console.log('[Facebook Send Message] Using storageState auth - session valid');
  }
  
  // Handle any popups/dialogs that appear after login (try multiple common popup patterns)
  console.log('[Facebook Send Message] Checking for post-login popups/dialogs...');
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
        console.log(`[Facebook Send Message] Closed popup using selector: ${selector}`);
        break; // Only close one popup
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }
  
  // Wait a bit more for any remaining dialogs to settle
  await page.waitForTimeout(randomDelay());
  
  // Step 2: Navigate to Marketplace - try multiple ways to find it
  console.log('[Facebook Send Message] Navigating to Marketplace...');
  try {
    // Try the shortcuts menu first
    await page.getByLabel('Shortcuts').getByRole('link', { name: 'Marketplace' }).click({ timeout: 5000 });
    await page.waitForTimeout(shortDelay());
    console.log('[Facebook Send Message] Clicked Marketplace from shortcuts menu');
  } catch (error) {
    console.log('[Facebook Send Message] Shortcuts menu not found, trying direct navigation...');
    // Fallback: Try direct navigation or search
    try {
      await page.goto('https://www.facebook.com/marketplace');
      await page.waitForTimeout(shortDelay());
      console.log('[Facebook Send Message] Navigated directly to Marketplace');
    } catch (navError) {
      console.log('[Facebook Send Message] Direct navigation failed, searching for Marketplace link...');
      // Try finding Marketplace link in different ways
      const marketplaceLink = page.getByRole('link', { name: /marketplace/i }).first();
      if (await marketplaceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await marketplaceLink.click();
        await page.waitForTimeout(shortDelay());
        console.log('[Facebook Send Message] Found and clicked Marketplace link');
      } else {
        throw new Error('Could not find Marketplace link');
      }
    }
  }
  await safeWait(randomDelay());
  console.log('[Facebook Send Message] Current URL after Marketplace navigation:', page.url());
  await safeWait(randomDelay());

  // Handle login popup if we landed on login page at Marketplace and have creds
  if (facebookEmail && facebookPassword) {
    const onLogin = page.url().includes('/login') || page.url().includes('/checkpoint');
    const hasPopup = await page.locator('input[name="email"], input[type="email"]').first().isVisible({ timeout: 2000 }).catch(() => false);
    if (onLogin || hasPopup) {
      console.log('[Facebook Send Message] Login required at Marketplace, filling credentials...');
      try {
        await page.locator('input[name="email"]').first().fill(facebookEmail);
        await safeWait(shortDelay());
        await page.locator('input[name="pass"]').first().fill(facebookPassword);
        await safeWait(shortDelay());
        await page.locator('button[name="login"]').first().click();
        await page.waitForURL((url) => !url.pathname.includes('/login') && !url.pathname.includes('/checkpoint'), { timeout: 15000 }).catch(() => {});
        await safeWait(shortDelay());
        console.log('[Facebook Send Message] Login handled');
      } catch {
        console.log('[Facebook Send Message] Login popup handling skipped');
      }
    }
  }

  
  // Step 2: Get pending Facebook messages from Lead2Lease API
  console.log('[Facebook Send Message] Fetching pending Facebook messages from Lead2Lease...');
  let pendingMessages: any[] = [];
  try {
    const response = await fetch(`${appBaseURL}/api/facebook-messages/pending`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Secret-Token': secretToken,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      pendingMessages = data.messages || [];
      console.log(`[Facebook Send Message] Found ${pendingMessages.length} pending Facebook messages to send`);
    } else {
      console.error(`[Facebook Send Message] Failed to fetch pending messages: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[Facebook Send Message] Error response: ${errorText}`);
    }
  } catch (error: any) {
    console.error(`[Facebook Send Message] Error fetching pending messages: ${error.message}`);
  }
  
  if (pendingMessages.length === 0) {
    console.log('[Facebook Send Message] No pending messages to send. Exiting.');
    return;
  }
  
  // Step 3: Send each pending message
  for (let i = 0; i < pendingMessages.length; i++) {
    const messageData = pendingMessages[i];
    const { conversationUrl, message, leadId, conversationId } = messageData;
    
    if (!conversationUrl || !message) {
      console.warn(`[Facebook Send Message] Skipping message - missing conversationUrl or message:`, messageData);
      continue;
    }
    
    console.log(`[Facebook Send Message] Processing message for lead ${leadId} (${i + 1}/${pendingMessages.length}):`, {
      conversationUrl,
      messagePreview: message.substring(0, 50) + '...',
    });
    
    try {
      // Check if page is still open before navigation
      if (page.isClosed()) {
        console.error(`[Facebook Send Message] ❌ Page is closed, cannot navigate to conversation`);
        continue;
      }
      
      // Navigate to the conversation URL
      console.log(`[Facebook Send Message] Navigating to conversation: ${conversationUrl}`);
      await page.goto(conversationUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Check if page closed during navigation
      if (page.isClosed()) {
        console.error(`[Facebook Send Message] ❌ Page closed during navigation`);
        continue;
      }
      
      // Handle restore popup only on the first conversation when navigating to /messages URL (same as polling script)
      if (i === 0 && conversationUrl.includes('/messages')) {
        console.log('[Facebook Send Message] Handling restore popup (first conversation only)...');
        try {
          await page.getByRole('button', { name: 'Close' }).nth(1).click();
          await page.getByRole('button', { name: 'Don\'t restore messages' }).click();
          console.log('[Facebook Send Message] ✅ Handled restore popup');
        } catch (error) {
          console.log('[Facebook Send Message] Restore popup not found or already dismissed, continuing...');
        }
      }
      
      await page.waitForTimeout(randomDelay());
      
      // Wait for the conversation to load
      console.log('[Facebook Send Message] Waiting for conversation to load...');
      await page.waitForTimeout(randomDelay());
      
      // Check if page is still open
      if (page.isClosed()) {
        console.error(`[Facebook Send Message] ❌ Page closed while waiting for conversation to load`);
        continue;
      }
      
      // Try multiple selectors for the message input (Facebook Messenger has different layouts)
      console.log('[Facebook Send Message] Looking for message input...');
      let messageInput: any = null;
      const inputSelectors = [
        'div[contenteditable="true"][role="textbox"][aria-label*="Message"]',
        'div[contenteditable="true"][role="textbox"][data-testid*="message"]',
        'div[contenteditable="true"][role="textbox"]',
        'textarea[aria-label*="Message"]',
        'textarea[placeholder*="Message"]',
        '[role="textbox"][aria-label*="Message"]',
      ];
      
      for (const selector of inputSelectors) {
        try {
          if (page.isClosed()) {
            throw new Error('Page closed');
          }
          await page.waitForSelector(selector, { timeout: 5000 });
          const locator = page.locator(selector).first();
          if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
            messageInput = locator;
            console.log(`[Facebook Send Message] Found message input with selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
          continue;
        }
      }
      
      if (!messageInput) {
        throw new Error('Could not find message input field');
      }
      
      // Check if page is still open before interacting
      if (page.isClosed()) {
        console.error(`[Facebook Send Message] ❌ Page closed before sending message`);
        continue;
      }
      
      // Click on the message area to focus (try paragraph first, then the input directly)
      console.log('[Facebook Send Message] Clicking message area to focus...');
      try {
        await page.getByRole('paragraph').click({ timeout: 2000 });
        await page.waitForTimeout(shortDelay());
      } catch (e) {
        // If paragraph click fails, click the input directly
        await messageInput.click();
        await page.waitForTimeout(shortDelay());
      }
      
      // Fill the message
      console.log(`[Facebook Send Message] Filling message: ${message.substring(0, 50)}...`);
      await messageInput.fill(message);
      await page.waitForTimeout(shortDelay());
      
      // Send the message - try multiple button selectors
      console.log('[Facebook Send Message] Looking for send button...');
      const sendButtonSelectors = [
        'button[aria-label*="Press enter to send"]',
        'button[aria-label*="Send"]',
        'button[type="submit"]',
        'div[role="button"][aria-label*="Send"]',
      ];
      
      let sendButton: any = null;
      for (const selector of sendButtonSelectors) {
        try {
          const locator = page.locator(selector).first();
          if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
            sendButton = locator;
            console.log(`[Facebook Send Message] Found send button with selector: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!sendButton) {
        // Fallback: try pressing Enter
        console.log('[Facebook Send Message] Send button not found, trying Enter key...');
        await messageInput.press('Enter');
      } else {
        await sendButton.click();
      }
      
      await page.waitForTimeout(randomDelay());
      
      // Mark message as sent in Lead2Lease
      console.log(`[Facebook Send Message] Marking message as sent in Lead2Lease...`);
      try {
        const markSentResponse = await fetch(`${appBaseURL}/api/facebook-messages/mark-sent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Secret-Token': secretToken,
          },
          body: JSON.stringify({
            conversationId,
            leadId,
          }),
        });
        
        if (markSentResponse.ok) {
          console.log(`[Facebook Send Message] ✅ Message marked as sent in Lead2Lease`);
        } else {
          console.warn(`[Facebook Send Message] ⚠️  Failed to mark message as sent: ${markSentResponse.status}`);
        }
      } catch (error: any) {
        console.error(`[Facebook Send Message] Error marking message as sent: ${error.message}`);
      }
      
      console.log(`[Facebook Send Message] ✅ Successfully sent message for lead ${leadId}`);
      
      // Wait before processing next message
      await page.waitForTimeout(randomDelay());
    } catch (error: any) {
      console.error(`[Facebook Send Message] ❌ Error sending message for lead ${leadId}:`, error.message);
      // Continue with next message
    }
  }
  
  console.log('[Facebook Send Message] ✅ Finished processing all pending messages');
});
