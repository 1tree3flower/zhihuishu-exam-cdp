// CDP 网络层抓包：不注入页面、不怕刷新
// 用法：node sniff.mjs <targetId或url片段> [等待毫秒] [输出文件]
// 流程：连 target → 开 Network 监听 → reload → 收集所有响应 → 存 JSON + 打印摘要
import { writeFileSync } from 'node:fs';

const PORT = process.env.CDP_PORT || 9223;
const BASE = `http://127.0.0.1:${PORT}`;
const all = await (await fetch(`${BASE}/json/list`)).json();
const targets = all.filter((t) => t.type === 'page');
const sub = process.argv[2] || 'dohomework';
const waitMs = Number(process.argv[3] || 8000);
const outFile = process.argv[4] || 'net_dump.json';
const target = targets.find((t) => t.url.includes(sub) || t.id === sub);
if (!target) {
  console.error('no target matching: ' + sub);
  process.exit(1);
}

const ws = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const responses = []; // {url, requestId}
let wsOpen;

await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = () => rej(new Error('ws error'));
});
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    return;
  }
  if (msg.method === 'Network.responseReceived') {
    const r = msg.params.response;
    responses.push({ requestId: msg.params.requestId, url: r.url, status: r.status, mime: r.mimeType });
  }
};

await send('Network.enable', { maxPostDataSize: 0 });
await send('Page.enable');
await send('Page.reload', { ignoreCache: false });
await new Promise((r) => setTimeout(r, waitMs));

const bodies = [];
for (const r of responses) {
  if (!/json|text\/plain|javascript/i.test(r.mime)) continue;
  try {
    const b = await send('Network.getResponseBody', { requestId: r.requestId });
    const body = b.base64Encoded ? Buffer.from(b.body, 'base64').toString('utf8') : b.body;
    bodies.push({ url: r.url, status: r.status, mime: r.mime, body: String(body).slice(0, 800000) });
  } catch (e) {}
}

writeFileSync(outFile, JSON.stringify(bodies, null, 1), 'utf8');
const interesting = bodies.filter((b) => /question|subject|exam|homework|paper/i.test(b.url));
console.log(
  JSON.stringify(
    {
      total: bodies.length,
      file: outFile,
      interesting: interesting.map((b) => b.status + ' ' + b.url.slice(0, 140)),
    },
    null,
    1
  )
);
ws.close();
