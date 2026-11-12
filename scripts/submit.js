// 点击右上角「提交作业」，并等待确认弹窗出现
(async () => {
  const norm = (s) => s.replace(/\s+/g, '');
  const vis = (e) => e.getBoundingClientRect().width > 0;
  const btn = [...document.querySelectorAll('.el-button')].find(
    (e) => vis(e) && norm(e.textContent) === '提交作业'
  );
  if (!btn) return JSON.stringify({ ok: false, reason: 'no submit button' });
  btn.click();
  await new Promise((r) => setTimeout(r, 1200));
  const txt = document.body.innerText.replace(/\s+/g, '');
  return JSON.stringify({ ok: true, dialogAppeared: txt.includes('是否确认提交') });
})();
