import * as ts from 'typescript';
import type {Entry, GraphNode, GraphEdge} from './model';

// A syntax-only first pass. No project code, scripts, or network requests execute.
const excluded = /(^|\/)(node_modules|\.git|dist|build|coverage|\.next|vendor)(\/|$)/;
const maxFileSize = 1_000_000;
const maxFiles = 500;
const maxBytes = 20_000_000;
const humanize = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ');

function inspect(text: string, path: string, id: string): Entry | undefined {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const localFunctions = new Map<string, ts.Node>();
  const bindings: {tag: string; event: string; handler: string; local: boolean; line: number}[] = [];
  let hasJsx = false;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) localFunctions.set(node.name.text, node);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
      localFunctions.set(node.name.text, node.initializer);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      hasJsx = true;
      for (const prop of node.attributes.properties) {
        if (!ts.isJsxAttribute(prop) || !/^on[A-Z]/.test(prop.name.getText(source))) continue;
        const expression = prop.initializer && ts.isJsxExpression(prop.initializer)
          ? prop.initializer.expression : undefined;
        if (!expression) continue;
        const inline = ts.isArrowFunction(expression) || ts.isFunctionExpression(expression);
        bindings.push({
          tag: node.tagName.getText(source), event: prop.name.getText(source),
          handler: inline ? 'Inline handler' : ts.isIdentifier(expression) ? expression.text : 'Unresolved expression',
          local: inline,
          line: source.getLineAndCharacterOfPosition(prop.getStart(source)).line + 1,
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!hasJsx) return undefined;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const shown = bindings.slice(0, 10);
  shown.forEach((binding, index) => {
    const control = `control-${index}`;
    const handler = `handler-${index}`;
    nodes.push({id: control, label: binding.tag, detail: `JSX control · line ${binding.line}`, x: 40, y: index * 120});
    nodes.push({id: handler, label: humanize(binding.handler),
      detail: binding.local ? 'Inline handler syntax found' : localFunctions.has(binding.handler)
        ? 'Same-file handler candidate; scope not resolved' : 'Target not resolved by this pass', x: 370, y: index * 120});
    edges.push({source: control, target: handler, label: binding.event});
  });
  if (!shown.length) nodes.push({id: 'component', label: 'JSX component', detail: 'No explicit event bindings found', x: 150, y: 160});
  const base = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  const label = base === 'index' || base === 'page' ? path.split('/').slice(-2, -1)[0] || base : base;
  return {id, parentId: 'ui', label: humanize(label), status: 'Syntax-extracted',
    description: `JSX structure in ${path}. These are source bindings, not observed execution.`,
    nodes, edges, evidence: [path, ...shown.map(binding => `${path}:${binding.line} — ${binding.event}`)],
    rules: [
      'Syntax-only extraction; imported handlers and component contracts are not resolved.',
      `${bindings.length} event bindings found; ${shown.length} shown.`,
      ...((source as ts.SourceFile & {parseDiagnostics?: readonly ts.Diagnostic[]}).parseDiagnostics?.length
        ? ['This file has parse diagnostics; results may be incomplete.'] : []),
    ]};
}

export async function importProject(files: File[]): Promise<{name: string; entries: Entry[]; summary: string}> {
  const relative = (file: File) => (file.webkitRelativePath || file.name).replace(/\\/g, '/');
  const sorted = [...files].sort((a, b) => relative(a).localeCompare(relative(b), 'en'));
  const first = sorted.find(file => !excluded.test(relative(file)));
  if (!first) throw new Error('No project files found. Select a project folder.');
  const name = first.webkitRelativePath ? relative(first).split('/')[0] : 'Imported project';
  const candidates = sorted.filter(file => !excluded.test(relative(file)) && /\.[jt]sx$/i.test(file.name));
  let bytes = 0;
  let skipped = 0;
  let scanned = 0;
  const screens: Entry[] = [];
  for (const file of candidates) {
    if (scanned >= maxFiles || file.size > maxFileSize || bytes + file.size > maxBytes) { skipped++; continue; }
    bytes += file.size;
    scanned++;
    const path = file.webkitRelativePath ? relative(file).split('/').slice(1).join('/') : relative(file);
    const entry = inspect(await file.text(), path, `file:${path}`);
    if (entry) screens.push(entry);
  }
  const rootNodes: GraphNode[] = [
    {id: 'ui', label: 'User interface', detail: `${screens.length} JSX files found`, targetId: 'ui', x: 60, y: 100},
    {id: 'background', label: 'Background behavior', detail: 'Not assessed', targetId: 'background', x: 360, y: 100},
    {id: 'data', label: 'Data', detail: 'Not assessed', targetId: 'data', x: 660, y: 100},
    {id: 'scheduled', label: 'Scheduled work', detail: 'Not assessed', targetId: 'scheduled', x: 210, y: 300},
    {id: 'integrations', label: 'Integrations', detail: 'Not assessed', targetId: 'integrations', x: 510, y: 300},
  ];
  const summary = `${scanned} JSX files scanned · ${screens.length} contain JSX · ${skipped} skipped by size/count limits. Local syntax only; no project code executed.`;
  const entries: Entry[] = [
    {id: 'project', label: name, status: 'Syntax import', description: summary, nodes: rootNodes, edges: [],
      rules: ['Only JSX files are analyzed in this initial importer.', 'Ownership folders are organizational scaffolding; no cross-domain relationships have been inferred.']},
    {id: 'ui', parentId: 'project', label: 'User interface', status: 'Syntax-extracted', description: 'JSX files, not automatically verified screens. Open a file to inspect its explicit event bindings.',
      nodes: screens.map((entry, index) => ({id: entry.id, label: entry.label, detail: entry.evidence?.[0],
        targetId: entry.id, x: (index % 3) * 300, y: Math.floor(index / 3) * 140})), edges: []},
    ...rootNodes.slice(1).map(node => ({id: node.id, parentId: 'project', label: node.label, status: 'Not assessed',
      description: 'Not assessed by the current JSX importer. An empty graph does not mean this project has no such behavior.',
      nodes: [], edges: [], rules: ['Requires additional deterministic extraction and bounded interpretation.']})),
    ...screens,
  ];
  return {name, entries, summary};
}
