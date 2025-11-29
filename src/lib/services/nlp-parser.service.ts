import * as chrono from 'chrono-node';
import type { ParsedTaskInput, Priority } from '@/types';

/**
 * Priority keywords and their mappings
 * These keywords in the input text will set the corresponding priority level
 */
const PRIORITY_KEYWORDS: Record<string, Priority> = {
  // High priority keywords
  'urgent': 'high',
  'asap': 'high',
  'critical': 'high',
  'high priority': 'high',
  'high-priority': 'high',
  '!': 'high',
  '!!': 'high',
  '!!!': 'high',
  
  // Medium priority keywords
  'important': 'medium',
  'medium priority': 'medium',
  'medium-priority': 'medium',
  
  // Low priority keywords
  'low priority': 'low',
  'low-priority': 'low',
  'whenever': 'low',
  'someday': 'low',
};

/**
 * Patterns for detecting list references in input text
 * Supports formats like "in Work", "in #Personal", "#Work"
 */
const LIST_PATTERNS = [
  /\bin\s+#?([a-zA-Z][\w\s-]*?)(?:\s+(?:at|on|by|tomorrow|today|next|this)|$)/i,
  /\s#([a-zA-Z][\w-]*)/,
];

/**
 * NLP Parser Service
 * Parses natural language input into structured task data using chrono-node
 * for date/time extraction and custom patterns for priority and list detection.
 */
export interface INLPParserService {
  parse(input: string, referenceDate?: Date): ParsedTaskInput;
}

/**
 * Extracts priority from input text
 * @param input - The input text to search for priority keywords
 * @returns Object containing the detected priority and the cleaned text
 */
function extractPriority(input: string): { priority?: Priority; cleanedText: string } {
  let cleanedText = input;
  let priority: Priority | undefined;

  // Sort keywords by length (longest first) to match longer phrases first
  const sortedKeywords = Object.keys(PRIORITY_KEYWORDS).sort((a, b) => b.length - a.length);

  for (const keyword of sortedKeywords) {
    // Create a regex that matches the keyword as a whole word (case-insensitive)
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'gi');
    
    if (regex.test(cleanedText)) {
      priority = PRIORITY_KEYWORDS[keyword];
      cleanedText = cleanedText.replace(regex, '').trim();
      break; // Use the first (longest) match
    }
  }

  return { priority, cleanedText };
}

/**
 * Extracts list reference from input text
 * @param input - The input text to search for list references
 * @returns Object containing the detected list name and the cleaned text
 */
function extractListReference(input: string): { listName?: string; cleanedText: string } {
  let cleanedText = input;
  let listName: string | undefined;

  for (const pattern of LIST_PATTERNS) {
    const match = cleanedText.match(pattern);
    if (match && match[1]) {
      listName = match[1].trim();
      cleanedText = cleanedText.replace(match[0], ' ').trim();
      break;
    }
  }

  return { listName, cleanedText };
}

/**
 * Extracts time string from a Date object
 * @param date - The date to extract time from
 * @returns Time string in HH:mm format, or undefined if no specific time
 */
function extractTimeFromDate(date: Date, parsedResult: chrono.ParsedResult): string | undefined {
  // Check if the parsed result has a known time component
  const hasTime = parsedResult.start.isCertain('hour');
  
  if (hasTime) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  
  return undefined;
}

/**
 * Cleans up the task name by removing extra whitespace and common artifacts
 * @param text - The text to clean
 * @returns Cleaned text
 */
function cleanTaskName(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/^\s*[-–—]\s*/, '')    // Remove leading dashes
    .replace(/\s*[-–—]\s*$/, '')    // Remove trailing dashes
    .replace(/^[,.\s]+/, '')        // Remove leading punctuation
    .replace(/[,.\s]+$/, '')        // Remove trailing punctuation
    .trim();
}

/**
 * Parses natural language input into structured task data
 * 
 * @param input - The natural language input string
 * @param referenceDate - Optional reference date for relative date parsing (defaults to now)
 * @returns ParsedTaskInput with extracted name, date, time, priority, and listName
 * 
 * @example
 * parse("Lunch with Sarah at 1 PM tomorrow")
 * // Returns: { name: "Lunch with Sarah", date: <tomorrow>, time: "13:00" }
 * 
 * @example
 * parse("urgent: Review PR in Work")
 * // Returns: { name: "Review PR", priority: "high", listName: "Work" }
 */
export function parse(input: string, referenceDate?: Date): ParsedTaskInput {
  if (!input || typeof input !== 'string') {
    return { name: '' };
  }

  const trimmedInput = input.trim();
  if (trimmedInput.length === 0) {
    return { name: '' };
  }

  let workingText = trimmedInput;
  let extractedDate: Date | undefined;
  let extractedTime: string | undefined;

  // Step 1: Extract priority keywords
  const priorityResult = extractPriority(workingText);
  const extractedPriority = priorityResult.priority;
  workingText = priorityResult.cleanedText;

  // Step 2: Parse date/time using chrono-node BEFORE list extraction
  // This ensures date words like "tomorrow" aren't consumed by list patterns
  const refDate = referenceDate || new Date();
  const parsedResults = chrono.parse(workingText, refDate, { forwardDate: true });

  if (parsedResults.length > 0) {
    const firstResult = parsedResults[0];
    extractedDate = firstResult.start.date();
    extractedTime = extractTimeFromDate(extractedDate, firstResult);

    // Remove the date/time text from the working text
    workingText = workingText.replace(firstResult.text, '').trim();
  }

  // Step 3: Extract list reference (after date extraction)
  const listResult = extractListReference(workingText);
  const extractedListName = listResult.listName;
  workingText = listResult.cleanedText;

  // Step 4: Clean up the remaining text as the task name
  const taskName = cleanTaskName(workingText);

  // Step 5: Fallback - if no name extracted, use the original input
  const finalName = taskName.length > 0 ? taskName : trimmedInput;

  const result: ParsedTaskInput = {
    name: finalName,
  };

  if (extractedDate) {
    result.date = extractedDate;
  }

  if (extractedTime) {
    result.time = extractedTime;
  }

  if (extractedPriority) {
    result.priority = extractedPriority;
  }

  if (extractedListName) {
    result.listName = extractedListName;
  }

  return result;
}

/**
 * NLP Parser Service singleton
 */
export const nlpParserService: INLPParserService = {
  parse,
};

export default nlpParserService;
