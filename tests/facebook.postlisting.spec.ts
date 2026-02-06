import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Helper function to generate random delay between 2-3 seconds
const randomDelay = () => Math.floor(Math.random() * 1000) + 2000;

// Helper function to download image from base64 or URL and save to temp file
async function downloadImageToFile(page: any, imageUrl: string, filePath: string): Promise<void> {
  // Check if it's a base64 data URL
  if (imageUrl.startsWith('data:image')) {
    // Extract base64 data
    const base64Data = imageUrl.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);
  } else {
    // It's a regular URL, download it
    const response = await page.request.get(imageUrl);
    const buffer = await response.body();
    fs.writeFileSync(filePath, buffer);
  }
}

// Interface for listing details
interface ListingDetails {
  unitImages: string[];
  price: string;
  bedrooms: number;
  bathrooms: string;
  squareFeet: number | null;
  description: string;
  address: string;
  city: string;
  state: string;
  availableDate: string | null;
  laundryType?: string | null; // 'In-unit laundry', 'Laundry in building', 'Laundry available', 'None'
  parkingType?: string | null; // 'Garage parking', 'Street parking', 'Off-street parking', 'Parking available', 'None'
  airConditioningType?: string | null; // 'Central AC', 'AC Available', 'None'
  heatingType?: string | null; // 'Central Heat', 'Gas Heat', 'Electric Heat', 'Radiator Heat', 'Heating Available', 'None'
  catFriendly?: boolean; // Whether the unit allows cats
  dogFriendly?: boolean; // Whether the unit allows dogs
}

