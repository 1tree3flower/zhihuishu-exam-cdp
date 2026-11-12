---
name: zhihuishu-exam-cdp
description: 智慧树（zhihuishu）在线作业/单元测试的 CDP 抓包做题法。通过 Edge 远程调试端口直接读答题页 DOM（纯文本选项、无需截图识别），再用脚本按选项文字精确点击、自动翻页与提交，把「一题一截图」变成「一次读题 + 一段脚本点完」。当用户要求代做智慧树单元测试/见面课测验/作业，或说「抓包做作业」「自动答题」「智慧树作业」时使用。
whenToUse: 用户要完成智慧树 onlineexamh5new / onlineexam 上的作业、单元测试、见面课测验，且浏览器已登录；尤其当题目数量多、要求速度快时。
---

# 智慧树作业 CDP 抓包做题法

核心思路：**不要截图识别题目**。智慧树答题页是 Vue SPA，选项文本在 `.nodeLab` 里；题干在 DOM 里被 CSS 字体反爬隐藏（`.subject_describe` 只有空占位 DIV），**但题目全量明文数据在 `student/doHomework` 接口响应里**。用 CDP Network 抓包拿题，再按**选项 id**点击作答。

## 新版快速流程（推荐，2026-11-12 实测通过）

前置：调试端口 9223 已开、答题页已打开（URL 含 `dohomework` 的 target）。

```powershell
$ID = "<dohomework的targetId>"   # 从 http://127.0.0.1:9223/json/list 里找

# ① 抓包：刷新页面并记录所有接口响应 → net_dump.json
node scripts\sniff.mjs $ID 8000 net_dump.json

# ② 提取题目（题干+选项id）→ questions.json，控制台同时打印题目清单
node scripts\extract.mjs net_dump.json questions.json

# ③ 看 questions.json 出答案 → 写 answers.json（按选项 id 最稳）：
#    [ { "optId": 486557571 }, { "optIds": [486557530, 486557536] }, ... ]
#    顺序必须与 questions.json 的题号一致；多选题用 optIds 数组。

# ④ 一键点完整章（点选+自动翻页+最后一题自动保存）
node scripts\answer.mjs $ID answers.json

# ⑤ 截图核对「完成率 100%」后再提交
node scripts\cdp.mjs shot done.png --page $ID
```

关键机制：
- 页面每题 `input[type=radio]` 的 `value` = 接口里的**选项 id**，跨刷新/乱序恒定 → `answer.mjs` 按 id 点击，不受选项乱序影响。
- 题目 anchor：`.subject_num span#anchor_<eid>`，eid 与接口 `eid` 一致（base64，页面里 `+` 被去掉，勿用来匹配，只用选项 id）。
- 接口响应 `rt.examBase.workExamParts[].questionDtos[]`：`name`=题干、`questionOptions[].{id,content}`、`questionType.name`、`questionScore`；`result` 为 null 无答案泄露。
- `sniff.mjs` 走 CDP Network 域（Page.reload 后 `Network.getResponseBody` 逐个捞），**不怕刷新、无 CORS**；页面级 XHR hook 方案已废弃（刷新即失效）。
- 旧版「开始答题新开标签页」仍适用：列表页点「开始答题」后要重新 list 找 `dohomework` target。

### 提交（submit/confirm 脚本沿用旧版）

```powershell
node scripts\cdp.mjs evalfile scripts\submit.js  --page $ID
Start-Sleep -Milliseconds 1600
node scripts\cdp.mjs evalfile scripts\confirm.js --page $ID
node scripts\cdp.mjs shot score.png --page $ID
```

## 环境搭建与登录坑

### Edge 后台进程抢占（2026-11-12 新坑）

用户 Edge 关窗后**后台驻留进程**（`--no-startup-window`）还在，`Start-Process msedge -ArgumentList ...` 的调试参数会被并入已有实例而**静默失效**。处理：先结束主进程再启动。

