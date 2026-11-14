import { expect, test } from 'bun:test';
import { applyMarks, fingerprint, matches, parseRaw, statusOf } from '../home/dot_local/lib/reviewer-viewed/main';

test('raw diff gives base blobs, and reviewed blobs only when committed', () => {
  const raw = [
    ':100644 100644 aaaa 0000000000 M', 'src/a.ts',
    ':000000 100644 0000000000 bbbb A', 'src/b.ts',
    '',
  ].join('\0');
  expect(parseRaw(raw)).toEqual({ base: { 'src/a.ts': 'aaaa', 'src/b.ts': '0000000000' }, side: { 'src/b.ts': 'bbbb' } });
});

test('statuses follow the reviewer panel', () => {
  expect(statusOf('?', true)).toBe('A');
  expect(statusOf('D', false)).toBe('D');
  expect(statusOf('T', false)).toBe('M');
});

test('fingerprints match the mod format, deleted files without a reviewed side', () => {
  expect(fingerprint({ path: 'x', status: 'M' }, { x: 'old' }, { x: 'new' })).toBe('M:old:new');
  expect(fingerprint({ path: 'x', status: 'A' }, {}, { x: 'new' })).toBe('A:-:new');
  expect(fingerprint({ path: 'x', status: 'D' }, { x: 'old' }, {})).toBe('D:old:-');
});

test('globs match repo paths, and a folder matches what is under it', () => {
  expect(matches('src/lib/a.test.ts', ['**/*.test.ts'])).toBe(true);
  expect(matches('src/lib/a.ts', ['**/*.test.ts'])).toBe(false);
  expect(matches('src/lib/a.ts', ['src/lib/'])).toBe(true);
  expect(matches('src/lib/a.ts', ['./src/lib/a.ts'])).toBe(true);
});

test('marking keeps other files and scopes; clearing the last mark drops the scope', () => {
  const marks = { ':r:work': { a: '1' }, ':r:last': { z: '9' } };
  expect(applyMarks(marks, ':r:work', { b: '2' })).toEqual({ ':r:work': { a: '1', b: '2' }, ':r:last': { z: '9' } });
  expect(applyMarks(marks, ':r:work', { a: null })).toEqual({ ':r:last': { z: '9' } });
});
