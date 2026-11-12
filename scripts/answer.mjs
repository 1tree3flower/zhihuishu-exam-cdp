// 一键作答：读 answers.json，按选项 id 精确点选 + 自动翻页，跑完一整章
// 用法：node answer.mjs <targetId或url片段> <answers.json>
// answers.json 格式（二选一均可，都给优先按 optId）：
//   [{ "eid": "cOtLDEuVWISqyULSDGzG+Q==", "optId": 486557571 }]        按选项id（最稳）
//   [{ "stemKey": "接纳自我就是无视自己的不足", "text": "错" }]        按题干关键词+选项文字
// 多选题 text 传数组：{ "stemKey": "...", "text": ["A", "B"] }
import { readFileSync } from 'node:fs';

const PORT = process.env.CDP_PORT || 9223;
const BASE = `http://127.0.0.1:${PORT}`;
const targetSub = process.argv[2];
const answersFile = process.argv[3];
if (!targetSub || !answersFile) {
  console.error('用法: node answer.mjs <targetId或url片段> <answers.json>');
  process.exit(1);
}
const answers = JSON.parse(readFileSync(answersFile, 'utf8'));

const all = await (await fetch(`${BASE}/json/list`)).json();
const target = all
  .filter((t) => t.type === 'page')
  .find((t) => t.url.includes(targetSub) || t.id === targetSub);
if (!target) {
  console.error('no target: ' + targetSub);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// 页内执行的驱动函数：按 optId 直接找 input 点，或按文字匹配 .nodeLab
// 一次调用做完：点选 → 下一题/保存；返回 {picked, advanced}
// 答案队列由外层逐条下发（queue 存在 window.__ansQueue）
const DRIVER = `
  window.__ansQueue = window.__ansQueue || [];
  (async () => {
    const norm = (s) => String(s).replace(/\\s+/g, '');
    const vis = (e) => e.getBoundingClientRect().width > 0;
    const want = window.__ansQueue.shift();
    if (!want) return JSON.stringify({ done: true });
    const picked = [];
    if (want.optIds && want.optIds.length) {
      for (const oid of want.optIds) {
        const inp = [...document.querySelectorAll('.examPaper_subject input[type=radio], .examPaper_subject input[type=checkbox]')]
          .find((i) => String(i.value) === String(oid) && i.closest('.examPaper_subject').getBoundingClientRect().width > 0);
        if (inp) {
          inp.click();
          picked.push(oid);
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    } else if (want.texts && want.texts.length) {
      const subs = [...document.querySelectorAll('.examPaper_subject')].filter(vis);
      const cur = subs.find((s) => s.querySelector('.subject_describe')?.getBoundingClientRect().width > 0) || subs[0];
      const labs = [...cur.querySelectorAll('.nodeLab')].filter(vis);
      for (const t of want.texts) {
        const lab = labs.find((l) => norm(l.textContent).includes(norm(t)));
        if (lab) {
          lab.click();
          picked.push(norm(lab.textContent).slice(0, 20));
          await new Promise((r) => setTimeout(r, 250));
        }
      }
    }
    const btn = [...document.querySelectorAll('.el-button')].find(
      (e) => vis(e) && ['下一题', '保存'].includes(norm(e.textContent))
    );
    const label = btn ? norm(btn.textContent) : 'none';
    if (btn) btn.click();
    await new Promise((r) => setTimeout(r, 350));
    return JSON.stringify({ picked, advanced: label });
  })()
`;

const evalIn = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 500));
  return r.result?.value;
};

const log = [];
// 逐题下发：每次只放一条进队列，等结果确认再放下一条
for (let i = 0; i < answers.length; i++) {
  const a = answers[i];
  const ids = a.optId != null ? [a.optId] : a.optIds;
  const texts = ids ? null : Array.isArray(a.text) ? a.text : [a.text];
  await evalIn(`window.__ansQueue = []`);
  await evalIn(
    `window.__ansQueue.push(${JSON.stringify({ optIds: ids || null, texts: texts || null })})`
  );
  const r = JSON.parse(await evalIn(DRIVER));
  if (r.done) break;
  log.push({ step: i + 1, ...r });
  await sleep(500);
  // 若已点「保存」则结束
  if (r.advanced === '保存') break;
}
console.log(JSON.stringify(log, null, 1));
ws.close();