```powershell
# 找主进程（ParentProcessId 为非 msedge 的那个）；无窗口的驻留主进程直接关
Stop-Process -Id <主进程PID> -Force   # 用户已关窗时才可这样做，否则会掉登录
# 再启动调试实例并校验
Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList '--user-data-dir=D:\edge-live','--remote-debugging-port=9223','--restore-last-session','--no-first-run','--no-default-browser-check'
Invoke-RestMethod http://127.0.0.1:9223/json/version   # 返回 Edg/xxx 才算成功
```

### 登录态是会话级 cookie

- 智慧树登录态**不持久**，Edge 重启即掉。用户重新登录后页面自动跳回。
- 目录联接首次搭建（只需一次）：

```powershell
if (-not (Test-Path "D:\edge-live")) {
  cmd /c mklink /J "D:\edge-live" "C:\Users\<用户>\AppData\Local\Microsoft\Edge\User Data"
}
```

> 复制 profile 到别处再启动**不行**：`Default\Network\Cookies` 被运行中的 Edge 独占锁，非管理员无法共享读；强行复制得到 0 字节，登录必掉。

## 旧版逐题循环（备用：接口抓不到时）

每题 2 步：`shot` 截图看题干 → 改 `pick.js` 的 `want` 数组后 `evalfile`。`pick.js` 按 `.nodeLab` 文字 includes 匹配点选并自动翻页，回报 `{picked, advanced}` 自检。题干 DOM 读不到（CSS 反爬）所以必须截图——这就是新版用接口抓题的原因。

## 脚本清单

| 文件 | 用途 |
|---|---|
| `scripts/cdp.mjs` | CDP 驱动：list / eval / evalfile / shot / nav / reload / click |
| `scripts/sniff.mjs` | **抓包**：CDP Network 域监听刷新页面的全部接口响应 → net_dump.json |
| `scripts/extract.mjs` | **提取题目**：从 net_dump 解析 doHomework → questions.json（题干+选项id） |
| `scripts/answer.mjs` | **一键作答**：读 answers.json（选项id），点选+自动翻页跑完整章 |
| `scripts/hook.js` | （已废弃）页面内 XHR hook，刷新即失效，仅留档 |
| `scripts/open.js` | 在列表页点第一个「开始答题」（会新开标签页） |
| `scripts/tab.js` | 切换「未提交 / 已提交」（改里面的 `want`） |
| `scripts/pick.js` | **核心**：按选项文字作答 + 自动翻页（改 `want` 数组） |
| `scripts/nextonly.js` | 只翻页不选答案（补答、跳题时用） |
| `scripts/submit.js` | 点「提交作业」并等待确认弹窗 |
| `scripts/confirm.js` | 点弹窗「确定」并回读得分 |

## 工具：`scripts/cdp.mjs`

极简 CDP 驱动（Node 18+，无需 npm 依赖）：

```bash
node cdp.mjs list                      # 列出页面 target（含 id / url）
node cdp.mjs eval "<expr>"  --page <id或url片段>
node cdp.mjs evalfile x.js  --page <id>   # 执行脚本文件（推荐，避免引号地狱）
node cdp.mjs shot out.png   --page <id>
node cdp.mjs nav "<url>"    --page <id>
node cdp.mjs reload         --page <id>
node cdp.mjs click <x> <y>  --page <id>
```

## 关键机制（每条都踩过坑）

### 1. 「开始答题」会新开标签页

列表页与答题页是**两个 target**。在列表页 target 上反复点「开始答题」看起来「没反应」，其实是新标签开在别处。正确流程：

```powershell
# 点列表里的「开始答题」（按钮是 <a class="commonBtn_green">，不是 .el-button）
node cdp.mjs evalfile scripts/open.js --page <列表页id>
Start-Sleep -Milliseconds 3000
# 重新列 target，找 URL 里带 dohomework 的那个，后续全部操作它
Invoke-RestMethod http://127.0.0.1:9223/json/list |
  Where-Object {$_.type -eq 'page' -and $_.url -match 'dohomework'} |
  ForEach-Object { $_.id }
```

答题页 URL 形如 `...#/webExamList/dohomework/450759/5JEWJ993/wbGWMZLe/1000077387/719/0`。

### 2. 题干读不到，选项能读

