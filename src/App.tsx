import {useState, useRef, useMemo, useEffect} from 'react';
import {ReactFlow, Background, Controls, Handle, Position, MarkerType, useNodesInitialized, useReactFlow, type NodeProps} from '@xyflow/react';
import {Stack, FolderSimple, CaretRight, CaretDown, MagnifyingGlass, ArrowLeft, ArrowRight, ArrowSquareOut, TreeStructure, UploadSimple, Crosshair, Info, X, Cube, CheckCircle, Circle, Database} from '@phosphor-icons/react';
import '@xyflow/react/dist/style.css';
import {entries as sampleEntries, type Entry} from './model';

function ArchitectureNode({data, selected}: NodeProps) {
  return <div className={`architecture-node ${data.external ? 'external' : ''} ${selected ? 'selected' : ''}`}>
    <Handle type="target" position={Position.Left}/><div className="node-label"><Cube size={17}/><strong>{String(data.label)}</strong></div>
    {data.detail ? <p>{String(data.detail)}</p> : null}
    {data.targetId ? <span className="node-open">Open component <ArrowSquareOut size={12}/></span> : null}
    <Handle type="source" position={Position.Right}/>
  </div>;
}
const nodeTypes = {architecture: ArchitectureNode};
function FitGraph(){const ready=useNodesInitialized();const {fitView}=useReactFlow();useEffect(()=>{if(ready)fitView({padding:'8%',maxZoom:1});},[ready,fitView]);return null;}

