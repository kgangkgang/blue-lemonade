// Synthetic facts only: no browser, network, saved chats, or private fixtures.
// Usage: node tools/tests/chat-graph.mjs [theme-root]
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
const root = path.resolve(process.argv[2] || '.');
const { buildChatGraph, collectBranchHints } = await import(pathToFileURL(path.join(root, 'src/chat-graph-data.js')));
const { layoutChatGraph } = await import(pathToFileURL(path.join(root, 'src/chat-graph.js')));

const results = [];
const test = (name, run) => {
    const start = performance.now();
    try { run(); results.push({ name, passed: true, ms: Math.round((performance.now() - start) * 100) / 100 }); }
    catch (error) { results.push({ name, passed: false, error: error.stack }); }
};
const node = (graph, id) => graph.nodes.find(n => n.id === id);
const row = (id, parent, extra = {}) => ({ id, metadata: parent === undefined ? {} : { main_chat: parent }, ...extra });

test('Only saved parent metadata creates edges; branch-like names and hints do not', () => {
    const graph = buildChatGraph([row('Main'), row('Main - Branch #1'), { id: 'Main - Branch #2' }], {
        branchHints: [{ parentId: 'Main', childId: 'Main - Branch #1', messageId: 0, kind: 'branch' }],
    });
    assert.deepEqual(graph.edges, []);
    assert.equal(node(graph, 'Main - Branch #1').status, 'root');
    assert.equal(node(graph, 'Main - Branch #2').status, 'unknown');
    assert.equal(graph.ignoredHintCount, 1);
});

test('Known empty metadata differs from metadata still loading', () => {
    const graph = buildChatGraph([{ id: 'unknown' }, { id: 'null', metadata: null }, { id: 'array', metadata: [] }, row('root')]);
    assert.deepEqual(graph.nodes.map(n => [n.status, n.metadataLoaded]), [['unknown', false], ['unknown', false], ['unknown', false], ['root', true]]);
});

test('Immediate parent produces nested depth and preserves current node', () => {
    const graph = buildChatGraph([row('grandchild', 'child'), row('root'), row('child', 'root')], { currentId: 'child' });
    assert.deepEqual(graph.roots, ['root']);
    assert.deepEqual(graph.nodes.map(n => [n.id, n.depth, n.rootId, n.current]), [['grandchild', 2, 'root', false], ['root', 0, 'root', false], ['child', 1, 'root', true]]);
    assert.deepEqual(node(graph, 'root').children, ['child']);
    assert.equal(graph.edges[0].source, 'main_chat');
});

test('Branch and checkpoint hints locate zero-based message IDs without reading text', () => {
    const message = extra => ({ extra, get mes() { throw new Error('Message text must not be read'); } });
    const hints = collectBranchHints('root', [message({ branches: ['branch', 'branch'] }), null, message({ bookmark_link: 'checkpoint' })]);
    assert.deepEqual(hints, [{ parentId: 'root', childId: 'branch', messageId: 0, kind: 'branch' }, { parentId: 'root', childId: 'checkpoint', messageId: 2, kind: 'checkpoint' }]);
    const graph = buildChatGraph([row('root', undefined, { messageCount: 3 }), row('branch', 'root'), row('checkpoint', 'root')], { branchHints: hints });
    assert.deepEqual(graph.edges.map(e => [e.childId, e.messageId, e.kind]), [['branch', 0, 'branch'], ['checkpoint', 2, 'checkpoint']]);
});

test('main_chat alone cannot distinguish checkpoint from branch', () => {
    const graph = buildChatGraph([row('root'), row('child', 'root')]);
    assert.equal(graph.edges[0].kind, 'unknown');
    assert.equal(graph.edges[0].messageId, null);
});

