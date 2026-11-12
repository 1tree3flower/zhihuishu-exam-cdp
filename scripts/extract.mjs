// 从 net_dump.json 提取题目清单 → questions.json
// 用法：node extract.mjs <net_dump.json> [输出文件=questions.json]
// 输出格式：[{ no, eid, type, stem, options: [{id, text}], stemKey }]
import { readFileSync, writeFileSync } from 'node:fs';

const inFile = process.argv[2] || 'net_dump.json';
const outFile = process.argv[3] || 'questions.json';

const dump = JSON.parse(readFileSync(inFile, 'utf8'));
const hw = dump.filter((x) => /student\/doHomework/i.test(x.url));
if (!hw.length) {
  console.error('net_dump 里没有 doHomework 响应');
  process.exit(1);
}

// 可能抓到多次 doHomework（重复刷新），取题目数最多的那份
let best = null;
for (const h of hw) {
  try {
    const j = JSON.parse(h.body);
    const parts = j?.rt?.examBase?.workExamParts || [];
    const qs = parts.flatMap((p) => p.questionDtos || []);
    if (!best || qs.length > best.length) best = qs;
  } catch (e) {}
}
if (!best) {
  console.error('doHomework 响应解析失败');
  process.exit(1);
}

const strip = (s) => (s || '').replace(/[（(]\s*[）)]/, '').replace(/\s+/g, '');

const questions = best.map((q, i) => ({
  no: i + 1,
  eid: q.eid,
  type: q.questionType?.name || '',
  score: Number(q.questionScore || 0),
  stem: q.name,
  stemKey: strip(q.name).slice(0, 40),
  options: (q.questionOptions || []).map((o) => ({ id: o.id, text: o.content })),
}));

writeFileSync(outFile, JSON.stringify(questions, null, 1), 'utf8');
console.log(JSON.stringify({ file: outFile, count: questions.length }));
for (const q of questions) {
  console.log(
    `${q.no} [${q.type}] ${q.stem.slice(0, 50)}\n   opts: ${q.options
      .map((o) => `${o.id}:${o.text.slice(0, 18)}`)
      .join(' | ')}`
  );
}
