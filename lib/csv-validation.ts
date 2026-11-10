import Papa from 'papaparse';
import {
  CampaignType,
  CsvImportResult,
  EmailContactRecord,
  WhatsAppContactRecord,
  ParsedContactRecord,
  ValidationSummary,
} from '@/types/campaign';

// Standard RFC-5322 compliant email regex pattern
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Common column candidates
export const EMAIL_COLUMN_CANDIDATES = [
  'email',
  'email_address',
  'emailaddress',
  'e-mail',
  'e_mail',
  'mail',
  'contact_email',
  'user_email',
  'recipient_email',
];

export const PHONE_COLUMN_CANDIDATES = [
  'phone',
  'phone_number',
  'phonenumber',
  'phone_no',
  'phoneno',
  'mobile',
  'mobile_number',
  'mobilenumber',
  'mobile_no',
  'mobileno',
  'whatsapp',
  'whatsapp_number',
  'whatsappnumber',
  'whatsapp_no',
  'contact_number',
  'contact_no',
];

export const NAME_COLUMN_CANDIDATES = [
  'name',
  'full_name',
  'fullname',
  'contact_name',
  'customer_name',
  'first_name',
  'firstname',
  'recipient_name',
];

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[\s\-_]+/g, '').trim();
}

export function detectColumn(headers: string[], candidates: string[]): string | null {
  const normalizedCandidates = candidates.map(normalizeHeader);
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (normalizedCandidates.includes(normalized)) {
      return header;
    }
  }
  return null;
}

