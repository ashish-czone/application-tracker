/**
 * Single whitelist for every compliance-domain attachment (Q26). ZIPs and
 * executables are excluded — V1 has no virus scanner, so any format that can
 * hide nested binaries is off-limits.
 */
export const COMPLIANCE_ATTACHMENT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'text/csv',
];

/**
 * Per-file upload cap for compliance attachments (Q27). Covers multi-page
 * scanned notices and large Excel workings without being generous enough to
 * let a rogue uploader fill the bucket quickly. No aggregate or firm-wide
 * quota in V1.
 */
export const COMPLIANCE_MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