- `.subject_describe` 通常是空的，`innerText` 也读不到题干 → **题干必须靠 `shot` 截图看**（一页一题，一题一次截图）。
- 选项文本可精确取：`.nodeLab` 的 textContent 形如 `A. 外部安全和内部安全`。
- **选项顺序每次随机**（页面明确提示），所以只能按**文字内容**匹配，绝不能按 A/B/C/D 位置。

### 3. 每页只答一题，必须点「下一题」才保存

- 按钮是 `.el-button`，文字为 `下一题`；**最后一题的按钮变成 `保存`**。
- 脚本里要同时接受这两个文字，否则最后一题卡住。
- 翻页后页面会回到顶部，答题卡（右侧 1..N 格）显示进度；`完成率` 百分比比数蓝格可靠。

### 4. 提交要过两道确认

```text
点「提交作业」(.el-button) → 弹窗「是否确认提交?提交后,批阅过的试卷不能再修改!」
→ 点「确定」→ 弹窗显示得分（「恭喜你本章测试取得满分!」或「本章测试你的得分为 8」）
```

确认弹窗**不是** `.el-message-box`，只能按文字 `确定` 找元素点击。弹窗出现有延迟，`submit` 与 `confirm` 之间要 `Start-Sleep -Milliseconds 1200~1600`。

### 5. 页面文字乱序是正常的

有些题目选项被平台渲染成 `C. D.国土安全和国民安全`、`D. B.发展和安全` 这种重复前缀，属正常现象，按内容匹配仍能命中。

## 标准作业循环（每题 2 步）

```powershell
# ① 截图看题干
node cdp.mjs shot "q.png" --page $ID

# ② 按选项文字作答并翻页（改 pick.js 里的 want 数组）
node cdp.mjs evalfile scripts/pick.js --page $ID
Start-Sleep -Milliseconds 900
```

`scripts/pick.js` 用 `want` 数组（可多个 = 多选题）按归一化文本（去空格）做 `includes` 匹配，点完自动点「下一题/保存」并回报 `{picked, advanced}`。`picked` 应等于你给的答案，`advanced` 应为 `下一题`（最后一题为 `保存`）——这两个字段就是自检。

最后一题之后：

```powershell
node cdp.mjs evalfile scripts/submit.js  --page $ID
Start-Sleep -Milliseconds 1600
node cdp.mjs evalfile scripts/confirm.js --page $ID
node cdp.mjs shot "score.png" --page $ID   # 确认得分
```

## 做完一章就停，默认不提交

**默认行为：一键点完整章后立即停止，不点「提交作业」。** 用户偏好自行核对答案后再决定是否提交（提交不可撤销）。汇报内容：每题答案 + 完成率 100% + 提示未提交。只有用户明确说「提交」时才执行 submit/confirm 流程。做完一章/一套就停，不要一路做到底。

## 各课入口

| 课程 | 列表页 recruitId |
|---|---|
| 军事理论-综合版 | `SK9LWM6ztOHS63lbsBEMJQ%3D%3D` |
| 大学生国家安全教育 | `YHZW5McnxRXWkUNtF68UWw%3D%3D` |

列表页：`https://onlineexamh5new.zhihuishu.com/stuExamWeb.html#/webExamList?recruitId=<id>`
切换「未提交 / 已提交」：`.opChangeNav li` 里按文字找 `未提交` / `已提交` 后 click。

## 不可做的部分

- 见面课测验（题目来自讲课视频内容）只允许做一次、不可重看答案，无讲稿时只能靠常识判断，**做不到保证全对**，要事先告知用户。
- 未到开放时间的「教程考试」点不进去，别硬试。
- 提交后不可修改；`确定` 之前务必核对 `完成率 100%`。

## 附：其它排障

| 现象 | 原因 / 处理 |
|---|---|
| `Invoke-RestMethod http://127.0.0.1:9223/...` 连不上 | 调试实例没起来或被关掉了；按「前置」重新启动，登录可能要用户重扫码 |
| 点击无反应 | 操作到了列表页 target；换 URL 含 `dohomework` 的 target |
| `Failed to fetch`（页面内 fetch 接口） | CORS/签名限制，别绕；直接读 DOM 即可 |
| 会话中途被用户 Esc 打断 | 桌面自动化序列会中止；CDP 脚本不受影响，重跑即可 |
