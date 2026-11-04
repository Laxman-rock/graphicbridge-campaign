export type CampaignType = 'email' | 'whatsapp';

export type ContactValidationStatus = 'valid' | 'invalid' | 'duplicate';

export interface BaseContactRecord {
  rowIndex: number;
  raw: Record<string, string>;
  status: ContactValidationStatus;
  errors: string[];
}

export interface EmailContactRecord extends BaseContactRecord {
  email: string;
  name?: string;
}

export interface WhatsAppContactRecord extends BaseContactRecord {
  phone: string;
  formattedPhone?: string;
  name?: string;
}

export type ParsedContactRecord = EmailContactRecord | WhatsAppContactRecord;

export interface ValidationSummary {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  hasErrors: boolean;
  columnDetected: string | null;
}

export interface CsvImportResult {
  fileName: string;
  fileSizeBytes: number;
  headers: string[];
  records: ParsedContactRecord[];
  summary: ValidationSummary;
  errorReportCsv?: string;
  rawRows?: Record<string, string>[];
  selectedTargetCol?: string | null;
  selectedNameCol?: string | null;
}

