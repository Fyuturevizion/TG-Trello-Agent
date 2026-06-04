import { SPLINTER_INTRUDER_QUOTES } from './quotes-data';

export function splinterIntruderQuote(who: string, attempt: number): string {
  const template =
    SPLINTER_INTRUDER_QUOTES[(attempt - 1) % SPLINTER_INTRUDER_QUOTES.length];
  return template.replace(/\{who\}/g, who).replace(/\{count\}/g, String(attempt));
}