test('test', async ({ page }) => {
  // Increase timeout for Facebook operations (login, navigation, posting can be slow)
  test.setTimeout(120000); // 2 minutes
  // Use server port (5000) by default, not Vite dev server (5173)
  // The API is on the backend server, not the frontend dev server
  let appBaseURL = process.env.PLAYWRIGHT_BASE_URL;
  if (!appBaseURL) {
    // Default to port 5000 (backend server port)
    appBaseURL = 'http://localhost:5000';
  }
  const listingId = process.env.LISTING_ID;
  const orgId = process.env.ORG_ID;
  const secretToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
  
  let listingDetails: ListingDetails | null = null;
  
  // Step 1: Fetch listing details via direct API call (no UI navigation needed)
  if (listingId && orgId) {
    try {
      console.log(`[Facebook Listing] Fetching listing data from API at ${appBaseURL} for listing ${listingId}...`);
      
      // Use direct HTTP fetch (Node.js) to internal endpoint with secret token
      const apiUrl = `${appBaseURL}/api/listings/${listingId}/for-facebook?orgId=${orgId}&secretToken=${encodeURIComponent(secretToken)}`;
      console.log(`[Facebook Listing] API URL: ${apiUrl.replace(secretToken, '***')}`);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to fetch listing: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const listingData = await response.json();
      console.log(`[Facebook Listing] ✅ Successfully fetched listing data from API`);
      
      if (listingData && listingData.unit) {
        // Extract unit images
        const unitImages: string[] = [];
        if (listingData.unit.coverPhoto) {
          unitImages.push(listingData.unit.coverPhoto);
        }
        if (listingData.unit.photos && Array.isArray(listingData.unit.photos)) {
          unitImages.push(...listingData.unit.photos);
        }
        
        // Extract listing details
        listingDetails = {
          unitImages: unitImages.slice(0, 10), // Limit to 10 images
          price: listingData.monthlyRent || listingData.unit.monthlyRent || '$0',
          bedrooms: listingData.unit.bedrooms || 0,
          bathrooms: listingData.unit.bathrooms || '0',
          squareFeet: listingData.unit.squareFeet || null,
          description: listingData.description || listingData.unit.description || listingData.unit.customEventDescription || 'Great apartment for rent, reach out for more details!',
          address: listingData.property?.address || listingData.unit.address || '',
          city: listingData.property?.city || '',
          state: listingData.property?.state || '',
          availableDate: listingData.availableDate || null,
          laundryType: listingData.unit.laundryType || null,
          parkingType: listingData.unit.parkingType || null,
          airConditioningType: listingData.unit.airConditioningType || null,
          heatingType: listingData.unit.heatingType || null,
          catFriendly: listingData.unit.catFriendly || false,
          dogFriendly: listingData.unit.dogFriendly || false,
        };
        
        // Debug: Log the extracted amenity values
        console.log(`[Facebook Listing] 📋 Extracted amenity values from API:`);
        console.log(`[Facebook Listing]   - laundryType: "${listingDetails.laundryType}"`);
        console.log(`[Facebook Listing]   - parkingType: "${listingDetails.parkingType}"`);
        console.log(`[Facebook Listing]   - airConditioningType: "${listingDetails.airConditioningType}"`);
        console.log(`[Facebook Listing]   - heatingType: "${listingDetails.heatingType}"`);
        console.log(`[Facebook Listing]   - Full unit object keys:`, Object.keys(listingData.unit || {}));
        
        // Debug: Log the full unit object to see what fields are available
        console.log('[Facebook Listing] 📦 Full unit object from API:', JSON.stringify(listingData.unit, null, 2));
        
        console.log('[Facebook Listing] Extracted listing details:', {
          imagesCount: listingDetails.unitImages.length,
          price: listingDetails.price,
          bedrooms: listingDetails.bedrooms,
          bathrooms: listingDetails.bathrooms,
          squareFeet: listingDetails.squareFeet,
        });
      }
    } catch (error: any) {
      console.error('[Facebook Listing] Error fetching listing details from API:', error.message || error);
      // Continue with fallback data
    }
  }
  
  // Fallback: Use default values if listing fetch failed
  if (!listingDetails) {
    console.log('[Facebook Listing] Using fallback listing details');
    listingDetails = {
      unitImages: [],
      price: '$1400',
      bedrooms: 1,
      bathrooms: '2',
      squareFeet: 700,
      description: 'Great apartment for rent, reach out for more details!',
      address: '1430 Minnehaha Ave',
      city: 'Minneapolis',
      state: 'MN',
      availableDate: null,
    };
  }
  
  // Create temp directory for images
  const tempDir = path.join(process.cwd(), 'temp_images');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  // Download unit images to temp files
  const imageFilePaths: string[] = [];
  if (listingDetails && listingDetails.unitImages && listingDetails.unitImages.length > 0) {
    for (let i = 0; i < listingDetails.unitImages.length; i++) {
      const imageUrl = listingDetails.unitImages[i];
      const filePath = path.join(tempDir, `unit_image_${i}.${imageUrl.startsWith('data:image/png') ? 'png' : 'jpg'}`);
      try {
        await downloadImageToFile(page, imageUrl, filePath);
        imageFilePaths.push(filePath);
      } catch (error) {
        console.error(`Error downloading image ${i}:`, error);
      }
    }
  }
  
  // Fallback to default image if no unit images found
  if (imageFilePaths.length === 0) {
    const defaultImagePath = path.join(process.cwd(), 'attached_assets', '2458e809-2baf-4e6a-bc24-a8d00394c58f_1762709030771.png');
    if (fs.existsSync(defaultImagePath)) {
      imageFilePaths.push(defaultImagePath);
    }
  }
  
  // Session-first: PLAYWRIGHT_STORAGE_STATE_PATH when spawned by server. Fallback: env creds for local dev.
  const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE_PATH;
  const facebookEmail = process.env.FACEBOOK_EMAIL || '';
  const facebookPassword = process.env.FACEBOOK_PASSWORD || '';

  if (!storageStatePath && (!facebookEmail || !facebookPassword)) {
    throw new Error('No auth: set PLAYWRIGHT_STORAGE_STATE_PATH (spawned by server) or FACEBOOK_EMAIL/FACEBOOK_PASSWORD (local dev)');
  }

  console.log(`[Facebook Listing] Auth: ${storageStatePath ? 'storageState' : 'env credentials'}`);
  console.log('[Facebook Listing] Navigating to Facebook...');
  await page.goto('https://www.facebook.com/');
  await page.waitForTimeout(randomDelay());

  if (!storageStatePath) {
    console.log('[Facebook Listing] Filling login form (env credentials)...');
    await page.getByTestId('royal-email').fill(facebookEmail);
    await page.waitForTimeout(randomDelay());
    await page.getByTestId('royal-pass').fill(facebookPassword);
    await page.waitForTimeout(randomDelay());
    const loginUrlBefore = page.url();
    await page.getByTestId('royal-login-button').click();
    try {
      await Promise.race([
        page.waitForURL((url) => !url.pathname.includes('/login') && url.hostname.includes('facebook.com'), { timeout: 30000 }),
        page.waitForSelector('div[role="main"], [aria-label="Shortcuts"], [aria-label="Navigation"]', { timeout: 30000 }),
        page.waitForLoadState('networkidle', { timeout: 30000 }),
      ]);
    } catch {
      const currentUrl = page.url();
      if (currentUrl.includes('/login') || currentUrl === loginUrlBefore) {
        throw new Error(`Login timeout - still on login page. URL: ${currentUrl}`);
      }
    }
    await page.waitForTimeout(randomDelay());
  } else {
    console.log('[Facebook Listing] Using storageState auth - skipping login');
  }
  
  // Handle any popups/dialogs that appear after login (try multiple common popup patterns)
  console.log('[Facebook Listing] Checking for post-login popups/dialogs...');
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
        await page.waitForTimeout(randomDelay());
        console.log(`[Facebook Listing] Closed popup using selector: ${selector}`);
        break; // Only close one popup
      }
    } catch (error) {
      // Continue trying other selectors
    }
  }
  
  // Wait a bit more for any remaining dialogs to settle
  await page.waitForTimeout(randomDelay());
  
  // Navigate to Marketplace - try multiple ways to find it
  console.log('[Facebook Listing] Navigating to Marketplace...');
  try {
    // Try the shortcuts menu first
    await page.getByLabel('Shortcuts').getByRole('link', { name: 'Marketplace' }).click({ timeout: 5000 });
    console.log('[Facebook Listing] Clicked Marketplace from shortcuts menu');
  } catch (error) {
    console.log('[Facebook Listing] Shortcuts menu not found, trying direct navigation...');
    // Fallback: Try direct navigation or search
    try {
      await page.goto('https://www.facebook.com/marketplace');
      console.log('[Facebook Listing] Navigated directly to Marketplace');
    } catch (navError) {
      console.log('[Facebook Listing] Direct navigation failed, searching for Marketplace link...');
      // Try finding Marketplace link in different ways
      const marketplaceLink = page.getByRole('link', { name: /marketplace/i }).first();
      if (await marketplaceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await marketplaceLink.click();
        console.log('[Facebook Listing] Found and clicked Marketplace link');
      } else {
        throw new Error('Could not find Marketplace link');
      }
    }
  }
  await page.waitForTimeout(randomDelay());
  console.log('[Facebook Listing] Current URL after Marketplace navigation:', page.url());
  await page.waitForTimeout(randomDelay());
  
  // Handle login popup if it appears when navigating to Marketplace
  console.log('[Facebook Listing] Checking for login popup...');
  try {
    const emailField = page.getByRole('textbox', { name: 'Email or phone number' });
    if (await emailField.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[Facebook Listing] Login popup detected, filling credentials...');
      await emailField.fill('tamerayoubbusiness@gmail.com');
      await page.waitForTimeout(randomDelay());
      await page.locator('#login_popup_cta_form').getByRole('textbox', { name: 'Password' }).click();
      await page.waitForTimeout(randomDelay());
      await page.locator('#login_popup_cta_form').getByRole('textbox', { name: 'Password' }).fill('Lead2LeaseWorld!');
      await page.waitForTimeout(randomDelay());
      await page.getByRole('button', { name: 'Log in to Facebook' }).click();
      await page.waitForTimeout(randomDelay());
      console.log('[Facebook Listing] Login popup handled successfully');
    }
  } catch (error) {
    console.log('[Facebook Listing] No login popup found or already logged in, continuing...');
  }
  
  console.log('[Facebook Listing] Clicking "Selling" tab...');
  await page.getByRole('link', { name: 'Selling' }).click();
  await page.waitForTimeout(randomDelay());
  console.log('[Facebook Listing] Clicking "Create new listing"...');
  await page.getByRole('navigation', { name: 'Marketplace sidebar' }).getByLabel('Create new listing').click();
  await page.waitForTimeout(randomDelay());
  console.log('[Facebook Listing] Selecting "Home for sale or rent"...');
  await page.getByRole('button', { name: 'Home for sale or rent List a' }).click();
  await page.waitForTimeout(randomDelay());
  
  // Find the hidden file input element directly (don't click the button to avoid file picker dialog)
  // Facebook Marketplace uses a hidden file input that the button triggers
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForTimeout(randomDelay());
  
  // Upload unit images if available, otherwise use default
  console.log(`[Facebook Listing] Uploading ${imageFilePaths.length} image(s)...`);
  if (imageFilePaths.length > 0) {
    await fileInput.setInputFiles(imageFilePaths);
    console.log('[Facebook Listing] Images uploaded successfully');
  } else {
    console.log('[Facebook Listing] No images found, using default image');
    await fileInput.setInputFiles('../attached_assets/2458e809-2baf-4e6a-bc24-a8d00394c58f_1762709030771.png');
  }
  await page.waitForTimeout(randomDelay());
  
  // Wait for the listing form to be ready after image upload
  console.log('[Facebook Listing] Waiting for listing form to load after image upload...');
  try {
    // Wait for form elements to appear
    await page.waitForSelector('input[type="text"], textbox, button, [role="button"]', { timeout: 10000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      console.log('[Facebook Listing] Network idle timeout, continuing...');
    });
  } catch (error) {
    console.log('[Facebook Listing] Form elements not found immediately, continuing anyway...');
  }
  await page.waitForTimeout(randomDelay());
  
  // Select "Rent" option
  console.log('[Facebook Listing] Selecting "Rent" option...');
  await page.locator('.xjyslct.xjbqb8w.x13fuv20.x18b5jzi.x1q0q8m5.x1t7ytsu.x972fbf.x10w94by.x1qhh985.x14e42zd.x9f619.xzsf02u').first().click();
  await page.waitForTimeout(randomDelay());
  await page.getByRole('option', { name: 'Rent' }).click();
  console.log('[Facebook Listing] Selected "Rent" option');
  await page.waitForTimeout(randomDelay());
  
  // Select property type "Apartment"
  console.log('[Facebook Listing] Selecting property type "Apartment"...');
  // Wait a bit for the rent dropdown to close and property type dropdown to appear
  await page.waitForTimeout(randomDelay());

  try {
    // Method 1: Find the property type dropdown - it should be the SECOND dropdown with this structure
    // (first one is the "for rent or sale" dropdown we just used)
    const propertyTypeDropdown = page.locator('div.xjyslct:has(span.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft)').nth(1);
    await propertyTypeDropdown.waitFor({ state: 'visible', timeout: 10000 });
    await propertyTypeDropdown.click();
    console.log('[Facebook Listing] Opened property type dropdown');
  } catch (error) {
    try {
      // Method 2: Try finding by ID pattern (dynamic but might work)
      const propertyTypeDropdown = page.locator('div[id^="_r_"] > .xjyslct').first();
      await propertyTypeDropdown.waitFor({ state: 'visible', timeout: 5000 });
      await propertyTypeDropdown.click();
      console.log('[Facebook Listing] Opened property type dropdown using ID pattern');
    } catch (error2) {
      // Method 3: Find any div with xjyslct that has a span with x6ikm8r, but skip the first one
      const propertyTypeDropdown = page.locator('div.xjyslct:has(span.x6ikm8r)').nth(1);
      await propertyTypeDropdown.waitFor({ state: 'visible', timeout: 5000 });
      await propertyTypeDropdown.click();
      console.log('[Facebook Listing] Opened property type dropdown using flexible selector');
    }
  }
  await page.waitForTimeout(randomDelay());

  // Click the Apartment option - wait for it to appear in the dropdown
  try {
    // Wait for the dropdown menu to appear
    await page.waitForSelector('span:has-text("Apartment")', { state: 'visible', timeout: 5000 });
    // Method 1: Try using the specific span classes with "Apartment" text
    const apartmentOption = page.locator('span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xk50ysn.xzsf02u.x1yc453h:has-text("Apartment")');
    if (await apartmentOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await apartmentOption.click();
      console.log('[Facebook Listing] Selected "Apartment" using specific span classes');
    } else {
      throw new Error('Apartment option not found with specific classes');
    }
  } catch (error) {
    // Method 2: Fallback to simple text-based selector
    await page.getByText('Apartment', { exact: true }).click({ timeout: 5000 });
    console.log('[Facebook Listing] Selected "Apartment" using text selector');
  }
  console.log('[Facebook Listing] Selected "Apartment" property type');
  await page.waitForTimeout(randomDelay());
  // Use extracted listing details for form filling
  const details = listingDetails || {
    price: '$1400',
    bedrooms: 1,
    bathrooms: '2',
    squareFeet: 700,
    description: 'Great apartment for rent, reach out for more details!',
    address: '1430 Minnehaha Ave',
    city: 'Minneapolis',
    state: 'MN',
  };
  
  // Format price - remove $ if present, then add it back
  const priceValue = details.price.replace(/[^0-9]/g, '');
  const formattedPrice = priceValue ? `$${priceValue}` : '$1400';
  
  console.log('[Facebook Listing] Filling listing form...');
  console.log(`[Facebook Listing] Price: ${formattedPrice}, Bedrooms: ${details.bedrooms}, Bathrooms: ${details.bathrooms}`);
  
  await page.getByRole('textbox', { name: 'Number of bedrooms' }).click();
  await page.waitForTimeout(randomDelay());
  await page.getByRole('textbox', { name: 'Number of bedrooms' }).fill(String(details.bedrooms || 1));
  await page.waitForTimeout(randomDelay());
  await page.getByRole('textbox', { name: 'Number of bathrooms' }).click();
  await page.waitForTimeout(randomDelay());
  await page.getByRole('textbox', { name: 'Number of bathrooms' }).fill(String(details.bathrooms || '2'));
  await page.waitForTimeout(randomDelay());
  await page.getByRole('textbox', { name: 'Price per month' }).click();
  await page.waitForTimeout(randomDelay());
  // Facebook may require typing the price character by character
  await page.getByRole('textbox', { name: 'Price per month' }).fill(formattedPrice);
  await page.waitForTimeout(randomDelay());
  
  // Fill address using city and state from property database fields
  // Format: "[CITY], [STATE]"
  const cityState = details.city && details.state 
    ? `${details.city}, ${details.state}`
    : details.city || details.state || '';
  
  if (cityState) {
    console.log(`[Facebook Listing] Filling address with: ${cityState}`);
    const addressInput = page.getByLabel('', { exact: true }).nth(2);
    await addressInput.click();
    await page.waitForTimeout(randomDelay());
    await addressInput.fill(cityState);
    
    // Wait for the dropdown suggestions to appear after typing
    console.log('[Facebook Listing] Waiting for address suggestions dropdown...');
    await page.waitForTimeout(2000); // Wait for dropdown to render
    
    let suggestionsSelected = false;
    const stateCode = details.state || '';
    const cityName = details.city || '';
    
    // Strategy 1: Use the specific span classes that Facebook uses for dropdown items
    // These are the spans with dir="auto" and specific classes
    try {
      const suggestionSpans = page.locator('span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xk50ysn.xzsf02u.x1yc453h[dir="auto"]');
      
      // Wait for at least one suggestion to appear
      await suggestionSpans.first().waitFor({ state: 'visible', timeout: 8000 });
      await page.waitForTimeout(500); // Small delay to ensure all suggestions are rendered
      
      const count = await suggestionSpans.count();
      console.log(`[Facebook Listing] Found ${count} address suggestions using span classes`);
      
      if (count > 0) {
        // Get the last suggestion
        const lastSuggestion = suggestionSpans.last();
        
        // Get the text to confirm which suggestion we're selecting
        const suggestionText = await lastSuggestion.textContent().catch(() => '');
        console.log(`[Facebook Listing] Selecting the last suggestion (index ${count - 1}): "${suggestionText}"`);
        
        // Explicitly scroll it into view and then click
        await lastSuggestion.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000); // Wait longer for scroll to complete and viewport to update
        
        // Try clicking with longer timeout and force option
        try {
          await lastSuggestion.click({ timeout: 5000 });
          await page.waitForTimeout(randomDelay());
          suggestionsSelected = true;
          console.log('[Facebook Listing] ✅ Selected last address suggestion from dropdown');
        } catch (error) {
          // If normal click fails, use force click (element outside viewport)
          console.log('[Facebook Listing] Normal click failed, using force click to handle viewport issue...');
          await lastSuggestion.click({ force: true, timeout: 5000 });
          await page.waitForTimeout(randomDelay());
          suggestionsSelected = true;
          console.log('[Facebook Listing] ✅ Selected last address suggestion using force click');
        }
      }
    } catch (error) {
      console.log('[Facebook Listing] Strategy 1 failed, trying alternative selectors...');
    }
    
    // Strategy 2: Use getByText with filtering for suggestions that match the pattern
    if (!suggestionsSelected) {
      try {
        await page.waitForTimeout(1000);
        
        // Get all text elements containing city or state
        const cityTextElements = cityName ? page.getByText(new RegExp(cityName, 'i')) : null;
        const stateTextElements = stateCode ? page.getByText(new RegExp(stateCode, 'i')) : null;
        
        // Use city if available, otherwise state
        const textElements = cityTextElements || stateTextElements;
        if (!textElements) {
          throw new Error('No text elements locator available');
        }
        
        const count = await textElements.count().catch(() => 0);
        console.log(`[Facebook Listing] Found ${count} text elements containing "${cityName || stateCode}"`);
        
        if (count > 0) {
          // Filter to find suggestions (they typically contain address-like patterns)
          for (let i = count - 1; i >= 0; i--) {
            try {
              const element = textElements.nth(i);
              const isVisible = await element.isVisible().catch(() => false);
              
              if (isVisible) {
                const text = await element.textContent().catch(() => '') || '';
                // Check if it looks like an address suggestion (contains state, and possibly street/city pattern)
                if (text && (text.includes(stateCode) || (stateCode && text.match(new RegExp(`\\b${stateCode}\\b`, 'i'))))) {
                  // It's likely a suggestion if it has address-like format
                  if (text.includes(',') || text.includes('·') || text.includes('people') || text.includes('United States')) {
                    console.log(`[Facebook Listing] Selecting suggestion ${i}: "${text.trim()}"`);
                    // Scroll into view first with longer wait
                    await element.scrollIntoViewIfNeeded();
                    await page.waitForTimeout(1000); // Wait longer for scroll to complete
                    // Try normal click, then force if needed (force handles viewport issues)
                    try {
                      await element.click({ timeout: 5000 });
                    } catch (clickError) {
                      // Force click will work even if element is outside viewport
                      console.log(`[Facebook Listing] Normal click failed for "${text.trim()}", using force click...`);
                      await element.click({ force: true, timeout: 5000 });
                    }
                    await page.waitForTimeout(randomDelay());
                    suggestionsSelected = true;
                    console.log('[Facebook Listing] ✅ Selected address suggestion using text matching');
                    break;
                  }
                }
              }
            } catch (error) {
              continue;
            }
          }
        }
      } catch (error) {
        console.log('[Facebook Listing] Strategy 2 failed:', error);
      }
    }
    
    // Strategy 3: Fallback - use role="option"
    if (!suggestionsSelected) {
      try {
        await page.waitForSelector('[role="option"]', { state: 'visible', timeout: 5000 });
        await page.waitForTimeout(500);
        const suggestions = page.locator('[role="option"]');
        const count = await suggestions.count();
        
        if (count > 0) {
          console.log(`[Facebook Listing] Found ${count} address suggestions using role="option"`);
          const lastSuggestion = suggestions.last();
          await lastSuggestion.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000); // Wait longer for scroll
          try {
            await lastSuggestion.click({ timeout: 5000 });
          } catch (error) {
            console.log('[Facebook Listing] Normal click failed, using force click...');
            await lastSuggestion.click({ force: true, timeout: 5000 });
          }
          await page.waitForTimeout(randomDelay());
          suggestionsSelected = true;
          console.log('[Facebook Listing] ✅ Selected last address suggestion using role="option"');
        }
      } catch (error) {
        console.log('[Facebook Listing] Strategy 3 failed');
      }
    }
    
    if (!suggestionsSelected) {
      console.log('[Facebook Listing] ⚠️ Could not find or select dropdown suggestions, continuing with typed address');
    }
  } else {
    // Fallback to default address behavior if city/state not available
    console.log('[Facebook Listing] City/state not available, using fallback');
    const addressInput = page.getByLabel('', { exact: true }).nth(2);
    await addressInput.click();
    await page.waitForTimeout(randomDelay());
    await addressInput.fill('Minneapolis, MN');
    await page.waitForTimeout(2000);
    
    try {
      const suggestionSpans = page.locator('span.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x1xmvt09.x1lliihq.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.xudqn12.x3x7a5m.x6prxxf.xvq8zen.xk50ysn.xzsf02u.x1yc453h[dir="auto"]');
      await suggestionSpans.first().waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(500);
      const count = await suggestionSpans.count().catch(() => 0);
      if (count > 0) {
        console.log(`[Facebook Listing] Found ${count} fallback suggestions, selecting the last one`);
        const lastSuggestion = suggestionSpans.last();
        await lastSuggestion.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        try {
          await lastSuggestion.click({ timeout: 3000 });
        } catch (error) {
          await lastSuggestion.click({ force: true, timeout: 3000 });
        }
        await page.waitForTimeout(randomDelay());
        console.log('[Facebook Listing] ✅ Selected last fallback suggestion');
      }
    } catch (error) {
      console.log('[Facebook Listing] Default address suggestion not found');
    }
  }
  await page.getByRole('textbox', { name: 'Rental description' }).click();
  await page.waitForTimeout(randomDelay());
  await page.getByRole('textbox', { name: 'Rental description' }).fill(details.description || 'Great apartment for rent, reach out for more details!');
  await page.waitForTimeout(randomDelay());
  if (details.squareFeet) {
    await page.getByRole('textbox', { name: 'Property square feet' }).click();
    await page.waitForTimeout(randomDelay());
    await page.getByRole('textbox', { name: 'Property square feet' }).fill(String(details.squareFeet));
    await page.waitForTimeout(randomDelay());
  }
  await page.waitForTimeout(randomDelay());
  await page.getByRole('combobox', { name: 'Choose Date Choose Date' }).click();
  await page.waitForTimeout(randomDelay());
  // Get today's day number (1-31)
  const today = new Date();
  const todayDay = today.getDate().toString();
  console.log(`[Facebook Listing] Selecting today's date: ${todayDay}`);
  await page.getByText(todayDay, { exact: true }).click();
  await page.waitForTimeout(randomDelay());
  
  // Helper function to select dropdown option
  const selectDropdownOption = async (optionText: string, dropdownIndex: number = 0) => {
    try {
      // Find all dropdown openers (div with xjyslct containing span with x6ikm8r pattern)
      const dropdowns = page.locator('div.xjyslct:has(span.x6ikm8r)');
      await page.waitForTimeout(500);
      
      const count = await dropdowns.count();
      console.log(`[Facebook Listing] Found ${count} dropdowns, selecting dropdown at index ${dropdownIndex}`);
      
      if (count > dropdownIndex) {
        const dropdown = dropdowns.nth(dropdownIndex);
        await dropdown.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await dropdown.click({ timeout: 5000 });
        await page.waitForTimeout(randomDelay());
        
        // Wait for dropdown menu to appear and select the option
        console.log(`[Facebook Listing] Looking for option: "${optionText}"`);
        await page.waitForTimeout(500);
        
        // Try multiple ways to find and click the option
        try {
          // Method 1: Try getByText
          const option = page.getByText(optionText, { exact: false });
          await option.waitFor({ state: 'visible', timeout: 5000 });
          await option.first().click({ timeout: 3000 });
          console.log(`[Facebook Listing] ✅ Selected "${optionText}" using getByText`);
        } catch (error) {
          // Method 2: Try getByRole option
          try {
            await page.getByRole('option', { name: optionText }).click({ timeout: 3000 });
            console.log(`[Facebook Listing] ✅ Selected "${optionText}" using role="option"`);
          } catch (error2) {
            // Method 3: Try locator with text filter
            const textOption = page.locator(`text=/${optionText}/i`).first();
            await textOption.click({ timeout: 3000 });
            console.log(`[Facebook Listing] ✅ Selected "${optionText}" using text locator`);
          }
        }
        await page.waitForTimeout(randomDelay());
      } else {
        console.log(`[Facebook Listing] ⚠️ Dropdown at index ${dropdownIndex} not found`);
      }
    } catch (error) {
      console.log(`[Facebook Listing] ⚠️ Error selecting "${optionText}":`, error);
    }
  };
  
  // Helper function to select amenity option - works like property type selection
  // Click dropdown to open, then select option from dropdown
  const selectAmenityOption = async (dropdownIndex: number, optionText: string, labelText?: string) => {
    try {
      console.log(`[Facebook Listing] 🎯 Selecting "${optionText}" from dropdown at index ${dropdownIndex}...`);
      
      // Find all dropdown openers (same pattern as property type)
      // First dropdown (index 0) = "Rent", Second (index 1) = "Property Type"
      // After that: Laundry (index 2), Parking (index 3), AC (index 4), Heating (index 5)
      const dropdowns = page.locator('div.xjyslct:has(span.x6ikm8r)');
      await page.waitForTimeout(500);
      
      const count = await dropdowns.count();
      console.log(`[Facebook Listing] 📊 Found ${count} dropdowns on page, using index ${dropdownIndex}`);
      
      if (count > dropdownIndex) {
        // Open the dropdown (same pattern as property type)
        const dropdown = dropdowns.nth(dropdownIndex);
        await dropdown.waitFor({ state: 'visible', timeout: 5000 });
        await dropdown.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await dropdown.click();
        console.log(`[Facebook Listing] ✅ Opened dropdown at index ${dropdownIndex}`);
        await page.waitForTimeout(randomDelay());
        
        // Wait for dropdown menu to appear
        await page.waitForTimeout(1000);
        
        // Select the option - try multiple strategies like property type selection
        let optionSelected = false;
        
        // Strategy 1: Try getByRole('option') - codegen uses this first
        if (!optionSelected) {
          try {
            const option = page.getByRole('option', { name: optionText });
            await option.waitFor({ state: 'visible', timeout: 5000 });
            await option.scrollIntoViewIfNeeded();
            await option.click({ timeout: 5000 });
            optionSelected = true;
            console.log(`[Facebook Listing] ✅ Selected "${optionText}" using getByRole('option')`);
          } catch (error: any) {
            console.log(`[Facebook Listing] getByRole('option') failed: ${error.message}`);
          }
        }
        
        // Strategy 2: Try getByLabel + getByText (codegen uses this for labeled dropdowns)
        if (!optionSelected && labelText) {
          try {
            const labeledOption = page.getByLabel(labelText).getByText(optionText);
            await labeledOption.waitFor({ state: 'visible', timeout: 5000 });
            await labeledOption.scrollIntoViewIfNeeded();
            await labeledOption.click({ timeout: 5000 });
            optionSelected = true;
            console.log(`[Facebook Listing] ✅ Selected "${optionText}" using getByLabel('${labelText}').getByText()`);
          } catch (error: any) {
            console.log(`[Facebook Listing] getByLabel + getByText failed: ${error.message}`);
          }
        }
        
        // Strategy 3: Try getByText with exact match
        if (!optionSelected) {
          try {
            const textOption = page.getByText(optionText, { exact: true });
            await textOption.waitFor({ state: 'visible', timeout: 5000 });
            await textOption.scrollIntoViewIfNeeded();
            await textOption.click({ timeout: 5000 });
            optionSelected = true;
            console.log(`[Facebook Listing] ✅ Selected "${optionText}" using getByText(exact: true)`);
          } catch (error: any) {
            console.log(`[Facebook Listing] getByText(exact: true) failed: ${error.message}`);
          }
        }
        
        // Strategy 4: Try getByText without exact (case insensitive)
        if (!optionSelected) {
          try {
            const textOption = page.getByText(optionText, { exact: false });
            await textOption.first().waitFor({ state: 'visible', timeout: 5000 });
            await textOption.first().scrollIntoViewIfNeeded();
            await textOption.first().click({ timeout: 5000 });
            optionSelected = true;
            console.log(`[Facebook Listing] ✅ Selected "${optionText}" using getByText(exact: false)`);
          } catch (error: any) {
            console.log(`[Facebook Listing] getByText(exact: false) failed: ${error.message}`);
          }
        }
        
        // Strategy 5: Try filter pattern (codegen uses this: div.filter({ hasText: /^Text$/ }).nth(1))
        if (!optionSelected) {
          try {
            const escapedText = optionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const filteredOption = page.locator('div').filter({ hasText: new RegExp(`^${escapedText}$`, 'i') }).nth(1);
            await filteredOption.waitFor({ state: 'visible', timeout: 5000 });
            await filteredOption.scrollIntoViewIfNeeded();
            await filteredOption.click({ timeout: 5000 });
            optionSelected = true;
            console.log(`[Facebook Listing] ✅ Selected "${optionText}" using filter pattern`);
          } catch (error: any) {
            console.log(`[Facebook Listing] Filter pattern failed: ${error.message}`);
          }
        }
        
        if (!optionSelected) {
          console.error(`[Facebook Listing] ❌ Failed to select "${optionText}" - all strategies failed`);
          // Close dropdown if still open
          await page.keyboard.press('Escape').catch(() => {});
          await page.waitForTimeout(500);
        } else {
          await page.waitForTimeout(randomDelay());
        }
      } else {
        console.error(`[Facebook Listing] ❌ Dropdown at index ${dropdownIndex} not found (only ${count} dropdowns available)`);
      }
    } catch (error: any) {
      console.error(`[Facebook Listing] ❌ Error selecting "${optionText}":`, error.message);
    }
  };
  
  // Debug: Count all dropdowns available and log details
  const allDropdowns = page.locator('div.xjyslct:has(span.x6ikm8r)');
  const dropdownCount = await allDropdowns.count();
  console.log(`[Facebook Listing] 📊 Total dropdowns found on page: ${dropdownCount}`);
  
  // Debug: Log all details values
  console.log(`[Facebook Listing] 🔍 Checking details object for amenity values:`);
  console.log(`[Facebook Listing]   - details.laundryType: "${details.laundryType}" (type: ${typeof details.laundryType})`);
  console.log(`[Facebook Listing]   - details.parkingType: "${details.parkingType}" (type: ${typeof details.parkingType})`);
  console.log(`[Facebook Listing]   - details.airConditioningType: "${details.airConditioningType}" (type: ${typeof details.airConditioningType})`);
  console.log(`[Facebook Listing]   - details.heatingType: "${details.heatingType}" (type: ${typeof details.heatingType})`);
  
  // Select laundry type from unit data (first dropdown after date and property type)
  const laundryOption = details.laundryType && details.laundryType !== 'None' && details.laundryType !== 'null' && details.laundryType !== ''
    ? details.laundryType 
    : null; // Skip if None or not specified
  if (laundryOption) {
    console.log(`[Facebook Listing] 🧺 Selecting laundry option: "${laundryOption}" (dropdown index 2)...`);
    await selectAmenityOption(2, laundryOption); // Index 2 (after date and property type dropdowns)
  } else {
    console.log(`[Facebook Listing] ⏭️ Skipping laundry selection - value: "${details.laundryType}"`);
  }
  
  // Select parking type from unit data (second dropdown)
  const parkingOption = details.parkingType && details.parkingType !== 'None' && details.parkingType !== 'null' && details.parkingType !== ''
    ? details.parkingType
    : null; // Skip if None or not specified
  if (parkingOption) {
    console.log(`[Facebook Listing] 🚗 Selecting parking option: "${parkingOption}" (dropdown index 3)...`);
    await selectAmenityOption(3, parkingOption, 'Parking type');
  } else {
    console.log(`[Facebook Listing] ⏭️ Skipping parking selection - value: "${details.parkingType}"`);
  }
  
  // Select air conditioning type from unit data (third dropdown)
  const acOption = details.airConditioningType && details.airConditioningType !== 'None' && details.airConditioningType !== 'null' && details.airConditioningType !== ''
    ? details.airConditioningType
    : null; // Skip if None or not specified
  if (acOption) {
    console.log(`[Facebook Listing] ❄️ Selecting AC option: "${acOption}" (dropdown index 4)...`);
    // Map to Facebook's exact text format
    const facebookAcOption = acOption === 'AC Available' ? 'AC available' : acOption;
    await selectAmenityOption(4, facebookAcOption, 'Air conditioning type');
  } else {
    console.log(`[Facebook Listing] ⏭️ Skipping AC selection - value: "${details.airConditioningType}"`);
  }
  
  // Set pet-friendly options based on unit data
  const catFriendly = details.catFriendly || false;
  const dogFriendly = details.dogFriendly || false;
  
  console.log(`[Facebook Listing] 🐱 Cat friendly: ${catFriendly}, 🐶 Dog friendly: ${dogFriendly}`);
  
  // Set Cat friendly switch
  try {
    const catSwitch = page.getByRole('switch', { name: 'Cat friendly' });
    const isCatChecked = await catSwitch.isChecked().catch(() => false);
    
    if (catFriendly && !isCatChecked) {
      console.log(`[Facebook Listing] 🐱 Enabling Cat friendly...`);
      await catSwitch.check();
      await page.waitForTimeout(randomDelay());
    } else if (!catFriendly && isCatChecked) {
      console.log(`[Facebook Listing] 🐱 Disabling Cat friendly...`);
      await catSwitch.uncheck();
      await page.waitForTimeout(randomDelay());
    } else {
      console.log(`[Facebook Listing] 🐱 Cat friendly already set to ${catFriendly}`);
    }
  } catch (error: any) {
    console.error(`[Facebook Listing] ❌ Error setting Cat friendly:`, error.message);
  }
  
  // Set Dog friendly switch
  try {
    const dogSwitch = page.getByRole('switch', { name: 'Dog friendly' });
    const isDogChecked = await dogSwitch.isChecked().catch(() => false);
    
    if (dogFriendly && !isDogChecked) {
      console.log(`[Facebook Listing] 🐶 Enabling Dog friendly...`);
      await dogSwitch.check();
      await page.waitForTimeout(randomDelay());
    } else if (!dogFriendly && isDogChecked) {
      console.log(`[Facebook Listing] 🐶 Disabling Dog friendly...`);
      await dogSwitch.uncheck();
      await page.waitForTimeout(randomDelay());
    } else {
      console.log(`[Facebook Listing] 🐶 Dog friendly already set to ${dogFriendly}`);
    }
  } catch (error: any) {
    console.error(`[Facebook Listing] ❌ Error setting Dog friendly:`, error.message);
  }
  
  // Select heating type from unit data (fourth dropdown)
  const heatingOption = details.heatingType && details.heatingType !== 'None' && details.heatingType !== 'null' && details.heatingType !== ''
    ? details.heatingType
    : null; // Skip if None or not specified
  if (heatingOption) {
    console.log(`[Facebook Listing] 🔥 Selecting heating option: "${heatingOption}" (dropdown index 5)...`);
    // Map heating options to Facebook's exact text format (from codegen: "Central heating", "Electric heating", etc.)
    const facebookHeatingOption = heatingOption
      .replace(/^Central Heat$/, 'Central heating')
      .replace(/^Gas Heat$/, 'Gas heating')
      .replace(/^Electric Heat$/, 'Electric heating')
      .replace(/^Radiator Heat$/, 'Radiator heating');
    console.log(`[Facebook Listing] Mapped heating option: "${heatingOption}" -> "${facebookHeatingOption}"`);
    await selectAmenityOption(5, facebookHeatingOption, 'Heating type');
  } else {
    console.log(`[Facebook Listing] ⏭️ Skipping heating selection - value: "${details.heatingType}"`);
  }

  // Publish the listing with error handling
  console.log('[Facebook Listing] Clicking Publish button...');
  try {
    await page.waitForTimeout(randomDelay());
    await page.getByRole('button', { name: 'Publish' }).click();
    console.log('[Facebook Listing] Publish button clicked, waiting for confirmation...');
    await page.waitForTimeout(randomDelay());
    
    // Handle any confirmation dialogs
    try {
      const stayOnPageButton = page.getByRole('button', { name: 'Stay on Page' });
      if (await stayOnPageButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stayOnPageButton.click();
        await page.waitForTimeout(randomDelay());
      }
    } catch (error) {
      console.log('[Facebook Listing] No "Stay on Page" dialog found, continuing...');
    }
    
    // Close any notifications
    try {
      const notificationClose = page.getByRole('complementary', { name: 'New notification' }).getByLabel('Close');
      if (await notificationClose.isVisible({ timeout: 3000 }).catch(() => false)) {
        await notificationClose.click();
        await page.waitForTimeout(randomDelay());
      }
    } catch (error) {
      console.log('[Facebook Listing] No notification to close');
    }
    
    // Wait for "Leave Page" dialog to appear after publishing
    // This dialog appears when the listing is successfully published
    console.log('[Facebook Listing] Waiting for "Leave Page" button to appear...');
    try {
      // Wait for the "Leave Page" button to appear (up to 10 seconds)
      const leavePageButton = page.getByRole('button', { name: 'Leave Page' });
      await leavePageButton.waitFor({ state: 'visible', timeout: 10000 });
      console.log('[Facebook Listing] "Leave Page" button is visible, clicking...');
      await leavePageButton.click();
      await page.waitForTimeout(randomDelay());
      console.log('[Facebook Listing] ✅ Clicked "Leave Page" button');
    } catch (error) {
      console.log('[Facebook Listing] ⚠️ "Leave Page" button did not appear within timeout, checking if already navigated...');
      // If "Leave Page" button doesn't appear, check if we're already on the listings page
      const currentUrl = page.url();
      if (currentUrl.includes('marketplace')) {
        console.log('[Facebook Listing] Already on marketplace page, continuing...');
      } else {
        // Try one more time to find the button
        try {
          const leavePageButton = page.getByRole('button', { name: 'Leave Page' });
          if (await leavePageButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await leavePageButton.click();
            await page.waitForTimeout(randomDelay());
            console.log('[Facebook Listing] ✅ Clicked "Leave Page" button on retry');
          }
        } catch (retryError) {
          console.log('[Facebook Listing] ⚠️ "Leave Page" button still not found, proceeding anyway...');
        }
      }
    }
    
    // Wait for page to load after leaving
    await page.waitForTimeout(randomDelay());
    await page.waitForTimeout(2000); // Give page time to load listings
    
    // Step 1: Click the listing item button (e.g., "Bed 2 Baths Apartment")
    // This button is typically the first listing item, not a menu button
    console.log('[Facebook Listing] Looking for first listing item button to click...');
    try {
      // Wait for listings to load
      await page.waitForTimeout(2000);
      
      // Find all buttons and filter for listing buttons (not menu buttons)
      // Listing buttons typically contain text like "Bed", "Bath", "Apartment", etc.
      const allButtons = page.getByRole('button');
      const buttonCount = await allButtons.count().catch(() => 0);
      console.log(`[Facebook Listing] Found ${buttonCount} buttons on page`);
      
      // Find the first button that looks like a listing (contains Bed/Bath/Apartment, not "Menu" or "More")
      let listingButton: any = null;
      for (let i = 0; i < Math.min(buttonCount, 20); i++) {
        const button = allButtons.nth(i);
        const text = await button.textContent().catch(() => '') || '';
        const ariaLabel = await button.getAttribute('aria-label').catch(() => '') || '';
        const combinedText = (text + ' ' + ariaLabel).toLowerCase();
        
        // Skip menu buttons, more buttons, and other UI buttons
        if (combinedText.includes('menu') || combinedText.includes('more') || 
            combinedText.includes('settings') || combinedText.includes('close') ||
            combinedText.includes('search') || combinedText === '' || combinedText.trim().length < 3) {
          continue;
        }
        
        // Check if it looks like a listing button (contains Bed, Bath, Apartment, or has price)
        if (combinedText.includes('bed') || combinedText.includes('bath') || 
            combinedText.includes('apartment') || combinedText.includes('$') ||
            combinedText.includes('room') || combinedText.includes('sqft')) {
          listingButton = button;
          console.log(`[Facebook Listing] Found listing button at index ${i}: "${text || ariaLabel}"`);
          break;
        }
      }
      
      if (listingButton) {
        // Scroll into view and click
        await listingButton.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await listingButton.click({ timeout: 5000 });
        await page.waitForTimeout(randomDelay());
        console.log('[Facebook Listing] ✅ Clicked listing button');
      } else {
        // Fallback: Try clicking the first image with listing classes
        console.log('[Facebook Listing] No listing button found, trying image fallback...');
        const listingImages = page.locator('img.x15mokao.x1ga7g.x16uus16.xbiv7yw');
        const imageCount = await listingImages.count().catch(() => 0);
        if (imageCount > 0) {
          console.log(`[Facebook Listing] Found ${imageCount} listing images, clicking the first one...`);
          await listingImages.first().scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await listingImages.first().click({ timeout: 5000 });
          await page.waitForTimeout(randomDelay());
          console.log('[Facebook Listing] ✅ Clicked first listing image');
        } else {
          throw new Error('Could not find first listing to click');
        }
      }
    } catch (error) {
      console.error('[Facebook Listing] ⚠️ Error clicking first listing:', error);
      throw error;
    }
    
    // Step 2: Click the link to go to the listing detail page (e.g., "1 Bed 2 Baths Apartment $1,")
    console.log('[Facebook Listing] Looking for listing detail link...');
    try {
      await page.waitForTimeout(randomDelay());
      
      // Find link that contains the listing details (price, bed, bath info)
      const listingLinks = page.getByRole('link');
      const linkCount = await listingLinks.count().catch(() => 0);
      console.log(`[Facebook Listing] Found ${linkCount} links on page`);
      
      // Find a link that looks like a listing detail link (contains price pattern like $1, or Bed/Bath info)
      let listingDetailLink: any = null;
      for (let i = 0; i < Math.min(linkCount, 20); i++) {
        const link = listingLinks.nth(i);
        const text = await link.textContent().catch(() => '') || '';
        const href = await link.getAttribute('href').catch(() => '') || '';
        
        // Check if it's a marketplace listing link (contains /item/ or /marketplace/)
        const isMarketplaceLink = href.includes('/item/') || href.includes('/marketplace/');
        
        // Check if text contains listing info
        const hasListingInfo = text.includes('$') || text.includes('Bed') || 
                              text.includes('Bath') || text.includes('Apartment');
        
        if ((isMarketplaceLink || hasListingInfo) && text.trim().length > 5) {
          listingDetailLink = link;
          console.log(`[Facebook Listing] Found listing detail link at index ${i}: "${text}" (href: ${href})`);
          break;
        }
      }
      
      if (listingDetailLink) {
        // Scroll into view and click
        await listingDetailLink.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await listingDetailLink.click({ timeout: 5000 });
        await page.waitForTimeout(randomDelay());
        console.log('[Facebook Listing] ✅ Clicked listing detail link');
      } else {
        // Fallback: Try to find any link with /item/ in the href
        console.log('[Facebook Listing] No listing detail link found by text, trying href fallback...');
        for (let i = 0; i < Math.min(linkCount, 20); i++) {
          const link = listingLinks.nth(i);
          const href = await link.getAttribute('href').catch(() => '') || '';
          if (href.includes('/item/')) {
            await link.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            await link.click({ timeout: 5000 });
            await page.waitForTimeout(randomDelay());
            console.log(`[Facebook Listing] ✅ Clicked link with /item/ in href: ${href}`);
            break;
          }
        }
      }
    } catch (error) {
      console.error('[Facebook Listing] ⚠️ Error clicking listing detail link:', error);
      // Continue anyway - we might already be on the listing page
    }
    
    // Wait for the listing page to load and extract the Facebook listing ID from URL
    await page.waitForTimeout(randomDelay());
    console.log('[Facebook Listing] Successfully posted listing to Facebook Marketplace');
    
    // Extract Facebook listing ID from URL and save it to database
    let facebookListingId: string | null = null;
    try {
      // Wait for navigation to complete - wait for URL to contain /item/
      console.log('[Facebook Listing] Waiting for listing page to load...');
      
      // Wait a bit for navigation to complete
      await page.waitForTimeout(3000);
      
      // Check both current URL and try to extract from href if needed
      let currentUrl = page.url();
      console.log(`[Facebook Listing] Current URL after navigation: ${currentUrl}`);
      
      // If URL doesn't have /item/ yet, wait for it or check the href of the clicked link
      if (!currentUrl.includes('/item/')) {
        console.log('[Facebook Listing] URL does not contain /item/ yet, waiting for navigation...');
        try {
          // Wait for URL to change to include /item/
          await page.waitForURL(/.*\/item\/.*/, { timeout: 10000 });
          currentUrl = page.url();
          console.log(`[Facebook Listing] ✅ Navigated to listing detail page: ${currentUrl}`);
        } catch (error) {
          console.log('[Facebook Listing] ⚠️ URL did not change, trying to extract from page...');
          // Try to find the listing link on the page and extract the ID from its href
          try {
            const listingLinks = page.locator('a[href*="/marketplace/item/"]');
            const count = await listingLinks.count();
            if (count > 0) {
              const firstLink = listingLinks.first();
              const href = await firstLink.getAttribute('href');
              if (href) {
                console.log(`[Facebook Listing] Found listing link with href: ${href}`);
                // Extract ID from href (could be relative or absolute)
                const idMatch = href.match(/\/item\/(\d+)/);
                if (idMatch && idMatch[1]) {
                  facebookListingId = idMatch[1];
                  console.log(`[Facebook Listing] ✅ Extracted Facebook listing ID from href: ${facebookListingId}`);
                  // Click the link to navigate to the full page
                  await firstLink.click();
                  await page.waitForTimeout(2000);
                  currentUrl = page.url();
                  console.log(`[Facebook Listing] Navigated to: ${currentUrl}`);
                }
              }
            }
          } catch (extractError) {
            console.error('[Facebook Listing] ⚠️ Could not extract from page links:', extractError);
          }
        }
      }
      
      // Extract the listing ID from URL (handles both absolute and relative URLs)
      // Pattern: /item/123456789/ or /marketplace/item/123456789/
      if (!facebookListingId) {
        const urlMatch = currentUrl.match(/\/item\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
          facebookListingId = urlMatch[1];
          console.log(`[Facebook Listing] ✅ Extracted Facebook listing ID from URL: ${facebookListingId}`);
        } else {
          // Try alternative pattern for relative URLs
          const altMatch = currentUrl.match(/marketplace\/item\/(\d+)/);
          if (altMatch && altMatch[1]) {
            facebookListingId = altMatch[1];
            console.log(`[Facebook Listing] ✅ Extracted Facebook listing ID (alt pattern): ${facebookListingId}`);
          }
        }
      }
      
      if (facebookListingId) {
        console.log(`[Facebook Listing] ✅ Final extracted Facebook listing ID: ${facebookListingId}`);
        
        // Save Facebook listing ID to database via API
        if (listingId && orgId) {
          try {
            // Use the same base URL as used for fetching listing data
            let appBaseURL = process.env.PLAYWRIGHT_BASE_URL;
            if (!appBaseURL) {
              appBaseURL = 'http://localhost:5000'; // Default to backend server port
            }
            const secretToken = process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret';
            const apiUrl = `${appBaseURL}/api/listings/${listingId}/facebook`;
            console.log(`[Facebook Listing] Saving Facebook listing ID "${facebookListingId}" to database...`);
            console.log(`[Facebook Listing] API URL: ${apiUrl}`);
            console.log(`[Facebook Listing] Listing ID: ${listingId}, Org ID: ${orgId}`);
            
            // Send the listing ID directly (the API will handle it)
            const requestBody = {
              facebookListingId: `https://www.facebook.com/marketplace/item/${facebookListingId}`, // Send full URL format
              orgId,
              secretToken,
            };
            console.log(`[Facebook Listing] Request body:`, JSON.stringify(requestBody, null, 2));
            
            // Use internal API call with secret token
            // Add timeout to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            try {
              const response = await fetch(apiUrl, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
              });
              
              clearTimeout(timeoutId);
              
              console.log(`[Facebook Listing] API Response status: ${response.status} ${response.statusText}`);
              
              if (response.ok) {
                const responseData = await response.json().catch(() => ({}));
                console.log(`[Facebook Listing] ✅ Successfully saved Facebook listing ID ${facebookListingId} to database`);
                console.log(`[Facebook Listing] Response data:`, JSON.stringify(responseData, null, 2));
                console.log(`[Facebook Listing] Saved listing ID to database - listing ${listingId} now has facebookListingId: ${responseData.facebookListingId || facebookListingId}`);
              } else {
                const errorText = await response.text().catch(() => 'Could not read error response');
                console.error(`[Facebook Listing] ❌ Failed to save Facebook listing ID to database`);
                console.error(`[Facebook Listing] Status: ${response.status} ${response.statusText}`);
                console.error(`[Facebook Listing] Error response: ${errorText}`);
                throw new Error(`API returned ${response.status}: ${errorText}`);
              }
            } catch (fetchError: any) {
              clearTimeout(timeoutId);
              if (fetchError.name === 'AbortError') {
                console.error(`[Facebook Listing] ❌ API call timed out after 30 seconds`);
                throw new Error('API call timed out');
              }
              throw fetchError;
            }
          } catch (apiError: any) {
            console.error(`[Facebook Listing] ❌ Error calling API to save Facebook listing ID`);
            console.error(`[Facebook Listing] Error type: ${apiError.name}`);
            console.error(`[Facebook Listing] Error message: ${apiError.message}`);
            if (apiError.stack) {
              console.error(`[Facebook Listing] Error stack:`, apiError.stack);
            }
          }
        } else {
          console.error(`[Facebook Listing] ❌ Missing required data - cannot save to database`);
          console.error(`[Facebook Listing] listingId: ${listingId}, orgId: ${orgId}`);
        }
      } else {
        console.error(`[Facebook Listing] ❌ Could not extract listing ID from URL: ${currentUrl}`);
        console.error(`[Facebook Listing] Please check the URL format and extraction logic`);
      }
    } catch (error: any) {
      console.error('[Facebook Listing] ❌ Error extracting or saving Facebook listing ID');
      console.error('[Facebook Listing] Error type:', error.name);
      console.error('[Facebook Listing] Error message:', error.message);
      if (error.stack) {
        console.error('[Facebook Listing] Error stack:', error.stack);
      }
    }
    
  } catch (error: any) {
    console.error('[Facebook Listing] Error during publishing:', error);
    // Take screenshot for debugging
    try {
      await page.screenshot({ path: `facebook-listing-error-${Date.now()}.png`, fullPage: true });
      console.log('[Facebook Listing] Screenshot saved for debugging');
    } catch (screenshotError) {
      console.error('[Facebook Listing] Failed to take screenshot:', screenshotError);
    }
    throw error; // Re-throw to fail the test
  }
  
  // Cleanup: Remove temp image files
  if (fs.existsSync(tempDir)) {
    try {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
      console.log('[Facebook Listing] Cleaned up temporary image files');
    } catch (error) {
      console.error('[Facebook Listing] Error cleaning up temp images:', error);
    }
  }
});