import type { Classification, DocumentKind } from './types.js';

export const SPEC_VERSION = '0.1';

export const KINDS: DocumentKind[] = ['company', 'customer', 'offer', 'voice'];
export const STATUSES = ['draft', 'active', 'deprecated'] as const;
export const CLASSIFICATIONS: Classification[] = [
  'public',
  'internal',
  'confidential',
  'restricted',
];

export const CONVENTIONAL_FILENAMES: Record<DocumentKind, string> = {
  company: 'COMPANY.md',
  customer: 'CUSTOMER.md',
  offer: 'OFFER.md',
  voice: 'VOICE.md',
};

export const REQUIRED_SECTIONS: Record<DocumentKind, string[]> = {
  company: [
    'Overview',
    'What We Sell',
    'Who We Serve',
    'How We Make Money',
    'What We Believe',
    'What Makes Us Different',
    'Operating Boundaries',
    'Evidence and Open Questions',
  ],
  customer: [
    'Ideal Customer Profile',
    'Pains',
    'Objections',
    'Buying Triggers',
    'Questions',
    'Language',
    'Fears',
    'Decision Criteria',
    'Exclusions',
    'Evidence and Open Questions',
  ],
  offer: [
    'Packages',
    'Deliverables',
    'Pricing Logic',
    'Proof',
    'Promises',
    'Claims to Avoid',
    'Good-Fit Customers',
    'Commercial Guardrails',
    'Evidence and Open Questions',
  ],
  voice: [
    'Voice Principles',
    'How We Talk',
    'How We Never Sound',
    'Phrases We Use',
    'Phrases We Avoid',
    'Writing Mechanics',
    'Channel Adaptations',
    'Examples of Good Writing',
    'Review Checklist',
  ],
};

export const PROFILE_ROLES: Record<string, Array<DocumentKind | 'design'>> = {
  core: ['company'],
  customer: ['company', 'customer'],
  commercial: ['company', 'customer', 'offer'],
  communications: ['company', 'customer', 'offer', 'voice'],
  visual: ['company', 'customer', 'offer', 'voice', 'design'],
  all: ['company', 'customer', 'offer', 'voice', 'design'],
};

export function normalizeHeading(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[’']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function classificationRank(value: Classification): number {
  return CLASSIFICATIONS.indexOf(value);
}
