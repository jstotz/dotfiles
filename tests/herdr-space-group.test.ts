import { expect, test } from 'bun:test';
import { assign, nest, parse, parseFile, remove, rename, resolveSpace, setPinned, within } from '../home/dot_local/lib/herdr-space-group/main';

const fresh = () => parse(JSON.stringify({ groups: [
  { name: 'customer-agent', spaces: ['a', 'b'], pinned: ['b'] },
  { name: 'reviews', spaces: ['c'], pinned: [] },
] }));

test('moving a space leaves its old group and its pin behind', () => {
  const groups = fresh();
  assign(groups, 'b', 'reviews');
  expect(groups[0]).toEqual({ name: 'customer-agent', spaces: ['a'], pinned: [] });
  expect(groups[1].spaces).toEqual(['c', 'b']);
});

test('moving to a new name makes the group; default means no group', () => {
  const groups = fresh();
  assign(groups, 'a', 'explorations');
  expect(groups.map((g) => g.name)).toEqual(['customer-agent', 'reviews', 'explorations']);
  assign(groups, 'a', 'default');
  expect(groups.some((g) => g.spaces.includes('a'))).toBe(false);
});

test('pins need a group and keep pin order', () => {
  const groups = fresh();
  setPinned(groups, 'a', true);
  expect(groups[0].pinned).toEqual(['b', 'a']);
  expect(() => setPinned(groups, 'z', true)).toThrow('no group');
});

test('renaming onto an existing group merges them; default is reserved', () => {
  const groups = fresh();
  rename(groups, 'reviews', 'customer-agent');
  expect(groups).toEqual([{ name: 'customer-agent', spaces: ['a', 'b', 'c'], pinned: ['b'] }]);
  expect(() => rename(groups, 'customer-agent', 'default')).toThrow('ungrouped');
});

test('deleting a group returns its spaces to default', () => {
  const groups = fresh();
  remove(groups, 'reviews');
  expect(groups.map((g) => g.name)).toEqual(['customer-agent']);
});

test('spaces resolve by id, unique name or current', () => {
  const list = () => [{ id: 'sp1', name: 'ca-epic' }, { id: 'sp2', name: 'dup' }, { id: 'sp3', name: 'dup' }];
  expect(resolveSpace('sp2', list, () => 'x')).toBe('sp2');
  expect(resolveSpace('ca-epic', list, () => 'x')).toBe('sp1');
  expect(resolveSpace('current', list, () => 'sp9')).toBe('sp9');
  expect(() => resolveSpace('dup', list, () => 'x')).toThrow('several');
  expect(() => resolveSpace('nope', list, () => 'x')).toThrow('no space');
});

test('a damaged file reads as no groups', () => {
  expect(parse('not json')).toEqual([]);
  expect(parse(JSON.stringify({ groups: [{ name: '' }, { name: 'ok', spaces: [1, 'x'] }] }))).toEqual([
    { name: 'ok', spaces: ['x'], pinned: [] },
  ]);
});

test('parents refuse loops and survive parsing', () => {
  const parents: Record<string, string> = {};
  nest(parents, 'child', 'epic');
  nest(parents, 'grandchild', 'child');
  expect(within(parents, 'grandchild', 'epic')).toBe(true);
  expect(() => nest(parents, 'epic', 'grandchild')).toThrow('above it');
  expect(() => nest(parents, 'epic', 'epic')).toThrow('its own parent');
  nest(parents, 'child', null);
  expect(parents).toEqual({ grandchild: 'child' });
  expect(parseFile(JSON.stringify({ groups: [], parents: { a: 'b', c: 'c', d: 3 } })).parents).toEqual({ a: 'b' });
});
