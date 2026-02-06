import { spawn } from 'child_process';
import { getStorageStatePathForSpawnedProcess } from './facebookAuthManager';

/**
 * Triggers a Facebook Marketplace listing via Playwright automation.
 * Uses auth manager: session-first, Key Vault fallback. Passes storageState path to spawned process.
 */
export async function triggerFacebookListing(
  listingId: string,
  orgId: string,
  waitForCompletion: boolean = false
): Promise<{ pid: number; promise?: Promise<void> }> {
  try {
    const auth = await getStorageStatePathForSpawnedProcess(orgId);
    if (!auth) {
      throw new Error(
        'Facebook Marketplace authentication failed. Please reconnect in Settings > Integrations.'
      );
    }

    let baseURL = process.env.PLAYWRIGHT_BASE_URL;
    if (!baseURL) {
      const serverPort = process.env.PORT || '5000';
      baseURL = `http://localhost:${serverPort}`;
    }

    const env = {
      ...process.env,
      LISTING_ID: listingId,
      ORG_ID: orgId,
      PLAYWRIGHT_STORAGE_STATE_PATH: auth.path,
      PLAYWRIGHT_BASE_URL: baseURL,
      PLAYWRIGHT_SKIP_WEBSERVER: 'true',
      FACEBOOK_LISTING_SECRET_TOKEN: process.env.FACEBOOK_LISTING_SECRET_TOKEN || 'facebook-listing-secret',
      PLAYWRIGHT_HEADLESS: 'false',
    };

    console.log(`[Facebook Listing] Triggering listing ${listingId} (waitForCompletion: ${waitForCompletion})`);
    
    // Create a promise that resolves when the process completes
    const processPromise = new Promise<void>((resolve, reject) => {
      const playwrightProcess = spawn('npx', [
        'playwright', 
        'test', 
        'tests/facebook.postlisting.spec.ts', 
        '--project=chromium',
        '--reporter=list', // Show output
        '--headed', // Show browser window
        '--debug' // Open Playwright Inspector for debugging
      ], {
        env,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
        shell: process.platform === 'win32', // Required on Windows for npx
      });
      
      let stdout = '';
      let stderr = '';
      
      // Capture output
      playwrightProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        console.log(`[Facebook Listing PID ${playwrightProcess.pid}] ${output.trim()}`);
      });
      
      playwrightProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        console.error(`[Facebook Listing PID ${playwrightProcess.pid}] ${output.trim()}`);
      });
      
      // Handle process completion
      playwrightProcess.on('close', (code, signal) => {
        auth.cleanup().catch(() => {});
        if (code === 0) {
          console.log(`[Facebook Listing] Process completed successfully for listing ${listingId} (PID: ${playwrightProcess.pid})`);
          resolve();
        } else {
          const error = new Error(`Playwright process exited with code ${code}${signal ? ` and signal ${signal}` : ''}`);
          console.error(`[Facebook Listing] Process failed for listing ${listingId} (PID: ${playwrightProcess.pid}):`, error.message);
          console.error(`[Facebook Listing] stdout:`, stdout);
          console.error(`[Facebook Listing] stderr:`, stderr);
          reject(error);
        }
      });
      
      playwrightProcess.on('error', (error) => {
        auth.cleanup().catch(() => {});
        console.error(`[Facebook Listing] Error starting Playwright process for listing ${listingId}:`, error);
        reject(error);
      });
      
      console.log(`[Facebook Listing] Started Playwright process (PID: ${playwrightProcess.pid}) for Facebook listing ${listingId}`);
    });
    
    if (waitForCompletion) {
      // Wait for the process to complete
      await processPromise;
      return { pid: 0 }; // PID not available after process completes
    } else {
      // Don't wait - run in background but still capture output
      // The promise will complete asynchronously and logs will show progress
      processPromise.catch((error) => {
        console.error(`[Facebook Listing] Background process error for listing ${listingId}:`, error);
      });
      return { pid: 0, promise: processPromise };
    }
  } catch (error: any) {
    console.error(`[Facebook Listing] Failed to trigger Facebook listing for ${listingId}:`, error);
    throw error;
  }
}