test('Inherited branch hints cannot reparent a sibling or repair missing metadata', () => {
    const hints = collectBranchHints('copied-child', [{ extra: { branches: ['sibling', 'unknown-child'] } }]);
    const graph = buildChatGraph([row('root'), row('copied-child', 'root'), row('sibling', 'root'), { id: 'unknown-child' }], { branchHints: hints });
    assert.equal(node(graph, 'sibling').parentId, 'root');
    assert.equal(node(graph, 'sibling').branchMessageId, null);
    assert.equal(node(graph, 'unknown-child').parentId, null);
    assert.equal(graph.ignoredHintCount, 2);
});

test('Renamed or deleted parent stays unresolved; no filename or inherited-extra repair', () => {
    const graph = buildChatGraph([row('renamed root'), row('child', 'old root')], { branchHints: collectBranchHints('renamed root', [{ extra: { branches: ['child'] } }]) });
    assert.equal(node(graph, 'child').status, 'missing-parent');
    assert.equal(node(graph, 'child').declaredParentId, 'old root');
    assert.deepEqual(graph.edges, []);
    assert.equal(graph.nodes.length, 2);
});

test('Renamed child keeps proven parent but stale old-name hint is ignored', () => {
    const graph = buildChatGraph([row('root'), row('renamed child', 'root')], { branchHints: collectBranchHints('root', [{ extra: { branches: ['old child'] } }]) });
    assert.equal(graph.edges[0].childId, 'renamed child');
    assert.equal(graph.edges[0].messageId, null);
    assert.equal(graph.ignoredHintCount, 1);
});

test('Exact IDs preserve case, whitespace, suffix and prototype-like names', () => {
    const graph = buildChatGraph([row('Root.jsonl'), row('__proto__', 'Root.jsonl'), row('constructor', '__proto__'), row(' Root ', 'Root.jsonl'), row('lower', 'root.jsonl')]);
    assert.equal(node(graph, '__proto__').depth, 1);
    assert.equal(node(graph, 'constructor').depth, 2);
    assert.equal(node(graph, ' Root ').parentId, 'Root.jsonl');
    assert.equal(node(graph, 'lower').status, 'missing-parent');
});

test('Self-reference is rejected and reported', () => {
    const graph = buildChatGraph([row('self', 'self')]);
    assert.equal(graph.nodes[0].status, 'self-parent');
    assert.equal(graph.nodes[0].parentId, null);
    assert.equal(graph.nodes[0].declaredParentId, 'self');
    assert.equal(graph.edges.length, 0);
});

test('Every internal cycle edge is removed; external descendants remain connected', () => {
    const graph = buildChatGraph([row('descendant', 'a'), row('a', 'b'), row('b', 'c'), row('c', 'a')]);
    assert.deepEqual(graph.roots, ['a', 'b', 'c']);
    assert.deepEqual(graph.edges.map(e => [e.parentId, e.childId]), [['a', 'descendant']]);
    assert.deepEqual(graph.nodes.map(n => n.status), ['linked', 'cycle', 'cycle', 'cycle']);
    assert.equal(node(graph, 'descendant').depth, 1);
    assert.equal(graph.issues.filter(i => i.code === 'cycle').length, 3);
});

test('Same-ID duplicates merge agreeing metadata and unknown copies', () => {
    const graph = buildChatGraph([{ id: 'child' }, row('child', 'root'), row('root'), row('child', 'root', { messageCount: 4 })]);
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 1);
    assert.equal(node(graph, 'child').messageCount, 4);
    assert.equal(graph.issues[0].code, 'duplicate-record');
    assert.equal(graph.issues[0].count, 3);
});

test('Conflicting duplicate parent or root facts never choose an arbitrary parent', () => {
    for (const second of [row('child', 'other'), row('child')]) {
        const graph = buildChatGraph([row('root'), row('other'), row('child', 'root'), second]);
        assert.equal(node(graph, 'child').status, 'duplicate-conflict');
        assert.equal(graph.edges.length, 0);
    }
});

