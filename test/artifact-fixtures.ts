import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
export const record = (root: string, file: string) => ({ path: file, exists: true as const, sha256: hash(fs.readFileSync(path.join(root, file))) });
export const json = (root: string, file: string, value: unknown): string => {
  fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
  return path.join(root, file);
};
export const presentationGates = ['artifact/export', 'artifact/render', 'artifact/overflow', 'design/conformance'];
export type Identity = { sha256: string } | { url: string; provider: string; revisionId: string };

/** A valid one-page PDF, including byte offsets and its page tree. */
export function pdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  let content = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const start = Buffer.byteLength(content);
  content += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(content);
}

export function boundPresentation(root: string, identity: Identity, remote = false) {
  const sources = ['company', 'customer', 'offer', 'voice', 'design'].map((role) => {
    const file = `${role.toUpperCase()}.md`;
    if (!fs.existsSync(path.join(root, file))) fs.writeFileSync(path.join(root, file), `# Synthetic ${role}\n`);
    return { file, role, sha256: record(root, file).sha256, classification: 'internal' };
  });
  json(root, 'context.json', {
    schema: 'companymd/context-receipt/v1', generatedAt: '2026-09-06T00:00:00Z',
    profile: 'visual', clearance: 'internal', subject: 'synthetic-product', artifact: 'presentation',
    sourceRoot: '.', sources, attachments: [], binding: { design: 'DESIGN.md' },
  });
  const ids = [...(remote ? ['artifact/access', 'artifact/revision'] : []), ...presentationGates];
  const verification = ids.map((id) => {
    if (id === 'artifact/export') return { id, status: 'pass' };
    const file = `${id.replace('/', '-')}.json`;
    json(root, file, {
      schema: 'companymd/evidence/v1', gate: id,
      method: id === 'design/conformance' ? 'attestation' : id === 'artifact/access' || id === 'artifact/revision' ? 'provider' : 'measured',
      observedAt: '2026-09-06T00:00:00Z', details: 'Synthetic test observation; not a live renderer or provider result.',
      deliverable: identity,
    });
    return { id, status: 'pass', evidence: [record(root, file)] };
  });
  return {
    context: { ...record(root, 'context.json'), subject: 'synthetic-product', artifact: 'presentation' },
    sources: sources.map(({ file, ...source }) => ({ ...source, path: file, exists: true })),
    attachments: [] as Array<{ path: string; role: string; exists: boolean; sha256: string }>,
    verification,
  };
}
