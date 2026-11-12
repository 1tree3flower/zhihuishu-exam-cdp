// 只翻页（不选答案），用于补答后跳回或确认进度
(() => {
  const norm = (s) => s.replace(/\s+/g, '');
  const vis = (e) => e.getBoundingClientRect().width > 0;
  const btn = [...document.querySelectorAll('.el-button')].find(
    (e) => vis(e) && ['下一题', '保存'].includes(norm(e.textContent))
  );
  if (!btn) return 'none';
  const label = norm(btn.textContent);
  btn.click();
  return label;
})();
