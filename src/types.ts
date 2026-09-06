export type Severity = 'error' | 'warning' | 'info';
export type DocumentKind = 'company' | 'customer' | 'offer' | 'voice';
export type Classification = 'public' | 'internal' | 'confidential' | 'restricted';
export type DocumentStatus = 'draft' | 'active' | 'deprecated';
export type MaturityLevel = 'starter' | 'team' | 'enterprise';

export interface Owner {
  team: string;
  contact?: string;
}

export interface ReviewPolicy {
  last_reviewed: string;
  next_review: string;
}

export interface Claim {
  id: string;
  status: 'verified' | 'assumption' | 'decision' | 'deprecated';
  source: string;
  owner: string;
  verified_at?: string;
}

export interface RuleException {
  rule: string;
  reason: string;
  approved_by?: string;
  expires?: string;
}

export interface CompanyMdMeta {
  companymd: string;
  schema?: string;
  maturity?: MaturityLevel;
  kind: DocumentKind;
  id: string;
  company?: string;
  name: string;
  status: DocumentStatus;
  classification: Classification;
  owners: Owner[];
  review: ReviewPolicy;
  scope?: Record<string, string[]>;
  extends?: string | string[];
  exceptions?: RuleException[];
  claims?: Claim[];
  links?: Partial<Record<DocumentKind | 'design', string>>;
  [key: string]: unknown;
}

export interface MarkdownSection {
  heading: string;
  normalizedHeading: string;
  line: number;
  content: string;
}

export interface ParsedDocument {
  path: string;
  content: string;
  frontmatter: string;
  meta: Record<string, unknown>;
  sections: MarkdownSection[];
  claimReferences: string[];
}

export interface Finding {
  ruleId: string;
  severity: Severity;
  file: string;
  message: string;
  path?: string;
  line?: number;
  suggestion?: string;
}

export interface FileReport {
  file: string;
  kind: DocumentKind | 'design' | 'unknown';
  findings: Finding[];
}

export interface Summary {
  errors: number;
  warnings: number;
  infos: number;
}

export interface LintReport {
  specVersion: string;
  valid: boolean;
  root: string;
  files: FileReport[];
  findings: Finding[];
  summary: Summary;
}

export interface LoadedDocument {
  role: DocumentKind | 'design';
  path: string;
  content: string;
  parsed?: ParsedDocument;
  inherited: boolean;
  /** First inheriting document, retained for compatibility. */
  inheritedBy?: string;
  /** Every direct child; a shared base in a diamond has more than one. */
  inheritedByPaths?: string[];
}

export interface LoadedPack {
  root: string;
  company: ParsedDocument;
  documents: LoadedDocument[];
}