export function validateEmailString(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

/**
 * Validates international phone numbers preserving leading '+' and leading zeros.
 * ITU-T E.164 recommends max 15 digits; local numbers can be 7-12 digits.
 */
export function validatePhoneString(phone: string): { isValid: boolean; normalized: string; reason?: string } {
  if (!phone || typeof phone !== 'string') {
    return { isValid: false, normalized: '', reason: 'Phone number is empty' };
  }

  const rawTrimmed = phone.trim();
  if (!rawTrimmed) {
    return { isValid: false, normalized: '', reason: 'Phone number is empty' };
  }

  // Preserve leading '+' if present
  const hasPlus = rawTrimmed.startsWith('+');
  // Strip spaces, dashes, brackets, dots commonly used in formatting
  const digitsOnly = rawTrimmed.replace(/[^0-9]/g, '');

  if (digitsOnly.length === 0) {
    return { isValid: false, normalized: rawTrimmed, reason: 'Contains no numeric digits' };
  }

  if (/[a-zA-Z]/.test(rawTrimmed)) {
    return { isValid: false, normalized: rawTrimmed, reason: 'Phone number contains letters' };
  }

  if (digitsOnly.length < 7) {
    return { isValid: false, normalized: rawTrimmed, reason: 'Too short (minimum 7 digits required)' };
  }

  if (digitsOnly.length > 15) {
    return { isValid: false, normalized: rawTrimmed, reason: 'Too long (maximum 15 digits allowed per E.164 standard)' };
  }

  const normalized = hasPlus ? `+${digitsOnly}` : digitsOnly;
  return { isValid: true, normalized };
}

export function evaluateCsvRecords(
  rows: Record<string, string>[],
  headers: string[],
  campaignType: CampaignType,
  targetCol: string | null,
  nameCol?: string | null
): {
  records: ParsedContactRecord[];
  summary: ValidationSummary;
  errorReportCsv: string;
} {
  if (!targetCol) {
    return {
      records: [],
      summary: {
        totalRows: rows.length,
        validCount: 0,
        invalidCount: rows.length,
        duplicateCount: 0,
        hasErrors: true,
        columnDetected: null,
      },
      errorReportCsv: '',
    };
  }

  const seenValues = new Set<string>();
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const records: ParsedContactRecord[] = [];

  rows.forEach((row, index) => {
    const rowIndex = index + 1;
    const rawVal = row[targetCol] ? String(row[targetCol]).trim() : '';
    const nameVal = nameCol && row[nameCol] ? String(row[nameCol]).trim() : undefined;
    const errors: string[] = [];

    if (campaignType === 'email') {
      const emailVal = rawVal.toLowerCase();
      let status: 'valid' | 'invalid' | 'duplicate' = 'valid';

      if (!rawVal) {
        status = 'invalid';
        errors.push('Email address is missing or empty');
        invalidCount++;
      } else if (!validateEmailString(rawVal)) {
        status = 'invalid';
        errors.push(`Invalid email format: "${rawVal}"`);
        invalidCount++;
      } else if (seenValues.has(emailVal)) {
        status = 'duplicate';
        errors.push(`Duplicate email found in list`);
        duplicateCount++;
      } else {
        seenValues.add(emailVal);
        validCount++;
      }

      const record: EmailContactRecord = {
        rowIndex,
        raw: row,
        status,
        errors,
        email: rawVal,
        name: nameVal,
      };
      records.push(record);
    } else {
      // WhatsApp phone validation
      const validation = validatePhoneString(rawVal);
      let status: 'valid' | 'invalid' | 'duplicate' = 'valid';

      if (!validation.isValid) {
        status = 'invalid';
        errors.push(validation.reason || 'Invalid phone number format');
        invalidCount++;
      } else if (seenValues.has(validation.normalized)) {
        status = 'duplicate';
        errors.push(`Duplicate phone number in list`);
        duplicateCount++;
      } else {
        seenValues.add(validation.normalized);
        validCount++;
      }

      const record: WhatsAppContactRecord = {
        rowIndex,
        raw: row,
        status,
        errors,
        phone: rawVal,
        formattedPhone: validation.isValid ? validation.normalized : undefined,
        name: nameVal,
      };
      records.push(record);
    }
  });

  // Generate Error Report CSV string if errors or duplicates exist
  let errorReportCsv = '';
  const problematicRecords = records.filter((r) => r.status !== 'valid');
  if (problematicRecords.length > 0) {
    const errorRows = problematicRecords.map((r) => ({
      'Row Number': r.rowIndex,
      Status: r.status.toUpperCase(),
      [campaignType === 'email' ? 'Email' : 'Phone']:
        campaignType === 'email'
          ? (r as EmailContactRecord).email
          : (r as WhatsAppContactRecord).phone,
      'Error Details': r.errors.join('; '),
    }));
    errorReportCsv = Papa.unparse(errorRows);
  }

  return {
    records,
    summary: {
      totalRows: rows.length,
      validCount,
      invalidCount,
      duplicateCount,
      hasErrors: invalidCount > 0 || duplicateCount > 0,
      columnDetected: targetCol,
    },
    errorReportCsv,
  };
}

export async function parseAndValidateCsv(
  file: File,
  campaignType: CampaignType,
  overrideTargetCol?: string | null,
  overrideNameCol?: string | null
): Promise<CsvImportResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        try {
          const rawHeaders = results.meta.fields || [];
          const rows = results.data || [];

          if (rawHeaders.length === 0 || rows.length === 0) {
            resolve({
              fileName: file.name,
              fileSizeBytes: file.size,
              headers: rawHeaders,
              records: [],
              rawRows: [],
              selectedTargetCol: null,
              selectedNameCol: null,
              summary: {
                totalRows: 0,
                validCount: 0,
                invalidCount: 0,
                duplicateCount: 0,
                hasErrors: true,
                columnDetected: null,
              },
            });
            return;
          }

          const targetCol =
            overrideTargetCol !== undefined
              ? overrideTargetCol
              : campaignType === 'email'
              ? detectColumn(rawHeaders, EMAIL_COLUMN_CANDIDATES)
              : detectColumn(rawHeaders, PHONE_COLUMN_CANDIDATES);

          const nameCol =
            overrideNameCol !== undefined
              ? overrideNameCol
              : campaignType === 'whatsapp'
              ? null
              : detectColumn(rawHeaders, NAME_COLUMN_CANDIDATES);

          const evaluated = evaluateCsvRecords(
            rows,
            rawHeaders,
            campaignType,
            targetCol,
            nameCol
          );

          resolve({
            fileName: file.name,
            fileSizeBytes: file.size,
            headers: rawHeaders,
            records: evaluated.records,
            rawRows: rows,
            selectedTargetCol: targetCol,
            selectedNameCol: nameCol,
            summary: evaluated.summary,
            errorReportCsv: evaluated.errorReportCsv,
          });
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => {
        reject(new Error(`Failed to parse CSV file: ${err.message}`));
      },
    });
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