export function App() {
  const [entries, setEntries] = useState(sampleEntries);
  const [project, setProject] = useState('GetOut');
  const [currentId, setCurrent] = useState('project');
  const [open, setOpen] = useState(new Set(['project', 'ui']));
  const [selection, setSelection] = useState<string>();
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState(['project']);
  const [cursor, setCursor] = useState(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [sample, setSample] = useState(true);
  const [modal, setModal] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const current = entries.find(e=>e.id===currentId) ?? entries[0];
  const picked = current.nodes.find(n=>n.id===selection);
  const inspected = entries.find(e=>e.id===picked?.targetId) ?? current;
  const path: Entry[] = []; let ancestor: Entry | undefined = current;
  while(ancestor) { path.unshift(ancestor); ancestor = entries.find(e=>e.id===ancestor?.parentId); }
  function navigate(id:string, record=true) {
    setCurrent(id); setSelection(undefined); setQuery('');
    setOpen(old=>{const next=new Set(old); let e=entries.find(e=>e.id===id); while(e){next.add(e.id);e=entries.find(p=>p.id===e?.parentId);}return next;});
    if(record){setHistory([...history.slice(0,cursor+1),id]);setCursor(cursor+1);}
  }
  function travel(offset:number){const next=cursor+offset;if(next>=0&&next<history.length){setCursor(next);navigate(history[next],false);}}
  const nodes = useMemo(()=>current.nodes.map(n=>({id:n.id,type:'architecture',width:200,height:110,position:{x:n.x*1.15,y:n.y},data:{...n,external:!!n.targetId && entries.find(e=>e.id===n.targetId)?.parentId!==current.id},selected:selection===n.id})),[current,entries,selection]);
  const edges = useMemo(()=>current.edges.map((e,i)=>({...e,id:`edge-${i}`,type:'smoothstep',markerEnd:{type:MarkerType.ArrowClosed,width:16,height:16},style:{stroke:'#858f99',strokeWidth:1.3},labelStyle:{fill:'#aeb5bf',fontSize:11},labelBgStyle:{fill:'#16181c'},labelBgPadding:[7,4] as [number,number]})),[current]);
  function renderTree(parentId:string, depth=0):React.ReactNode {
    return entries.filter(e=>e.parentId===parentId).map(e=>{const has=entries.some(c=>c.parentId===e.id);return <div key={e.id}><div className={`tree-row ${currentId===e.id?'active':''}`} style={{paddingLeft:12+depth*17}}>
      <button className="disclosure" aria-label={`${open.has(e.id)?'Collapse':'Expand'} ${e.label}`} disabled={!has} onClick={()=>setOpen(old=>{const next=new Set(old);next.has(e.id)?next.delete(e.id):next.add(e.id);return next;})}>{has ? open.has(e.id)?<CaretDown/>:<CaretRight/>:<span/>}</button>
      <button className="tree-label" onClick={()=>navigate(e.id)}><FolderSimple size={17}/><span>{e.label}</span></button>
    </div>{has&&open.has(e.id)&&renderTree(e.id,depth+1)}</div>});
  }
  async function load(files:File[]) {
    if(!files.length)return; setBusy(true);setModal(false);setNotice('Reading supported source files locally…');
    try {const {importProject}=await import('./importer');const result=await importProject(files);setEntries(result.entries);setProject(result.name);setCurrent('project');setHistory(['project']);setCursor(0);setSelection(undefined);setOpen(new Set(['project','ui']));setSample(false);setNotice(result.summary);}
    catch(error){setNotice(error instanceof Error?error.message:'Import failed. Your current project is unchanged.');}finally{setBusy(false);}
  }
  return <div className="workspace">
    <header className="topbar"><div className="brand"><Stack size={25} weight="duotone"/><b>Visualizer</b><span className="slash">/</span><span>{project}</span><span className="sample-tag">{sample?'Sample':'Imported'}</span></div>
      <div className="search"><MagnifyingGlass size={17}/><input aria-label="Find architecture" placeholder="Find a component or behavior…" value={query} onChange={e=>setQuery(e.target.value)}/><kbd>Find</kbd>
      {query&&<div className="search-results">{entries.filter(e=>(e.label+' '+e.description).toLowerCase().includes(query.toLowerCase())).map(e=><button key={e.id} onClick={()=>navigate(e.id)}><Cube size={16}/><span>{e.label}<small>{entries.find(p=>p.id===e.parentId)?.label ?? project}</small></span><ArrowRight size={14}/></button>)}{!entries.some(e=>(e.label+' '+e.description).toLowerCase().includes(query.toLowerCase()))&&<p>No matching components</p>}</div>}</div>
      <button className="import-button" disabled={busy} onClick={()=>setModal(true)}><UploadSimple size={16}/>{busy?'Importing…':'Import project'}</button>
    </header>
    <aside className="sidebar"><div className="sidebar-heading">Architecture <TreeStructure size={16}/></div><button className={`project-row ${currentId==='project'?'active':''}`} onClick={()=>navigate('project')}><Stack size={19}/><b>{project}</b></button><nav aria-label="Architecture tree">{renderTree('project')}</nav><div className="sidebar-bottom"><span className="status-dot"/> Local workspace<small>{sample?'Curated source-backed sample':'Deterministic source inventory'}</small></div></aside>
    <main><div className="canvas-toolbar"><div className="breadcrumbs"><button aria-label="Back" disabled={cursor===0} onClick={()=>travel(-1)}><ArrowLeft size={16}/></button><button aria-label="Forward" disabled={cursor===history.length-1} onClick={()=>travel(1)}><ArrowRight size={16}/></button>{path.map((e,i)=><span key={e.id}>{i>0&&<CaretRight size={12}/>}<button onClick={()=>navigate(e.id)}>{e.id==='project'?project:e.label}</button></span>)}</div><span className="evidence-tag"><Circle size={8} weight="fill"/> {sample?'Source inspected':'Source extracted'} · Not run</span></div>
      <div className="graph-heading"><div><h1>{current.id==='project'?'Project overview':current.label}</h1><p>{current.description}</p></div><span className="level-tag">{path.length===1?'Project':path.length===2?'Domain':path.length===3?'Component':'Behavior'}</span></div>
      <div className="graph"><ReactFlow key={currentId} nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{padding:'8%',maxZoom:1}} minZoom={.25} maxZoom={1.6} nodesDraggable={false} nodesConnectable={false} onNodeClick={(_,n)=>setSelection(n.id)} onNodeDoubleClick={(_,n)=>{if(n.data.targetId)navigate(String(n.data.targetId));}} onPaneClick={()=>setSelection(undefined)} proOptions={{hideAttribution:true}}><FitGraph/><Background color="#30353d" gap={22} size={1}/><Controls showInteractive={false}/></ReactFlow>
      {!current.nodes.length&&<div className="empty"><Crosshair size={32}/><h2>No supported evidence yet</h2><p>This section has not been mapped. Absence of evidence does not mean the behavior is absent.</p></div>}
      <div className="canvas-hint"><Info size={14}/> Read left to right · Select to inspect · Double-click to open</div></div>
      <div className="canvas-footer"><span>{current.nodes.length} components <span className="dot-separator">·</span> {current.edges.length} relationships</span><span>Ownership in the tree. Relationships on the canvas.</span></div>
    </main>
    <aside className="inspector"><div className="sidebar-heading">Inspector <Info size={16}/></div><div className="inspector-body"><span className="eyebrow">{picked?'Selected component':'Current scope'}</span><h2>{picked?.label??(current.id==='project'?project:current.label)}</h2><p>{picked?.detail??current.description}</p>
    {picked?.targetId&&<button className="open-button" onClick={()=>navigate(picked.targetId!)}>Open component <ArrowSquareOut size={15}/></button>}
    <section><h3>Ownership</h3><p>{path.map(e=>e.id==='project'?project:e.label).join(' / ')}</p>{picked&&<small>{picked.targetId?'Reference to a navigable component':'Member of this scope'}</small>}</section>
    {!!inspected.rules?.length&&<section><h3>Rules & boundaries</h3><ul>{inspected.rules.map(rule=><li key={rule}>{rule}</li>)}</ul></section>}
    <section><h3>Evidence</h3><div className="supported"><CheckCircle size={16}/>{sample?'Manually inspected source':'Static extraction'}</div>{inspected.evidence?.map(e=><code key={e}>{e}</code>)}<p className="muted"><Circle size={12}/> Runtime not observed</p></section>
    <section><h3>About this map</h3><p>{sample?'This GetOut sample was curated from source inspection. It is not an automatic import or a runtime trace.':'This import extracts supported syntax locally. Architectural intent, execution paths, and database behavior are not verified.'}</p></section></div></aside>
    <footer className="statusbar"><span><span className="status-dot"/>{sample?'GetOut sample · Expo / TypeScript':'Local import · Static analysis'}</span><span>No source is uploaded</span></footer>
    {notice&&<div className="notice" role="status"><Info size={18}/><span>{notice}</span><button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X/></button></div>}
    <input ref={fileInput} type="file" multiple {...{webkitdirectory:'',directory:''}} hidden onChange={e=>{load(Array.from(e.target.files??[]));e.target.value='';}}/>
    {modal&&<div className="modal-backdrop" onClick={()=>setModal(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={e=>e.stopPropagation()}><button className="modal-close" aria-label="Close import" onClick={()=>setModal(false)}><X size={20}/></button><UploadSimple size={30}/><h2 id="import-title">Bring your project into view</h2><p>Select a project folder. Visualizer reads supported TypeScript and JSX files locally to build an initial architecture index.</p><div className="import-details"><CheckCircle/> Source stays on your machine<br/><CheckCircle/> Project code is never executed<br/><Info/> First pass: screens and event bindings</div><p className="muted">This is an early static importer. Unsupported behavior remains unmapped; no AI interpretation is used yet.</p><button className="primary" onClick={()=>fileInput.current?.click()}>Choose project folder <ArrowRight size={17}/></button><button className="text-button" onClick={()=>{setEntries(sampleEntries);setProject('GetOut');setCurrent('project');setSample(true);setSelection(undefined);setHistory(['project']);setCursor(0);setModal(false);}}>Use GetOut sample</button></div></div>}
  </div>;
}



