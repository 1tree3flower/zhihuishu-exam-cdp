// 鎸夐€夐」鏂囧瓧浣滅瓟锛屽苟鑷姩缈婚〉/淇濆瓨
// 鐢ㄦ硶锛氭敼涓嬮潰 want 鏁扮粍锛堝幓鎺夌┖鏍煎悗鍋?includes 鍖归厤锛屽閫夐鍐欏涓級锛岀劧鍚?//   node cdp.mjs evalfile scripts/pick.js --page <绛旈椤祎argetId>
// 杩斿洖 {picked, advanced}锛歱icked 搴旂瓑浜庣瓟妗堬紝advanced 搴斾负銆屼笅涓€棰樸€嶏紙鏈€鍚庝竴棰樹负銆屼繚瀛樸€嶏級
(() => {
  const want = ['鎶婅繖閲屾崲鎴愮瓟妗堟枃瀛?];
  const norm = (s) => s.replace(/\s+/g, '');
  const vis = (e) => e.getBoundingClientRect().width > 0;
  const labs = [...document.querySelectorAll('.nodeLab')].filter(vis);
  const picked = [];
  labs.forEach((l) => {
    const t = norm(l.textContent);
    if (want.some((w) => t.includes(norm(w)))) {
      l.click();
      picked.push(t);
    }
  });
  const btn = [...document.querySelectorAll('.el-button')].find(
    (e) => vis(e) && ['涓嬩竴棰?, '淇濆瓨'].includes(norm(e.textContent))
  );
  const label = btn ? norm(btn.textContent) : 'none';
  if (btn) btn.click();
  return JSON.stringify({ picked, advanced: label, total: labs.length });
})();

