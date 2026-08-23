import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { diffPacks } from '../src/diff.js';

test('diff reports prose changes by role and section', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'companymd-diff-'));
  const before = path.join(temp, 'before');
  const after = path.join(temp, 'after');
  fs.cpSync(path.resolve('examples/northstar'), before, { recursive: true });
  fs.cpSync(path.resolve('examples/northstar'), after, { recursive: true });
  const voicePath = path.join(after, 'VOICE.md');
  const voice = fs.readFileSync(voicePath, 'utf8').replace(
    'Use direct sentences, concrete nouns, and active verbs.',
    'Use brief sentences, concrete nouns, and active verbs.',
  );
  fs.writeFileSync(voicePath, voice, 'utf8');

  const report = diffPacks(before, after);
  const voiceDiff = report.documents.find((document) => document.role === 'voice');
  assert.equal(voiceDiff?.change, 'modified');
  assert.deepEqual(voiceDiff?.sections.modified, ['How We Talk']);
  assert.equal(report.regression, false);
});
