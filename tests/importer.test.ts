import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importProject} from '../src/importer.ts';

function file(path: string, source = '', size = source.length, onRead?: () => void): File {
  return {name: path.split('/').pop()!, webkitRelativePath: path, size,
    text: async () => { onRead?.(); return source; }} as File;
}
const screen = `export default function Screen() {
  const onSave = () => {};
  return <button onClick={onSave}>Save</button>;
}`;
const sourceEntries = (result: Awaited<ReturnType<typeof importProject>>) =>
  result.entries.filter(entry => entry.id.startsWith('file:'));

test('input order does not change graph output or identities', async () => {
  const files = [file('Demo/app/settings.tsx', screen), file('Demo/app/index.tsx', screen)];
  const first = await importProject(files);
  const second = await importProject([...files].reverse());
  assert.deepEqual(first, second);
  assert.equal(first.name, 'Demo');
  assert.deepEqual(sourceEntries(first).map(entry => entry.id), ['file:app/index.tsx', 'file:app/settings.tsx']);
});

test('excluded directories and non-JSX files are never read or executed', async () => {
  const unread = () => { throw new Error('Excluded file was read'); };
  const files = ['node_modules/x.tsx', '.git/x.tsx', 'dist/x.tsx', 'build/x.tsx',
    'coverage/x.tsx', '.next/x.tsx', 'vendor/x.tsx', '.env', 'package.json', 'script.ts']
    .map(path => file(`Demo/${path}`, screen, screen.length, unread));
  const marker = '__visualizerImporterExecuted';
  const result = await importProject([...files, file('Demo/app.tsx', `globalThis.${marker} = true; ${screen}`)]);
  assert.equal(sourceEntries(result).length, 1);
  assert.equal((globalThis as Record<string, unknown>)[marker], undefined);
});

test('extracts source event bindings, preserves evidence and marks unresolved targets', async () => {
  const result = await importProject([file('Demo/app.tsx', `import {save} from './save';
    export default () => <><button onClick={save}/><input onChange={() => {}}/><Widget onSelect={controller.select}/></>;`)]);
  const entry = sourceEntries(result)[0];
  assert.deepEqual(entry.edges.map(edge => edge.label), ['onClick', 'onChange', 'onSelect']);
  assert.equal(entry.nodes[1].detail, 'Target not resolved by this pass');
  assert.equal(entry.nodes[3].detail, 'Inline handler syntax found');
  assert.equal(entry.nodes[5].detail, 'Target not resolved by this pass');
  assert.ok(entry.evidence?.some(reference => reference.startsWith('app.tsx:')));
  assert.equal(entry.status, 'Syntax-extracted');
  for (const id of ['background', 'data', 'scheduled', 'integrations']) {
    assert.equal(result.entries.find(item => item.id === id)?.status, 'Not assessed');
  }
});

test('a same-named function in another scope is a candidate, never claimed resolved', async () => {
  const result = await importProject([file('Demo/app.tsx', `function other() { const save = () => {}; }
    export default function Screen({save}) { return <button onClick={save}/>; }`)]);
  assert.equal(sourceEntries(result)[0].nodes[1].detail, 'Same-file handler candidate; scope not resolved');
});

test('plain syntax and implicit spread bindings are not fabricated into event edges', async () => {
  const result = await importProject([file('Demo/plain.tsx', 'export const value = 1;'),
    file('Demo/app.tsx', 'export default () => <Widget {...props}/>;')]);
  assert.equal(sourceEntries(result).length, 1);
  assert.deepEqual(sourceEntries(result)[0].edges, []);
  assert.equal(sourceEntries(result)[0].nodes[0].detail, 'No explicit event bindings found');
});

test('malformed syntax exposes an incompleteness warning', async () => {
  const result = await importProject([file('Demo/app.tsx', 'const x = <button onClick={() => {}};')]);
  assert.ok(sourceEntries(result)[0].rules?.some(rule => rule.includes('parse diagnostics')));
});

test('per-file size and file count caps skip reads and disclose skipped files', async () => {
  let reads = 0;
  const files = Array.from({length: 501}, (_, i) => file(`Demo/${String(i).padStart(3, '0')}.tsx`, '', 1, () => reads++));
  files.unshift(file('Demo/large.tsx', '', 1_000_001, () => { throw new Error('Large file was read'); }));
  const result = await importProject(files);
  assert.equal(reads, 500);
  assert.match(result.summary, /500 JSX files scanned/);
  assert.match(result.summary, /2 skipped/);
});

test('total byte cap prevents further reads', async () => {
  let reads = 0;
  const files = Array.from({length: 21}, (_, i) => file(`Demo/${String(i).padStart(2, '0')}.tsx`, '', 1_000_000, () => reads++));
  const result = await importProject(files);
  assert.equal(reads, 20);
  assert.match(result.summary, /1 skipped/);
});

test('graph binding cap is disclosed rather than silently presented as complete', async () => {
  const text = `export default () => <>${'<button onClick={() => {}}/>'.repeat(12)}</>;`;
  const result = await importProject([file('Demo/app.tsx', text)]);
  assert.equal(sourceEntries(result)[0].edges.length, 10);
  assert.ok(sourceEntries(result)[0].rules?.includes('12 event bindings found; 10 shown.'));
});

test('empty or entirely excluded selection rejects with actionable error', async () => {
  await assert.rejects(importProject([]), /Select a project folder/);
  await assert.rejects(importProject([file('Demo/node_modules/a.tsx')]), /Select a project folder/);
});
