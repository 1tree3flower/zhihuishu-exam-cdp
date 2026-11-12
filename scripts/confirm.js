// 在「是否确认提交」弹窗上点「确定」，并返回得分弹窗里的文字
// 注意：这个弹窗不是 .el-message-box，只能按文字找「确定」
(async () => {
  const norm = (s) => s.replace(/\s+/g, '');
  const cands = [...document.querySelectorAll('button, .el-button, div, span, a')].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && norm(e.textContent) === '确定';
  });
  if (!cands.length) return JSON.stringify({ ok: false, reason: 'no confirm button' });
  cands[cands.length - 1].click();
  await new Promise((r) => setTimeout(r, 1800));
  const txt = document.body.innerText.replace(/\s+/g, ' ');
  const m = txt.match(/恭喜你本章测试取得满分|本章测试你的得分为\s*\d+/);
  return JSON.stringify({ ok: true, score: m ? m[0] : null, snippet: txt.slice(0, 160) });
})();
