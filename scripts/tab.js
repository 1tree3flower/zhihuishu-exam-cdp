// 在「未提交 / 已提交」两个 tab 之间切换
// 用法：node cdp.mjs evalfile scripts/tab.js --page <列表页id>
//   然后改 want 为 '已提交' 或 '未提交'
(async () => {
  const want = '已提交';
  const norm = (s) => s.replace(/\s+/g, '');
  const lis = [...document.querySelectorAll('.opChangeNav li')];
  const t = lis.find((e) => norm(e.textContent) === want);
  if (!t) return JSON.stringify({ ok: false, tabs: lis.map((e) => norm(e.textContent)) });
  t.click();
  await new Promise((r) => setTimeout(r, 1600));
  return norm(document.body.innerText).slice(0, 900);
})();
