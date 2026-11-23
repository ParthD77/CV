export type GraphNode = { id: string; label: string; detail?: string; targetId?: string; x: number; y: number };
export type GraphEdge = { source: string; target: string; label: string };
export type Entry = {
  id: string; parentId?: string; label: string; description: string;
  status?: string; nodes: GraphNode[]; edges: GraphEdge[]; evidence?: string[]; rules?: string[];
};

const node = (id: string, label: string, x: number, y: number, targetId?: string, detail?: string): GraphNode => ({ id, label, x, y, targetId, detail });
const edge = (source: string, target: string, label: string): GraphEdge => ({ source, target, label });
const mapSource = 'app/(tabs)/map.tsx';
const storeSource = 'src/store/AppContext.tsx';

// Curated architectural interpretation of inspected GetOut source. This is not an automated import or runtime trace.
export const entries: Entry[] = [
  {
    id: 'project', label: 'GetOut', description: 'Discover places, share with circles, and plan trips. This sample focuses on the inspected Explore flow.', status: 'Curated sample',
    nodes: [node('integrations', 'Integrations', 10, 180, 'integrations', 'Supabase and device location'), node('background', 'Background behavior', 240, 180, 'background', 'Session and data refresh'), node('data', 'Data', 470, 180, 'data', 'Shared application state'), node('ui', 'User interface', 700, 180, 'ui', 'Screens and interactions')],
    edges: [edge('data', 'ui', 'provides state'), edge('background', 'data', 'refreshes'), edge('integrations', 'background', 'returns records')], evidence: [mapSource, storeSource, 'src/hooks/useLocation.ts'],
  },
  {
    id: 'ui', parentId: 'project', label: 'User interface', description: 'Screens and their owned interactions. Explore has detailed sample architecture; other screens are boundaries.',
    nodes: [node('explore', 'Explore', 60, 150, 'explore', 'Map, filters, spot selection'), node('details', 'Spot details', 370, 150, undefined, 'Destination outside this sample'), node('other', 'Other screens', 60, 360, undefined, 'Feed · Circles · Trips')], edges: [edge('explore', 'details', 'opens selected spot')], evidence: [mapSource],
  },
  {
    id: 'explore', parentId: 'ui', label: 'Explore', description: 'Filter loaded spots, select a map pin, or center the map on the device location.',
    nodes: [node('spots', 'Loaded spots', 20, 90, 'spots'), node('filters', 'Map filters', 300, 90, 'filters', 'Source, categories, tags'), node('pins', 'Pin selection', 590, 90, 'pins', 'Preview and details'), node('location', 'Center on location', 300, 340, 'location', 'Request coordinates, move map')],
    edges: [edge('spots', 'filters', 'supplies spots'), edge('filters', 'pins', 'determines available pins')], evidence: [mapSource], rules: ['Moving the map does not issue an area-based request in this screen.', 'Shared inputs include spots, likes, and circles.'],
  },
  {
    id: 'filters', parentId: 'explore', label: 'Map filters', description: 'Compute map eligibility locally from loaded spots and the current selections.',
    nodes: [node('loaded', 'Loaded spots', 10, 180, 'spots'), node('source', 'Match source', 240, 180, 'source', 'All · Public · Circle'), node('tags', 'Match types or tags', 470, 180, 'types', 'Category OR tag'), node('render', 'Render map pins', 700, 180, 'eligibility', 'Coordinates required')],
    edges: [edge('loaded', 'source', 'spots'), edge('source', 'tags', 'source matches'), edge('tags', 'render', 'matching spots')], evidence: [mapSource + ' · mappable'], rules: ['Source, coordinate, and type/tag conditions all apply.', 'With no category or tag selected, retain every source match.', 'Changing a source, category, or tag clears the selected pin.'],
  },
  {
    id: 'source', parentId: 'filters', label: 'Source selection', description: 'Determine whether each spot belongs to the chosen source.',
    nodes: [node('selected', 'Selected source', 40, 180), node('rule', 'Check source', 310, 180, undefined, 'All / Public / Circle'), node('kept', 'Source matches', 620, 180)], edges: [edge('selected', 'rule', 'selects rule'), edge('rule', 'kept', 'keeps matching spots')], evidence: [mapSource + ' · source / mappable'], rules: ['All keeps every source.', 'Public requires is_public.', 'A circle requires circle_ids to include the selected circle.'],
  },
  {
    id: 'types', parentId: 'filters', label: 'Type and tag selection', description: 'A spot matches any selected category or tag. No selections bypass this condition.',
    nodes: [node('category', 'Category matches', 40, 90), node('tag', 'Tag matches', 40, 260), node('empty', 'No filters selected', 40, 430), node('any', 'Any condition holds', 360, 260, undefined, 'OR'), node('include', 'Include spot', 670, 260)], edges: [edge('category', 'any', 'or'), edge('tag', 'any', 'or'), edge('empty', 'any', 'or'), edge('any', 'include', 'passes filter')], evidence: [mapSource + ' · mappable', 'src/lib/tags.ts · normalizeTag'], rules: ['Categories and tags use OR, not AND.', 'Tags are normalized before comparison.'],
  },
  {
    id: 'eligibility', parentId: 'filters', label: 'Pin eligibility', description: 'Only spots passing all filters and the coordinate truthiness check generate markers.',
    nodes: [node('spots', 'Candidate spots', 30, 180), node('coordinates', 'Coordinate check', 310, 180, undefined, 'Latitude and longitude are truthy'), node('markers', 'Map markers', 620, 180)], edges: [edge('spots', 'coordinates', 'check each spot'), edge('coordinates', 'markers', 'eligible spots')], evidence: [mapSource + ' · mappable / Marker'], rules: ['The coordinate check excludes zero-valued latitude or longitude.', 'This is a truthiness check, not coordinate validation.'],
  },
  {
    id: 'pins', parentId: 'explore', label: 'Pin selection', description: 'Selecting a marker reveals its spot preview; opening the preview navigates to details.',
    nodes: [node('tap', 'Tap map pin', 30, 180), node('select', 'Select matching spot', 300, 180, undefined, 'Selection ID within filtered spots'), node('preview', 'Show spot preview', 570, 180), node('details', 'Open spot details', 570, 390)], edges: [edge('tap', 'select', 'sets selection'), edge('select', 'preview', 'shows'), edge('preview', 'details', 'tap preview')], evidence: [mapSource + ' · selectedId / selected / router.push'], rules: ['Tapping the map clears selection.', 'A selection outside the filtered spots has no preview.'],
  },
  {
    id: 'location', parentId: 'explore', label: 'Center on location', description: 'Request foreground location access and center the map after obtaining coordinates.',
    nodes: [node('tap', 'Tap location button', 20, 180), node('request', 'Request location', 270, 180, 'device', 'Requires permission'), node('center', 'Animate map region', 570, 180)], edges: [edge('tap', 'request', 'requests'), edge('request', 'center', 'if coordinates returned')], evidence: [mapSource + ' · center', 'src/hooks/useLocation.ts · request'], rules: ['Denied permission returns no coordinates.', 'The location hook also requests location when mounted.', 'Location lookup includes reverse geocoding.'],
  },
  {
    id: 'background', parentId: 'project', label: 'Background behavior', description: 'Shared lifecycle behavior in the application provider; not an operating-system background service.',
    nodes: [node('session', 'Session initialized or changed', 20, 180), node('refresh', 'Refresh app data', 310, 180), node('state', 'Update shared state', 620, 180, 'data')], edges: [edge('session', 'refresh', 'triggers when ready'), edge('refresh', 'state', 'returns records')], evidence: [storeSource + ' · refresh / useEffect'], rules: ['Public cached spots are restored during initialization.', 'Refresh loads up to 250 spot records, newest first.', 'Authenticated refresh also loads user and circle-related records.'],
  },
  {
    id: 'data', parentId: 'project', label: 'Data', description: 'Shared application state and persistence boundaries referenced by the inspected flows.',
    nodes: [node('remote', 'Supabase records', 30, 100, 'supabase'), node('cache', 'Public spot cache', 30, 350), node('spots', 'Spots', 350, 180, 'spots'), node('screen', 'Explore', 650, 180, 'explore')], edges: [edge('remote', 'spots', 'refreshes'), edge('cache', 'spots', 'restores at startup'), edge('spots', 'screen', 'provides state')], evidence: [storeSource],
  },
  {
    id: 'spots', parentId: 'data', label: 'Spots', description: 'Shared spot state is restored from public cache and refreshed from Supabase. Blocked owners are filtered before consumers receive it.',
    nodes: [node('records', 'Spot records', 30, 180, 'supabase'), node('state', 'Shared spot state', 320, 180), node('consumer', 'Explore filters', 620, 180, 'filters')], edges: [edge('records', 'state', 'normalize and store'), edge('state', 'consumer', 'exclude blocked owners')], evidence: [storeSource + ' · refresh / AppValue'], rules: ['Refresh requests up to 250 records ordered newest first.', 'Public spots are cached locally.', 'Database authorization is an external boundary in this sample.'],
  },
  { id: 'scheduled', parentId: 'project', label: 'Scheduled work', description: 'No scheduler analysis has been performed. This does not establish that scheduled work is absent.', status: 'Not assessed', nodes: [], edges: [] },
  {
    id: 'integrations', parentId: 'project', label: 'Integrations', description: 'External boundaries referenced by the inspected application flows.',
    nodes: [node('supabase', 'Supabase', 60, 130, 'supabase', 'Records, auth, storage'), node('device', 'Device location', 60, 350, 'device', 'Permission and coordinates'), node('data', 'App data', 420, 130, 'data'), node('map', 'Explore map', 420, 350, 'location')], edges: [edge('supabase', 'data', 'returns records'), edge('device', 'map', 'supplies coordinates')], evidence: [storeSource, 'src/hooks/useLocation.ts'],
  },
  { id: 'supabase', parentId: 'integrations', label: 'Supabase', description: 'Client-side record, authentication, and storage boundary. Live schema and policies have not been inspected.', status: 'External boundary', nodes: [node('client', 'Supabase client', 80, 180), node('records', 'Record queries', 410, 180)], edges: [edge('client', 'records', 'requests')], evidence: ['src/lib/supabase.ts', storeSource] },
  { id: 'device', parentId: 'integrations', label: 'Device location', description: 'Foreground permission, balanced-accuracy location lookup, and reverse geocoding.', nodes: [node('permission', 'Foreground permission', 20, 180), node('coordinates', 'Current coordinates', 300, 180), node('address', 'Reverse geocode', 610, 180)], edges: [edge('permission', 'coordinates', 'if granted'), edge('coordinates', 'address', 'looks up jurisdiction')], evidence: ['src/hooks/useLocation.ts'] },
];