test('Malformed explicit parent is reported instead of accepted as root', () => {
    for (const parent of [0, false, [], {}]) {
        const graph = buildChatGraph([row('bad', parent)]);
        assert.equal(graph.nodes[0].status, 'invalid-parent');
        assert.equal(graph.edges.length, 0);
    }
    const graph = buildChatGraph([row('bad', 2), row('bad', 'root'), row('root')]);
    assert.equal(node(graph, 'bad').status, 'duplicate-conflict');
});

test('Ambiguous branch points remain unknown; identical hints are harmless', () => {
    const hints = collectBranchHints('root', [{ extra: { branches: ['child', 'child'] } }, { extra: { branches: ['child'] } }]);
    const graph = buildChatGraph([row('root'), row('child', 'root')], { branchHints: [...hints, hints[0]] });
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].messageId, null);
    assert.equal(graph.edges[0].kind, 'branch');
    assert.deepEqual(graph.issues[0].messageIds, [0, 1]);
});

test('Conflicting branch/checkpoint kinds do not receive a made-up kind', () => {
    const graph = buildChatGraph([row('root'), row('child', 'root')], { branchHints: collectBranchHints('root', [{ extra: { branches: ['child'], bookmark_link: 'child' } }]) });
    assert.equal(graph.edges[0].kind, 'unknown');
    assert.equal(graph.edges[0].messageId, 0);
    assert.equal(graph.issues[0].code, 'ambiguous-branch-kind');
});

test('Invalid or out-of-bounds hints are ignored while valid position zero survives', () => {
    const hints = [null, {}, { parentId: 'root', childId: 'child', messageId: -1 }, { parentId: 'root', childId: 'child', messageId: 1.5 }, { parentId: 'root', childId: 'child', messageId: 3 }, { parentId: 'root', childId: 'child', messageId: 0, kind: 'branch' }];
    const graph = buildChatGraph([row('root', undefined, { messageCount: 3 }), row('child', 'root')], { branchHints: hints });
    assert.equal(graph.ignoredHintCount, 5);
    assert.equal(graph.edges[0].messageId, 0);
});

test('Missing count allows a proven hint; zero-message parent rejects every point', () => {
    const hints = [{ parentId: 'root', childId: 'child', messageId: 50, kind: 'branch' }];
    const unknown = buildChatGraph([row('root'), row('child', 'root')], { branchHints: hints });
    const empty = buildChatGraph([row('root', undefined, { messageCount: 0 }), row('child', 'root')], { branchHints: hints });
    assert.equal(unknown.edges[0].messageId, 50);
    assert.equal(empty.edges[0].messageId, null);
});

test('Deep frozen inputs are unchanged; unrelated metadata is never examined', () => {
    const metadata = Object.freeze({ main_chat: 'root', get unrelated() { throw new Error('Unrelated metadata must not be read'); } });
    const records = Object.freeze([Object.freeze(row('root')), Object.freeze({ id: 'child', metadata })]);
    const hints = Object.freeze([Object.freeze({ parentId: 'root', childId: 'child', messageId: 0, kind: 'branch' })]);
    const graph = buildChatGraph(records, { branchHints: hints });
    graph.nodes[0].children.push('output-only');
    assert.equal(records.length, 2);
    assert.equal(hints.length, 1);
    assert.equal(metadata.main_chat, 'root');
    assert.equal(Object.hasOwn(graph.nodes[1], 'metadata'), false);
});

test('Empty and malformed record input yields a usable empty graph', () => {
    assert.deepEqual(buildChatGraph(null), { nodes: [], edges: [], roots: [], issues: [], ignoredHintCount: 0 });
    const graph = buildChatGraph([null, {}, { id: 3 }, { id: '' }, ['array']]);
    assert.equal(graph.nodes.length, 0);
    assert.equal(graph.issues.length, 5);
    assert.deepEqual(collectBranchHints('', []), []);
    assert.deepEqual(collectBranchHints('root', null), []);
});

