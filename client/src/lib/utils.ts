import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Trailing punctuation that should not be part of a URL when at end of sentence */
const URL_TRAILING_PUNCT = /[.,;:)!\]?>]+$/;

/** Parse text into parts (text, url, email, phone) for rendering clickable links */
export function linkifyText(text: string): Array<{ type: 'text' | 'url' | 'email' | 'phone'; content: string; key: string }> {
  // Combined regex with one capturing group per type: 1=url, 2=email, 3=phone
  const parts: Array<{ type: 'text' | 'url' | 'email' | 'phone'; content: string; key: string }> = [];
  let lastIndex = 0;
  let keyCounter = 0;

  const combinedRegex = new RegExp(
    `(https?:\\/\\/[^\\s]+)|([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9_-]+)|((?:\\+?\\d{1,3}[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4})`,
    'gi'
  );

  const matches = Array.from(text.matchAll(combinedRegex));

  for (const match of matches) {
    const matchIndex = match.index!;
    let matchText = match[0];

    if (matchIndex > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, matchIndex), key: `text-${keyCounter++}` });
    }
    if (match[1]) {
      matchText = matchText.replace(URL_TRAILING_PUNCT, '');
      parts.push({ type: 'url', content: matchText, key: `url-${keyCounter++}` });
    } else if (match[2]) {
      parts.push({ type: 'email', content: matchText, key: `email-${keyCounter++}` });
    } else if (match[3]) {
      parts.push({ type: 'phone', content: matchText, key: `phone-${keyCounter++}` });
    }
    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex), key: `text-${keyCounter++}` });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text, key: 'text-0' }];
}
