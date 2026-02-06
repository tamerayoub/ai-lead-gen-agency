/**
 * Extract contact info (name, email, phone) from free-form user messages
 */

export interface ExtractedContact {
  name?: string;
  email?: string;
  phone?: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9]{2,}/g;
const PHONE_REGEX = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const NAME_REGEX = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;

export function extractContactFromMessage(message: string): ExtractedContact {
  const result: ExtractedContact = {};
  const emails = message.match(EMAIL_REGEX);
  if (emails && emails.length > 0) {
    result.email = emails[0].trim();
  }
  const phones = message.match(PHONE_REGEX);
  if (phones && phones.length > 0) {
    result.phone = phones[0].replace(/\s+/g, '-').trim();
  }
  const names = message.match(NAME_REGEX);
  if (names && names.length > 0) {
    result.name = names[0].trim();
  }
  if (!result.name) {
    const twoWordMatch = message.match(/\b([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
    if (twoWordMatch) {
      result.name = twoWordMatch[0].trim();
    }
  }
  return result;
}