test('20,000-node reverse-ordered chain and cycle complete without recursion', () => {
    const total = 20000;
    const records = Array.from({ length: total }, (_, i) => row(`n${i}`, i ? `n${i - 1}` : undefined)).reverse();
    const graph = buildChatGraph(records);
    assert.equal(graph.edges.length, total - 1);
    assert.equal(graph.nodes[0].depth, total - 1);
    assert.equal(graph.nodes[0].rootId, 'n0');
    records[records.length - 1].metadata.main_chat = `n${total - 1}`;
    const cycle = buildChatGraph(records);
    assert.equal(cycle.edges.length, 0);
    assert.equal(cycle.roots.length, total);
    assert.ok(cycle.nodes.every(n => n.status === 'cycle'));
});

const records=[{id:'unrelated',metadata:{}},{id:'grandchild',metadata:{main_chat:'left'}},{id:'right',metadata:{main_chat:'start'}},{id:'start',metadata:{}},{id:'left',metadata:{main_chat:'start'}}];
const graph=buildChatGraph(records,{currentId:'left'});
test('Mobile parent above children; two branches side by side without overlap',()=>{
 const layout=layoutChatGraph(graph,150,104,{vertical:true,currentId:'left'}),p=layout.positions;
 assert.equal(p.get('left').y,p.get('right').y);assert.ok(p.get('left').y>=p.get('start').y+104+40);
 assert.ok(Math.abs(p.get('left').x-p.get('right').x)>=168);
 assert.ok(layout.trees.get('start').width<=320);
 assert.ok(p.get('grandchild').y>p.get('left').y);
});
test('Current connected tree is first; unrelated root is a separate block below it',()=>{
 const layout=layoutChatGraph(graph,150,104,{vertical:true,currentId:'left'}),tree=layout.trees.get('start');
 assert.equal(layout.focusRootId,'start');assert.equal(tree.y,0);
 assert.ok(layout.positions.get('unrelated').y>=tree.y+tree.height+60);
 assert.ok(layout.height>tree.height);
});
test('PC remains a left-to-right tree',()=>{
 const layout=layoutChatGraph(graph),p=layout.positions;
 assert.equal(layout.vertical,false);assert.ok(p.get('left').x>p.get('start').x);
 assert.equal(p.get('left').x,p.get('right').x);assert.ok(p.get('grandchild').x>p.get('left').x);
});
test('Every node stays within its own tree bounds in either orientation',()=>{
 for(const vertical of [false,true]){
  const layout=layoutChatGraph(graph,150,104,{vertical});
  for(const node of graph.nodes){const p=layout.positions.get(node.id),tree=layout.trees.get(node.rootId);assert.ok(p.x>=tree.x&&p.y>=tree.y&&p.x+p.width<=tree.x+tree.width&&p.y+p.height<=tree.y+tree.height);}
 }
});
test('Large selected font scales dimensions rather than shrinking font setting',()=>{
 const layout=layoutChatGraph(graph,32*10.7,32*7.5,{vertical:true});
 assert.equal(layout.positions.get('start').width,342.4);assert.equal(layout.positions.get('start').height,240);
});
test('Long vertical chain stays iterative and finite',()=>{
 const size=20000,g=buildChatGraph(Array.from({length:size},(_,i)=>({id:String(i),metadata:i?{main_chat:String(i-1)}:{}}))),layout=layoutChatGraph(g,150,104,{vertical:true});
 assert.equal(layout.positions.size,size);assert.equal(layout.positions.get(String(size-1)).y,(size-1)*146);assert.ok(Number.isFinite(layout.height));
});

const passed = results.filter(result => result.passed).length;
console.log(`${passed}/${results.length} chat graph tests passed`);
for (const result of results.filter(result => !result.passed)) console.error(result.name, result.error);
if (passed !== results.length) process.exitCode = 1;
