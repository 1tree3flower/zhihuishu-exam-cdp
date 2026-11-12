// 在「未提交」列表点第一个「开始答题」（会新开标签页）
// 按钮是 <a class="commonBtn_green">，不是 .el-button
(async () => {
  const norm = (s) => s.replace(/\s+/g, '');
  const vis = (e) => e.getBoundingClientRect().width > 0;
  const btns = [...document.querySelectorAll('a.commonBtn_green')].filter(
    (e) => vis(e) && norm(e.textContent) === '开始答题'
  );
  if (!btns.length) return JSON.stringify({ ok: false });
  const b = btns[0];
  let row = b;
  for (let i = 0; i < 6 && row; i++) {
    if (norm(row.innerText).includes('题目数量')) break;
    row = row.parentElement;
  }
  const title = row ? norm(row.innerText).slice(0, 30) : '';
  b.click();
  await new Promise((r) => setTimeout(r, 1500));
  return JSON.stringify({ ok: true, n: btns.length, title });
})();
