// 极简 CDP 驱动（Node 18+，零依赖）
// 用法：
//   node cdp.mjs list
//   node cdp.mjs eval "<js表达式>"   --page <targetId或url片段>
//   node cdp.mjs evalfile x.js       --page <targetId>
//   node cdp.mjs shot out.png        --page <targetId>
//   node cdp.mjs nav "<url>"         --page <targetId>
//   node cdp.mjs reload              --page <targetId>
//   node cdp.mjs click <x> <y>       --page <targetId>
// 端口：环境变量 CDP_PORT，默认 9223
const PORT = process.env.CDP_PORT || 9223;
const BASE = `http://127.0.0.1:${PORT}`;

const args = process.argv.slice(2);
const cmd = args[0];

const all = await (await fetch(`${BASE}/json/list`)).json();
const targets = all.filter((t) => t.type === 'page');

if (cmd === 'list') {
  console.log(targets.map((t) => `${t.id}\n   ${t.url}\n   title: ${t.title}`).join('\n'));
  process.exit(0);
}

let idx = 1;
let target = targets[0];
if (args[1] === '--page') {
  const sub = args[2];
  target = targets.find((t) => t.url.includes(sub) || t.id === sub) || targets[0];
  idx = 3;
}
if (!target) {
  console.error('no page target');
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
  }
};

try {
  if (cmd === 'nav') {
    console.log(JSON.stringify(await send('Page.navigate', { url: args[idx] })));
  } else if (cmd === 'reload') {
    console.log(JSON.stringify(await send('Page.reload', { ignoreCache: true })));
  } else if (cmd === 'shot') {
    const { writeFileSync } = await import('node:fs');
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(args[idx], Buffer.from(r.data, 'base64'));
    console.log('saved ' + args[idx]);
  } else if (cmd === 'click') {
    const x = Number(args[idx]);
    const y = Number(args[idx + 1]);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0 });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await new Promise((r) => setTimeout(r, 60));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    console.log(JSON.stringify({ clicked: [x, y] }));
  } else if (cmd === 'eval' || cmd === 'evalfile') {
    const { readFileSync } = await import('node:fs');
    const expression = cmd === 'evalfile' ? readFileSync(args[idx], 'utf8') : args[idx];
    const r = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    });
    if (r.exceptionDetails) {
      console.error('EXC: ' + JSON.stringify(r.exceptionDetails).slice(0, 800));
      process.exit(2);
    }
    const v = r.result?.value;
    console.log(typeof v === 'string' ? v : JSON.stringify(v));
  } else {
    console.error('unknown cmd: ' + cmd);
    process.exit(1);
  }
} finally {
  ws.close();
}
