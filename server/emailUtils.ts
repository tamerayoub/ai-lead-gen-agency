/**
 * Cleans email body by removing quoted content and normalizing line breaks
 */
export function cleanEmailBody(emailBody: string): string {
  if (!emailBody) return "";

  // Remove "On...wrote:" quoted sections - match the entire pattern including the quoted content after it
  // This pattern looks for "On " followed by any text including newlines, then "wrote:" and removes everything after
  emailBody = emailBody.replace(/\n\s*On\s+.+?wrote:\s*[\s\S]*/gi, '');
  
  // Remove lines that start with ">" (quoted text)
  emailBody = emailBody.replace(/^>.*$/gm, '');
  
  // Remove email signature separators and everything after
  emailBody = emailBody.replace(/\n\s*-{2,}\s*\n[\s\S]*/g, '');
  
  // Remove "From:" forwarded email markers and everything after
  const lines = emailBody.split('\n');
  const cleanedLines: string[] = [];
  let hitForwardMarker = false;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    
    // Check for forward marker (but not if it's the first line)
    if (i > 0 && trimmedLine.startsWith('From:')) {
      hitForwardMarker = true;
    }
    
    if (hitForwardMarker) {
      break; // Stop adding lines
    }
    
    cleanedLines.push(lines[i]);
  }

  // Join lines back together
  let result = cleanedLines.join('\n');

  // Normalize line breaks: Convert single line breaks to spaces, preserve paragraph breaks
  // First, protect actual paragraph breaks (double line breaks or more)
  result = result.replace(/\n\n+/g, '<<<PARAGRAPH_BREAK>>>');
  
  // Now convert all remaining single line breaks to spaces
  result = result.replace(/\n/g, ' ');
  
  // Restore paragraph breaks
  result = result.replace(/<<<PARAGRAPH_BREAK>>>/g, '\n\n');
  
  // Clean up multiple spaces
  result = result.replace(/  +/g, ' ');

  return result.trim();
}
