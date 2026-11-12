# 安装 zhihuishu-exam-cdp（智慧树作业 CDP 做题法）

## 这是什么

一个 DSH 技能（skill）：通过 Edge 远程调试端口（CDP）抓包智慧树答题页的题目数据接口，按选项 id 一键点完整章作业。零 npm 依赖，只需 Node 18+ 和 Windows + Edge。

## 安装步骤（目标机器）

1. 把 zip 解压到 DSH 用户级技能目录：
   `%USERPROFILE%\.dsh\skills\zhihuishu-exam-cdp\`
   解压后应有：
   ```
   .dsh\skills\zhihuishu-exam-cdp\SKILL.md
   .dsh\skills\zhihuishu-exam-cdp\scripts\cdp.mjs
   .dsh\skills\zhihuishu-exam-cdp\scripts\sniff.mjs
   .dsh\skills\zhihuishu-exam-cdp\scripts\extract.mjs
   .dsh\skills\zhihuishu-exam-cdp\scripts\answer.mjs
   ... （其余辅助脚本）
   ```
2. 确认 Node ≥ 18（`node -v`）。
3. 新开对话直接说「智慧树作业」或「帮我做智慧树单元测试」，Agent 会自动加载 SKILL.md 并按流程执行。

## 首次使用前的一次性搭建（在目标机器上）

技能里的 SKILL.md 已写全，核心两步：

```powershell
# ① 目录联接（绕开 Edge 默认 profile 禁止远程调试）
cmd /c mklink /J "D:\edge-live" "C:\Users\<用户名>\AppData\Local\Microsoft\Edge\User Data"

# ② 带调试端口启动 Edge（保持窗口不关，关了登录态会掉）
Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList '--user-data-dir=D:\edge-live','--remote-debugging-port=9223','--restore-last-session','--no-first-run','--no-default-browser-check'

# 校验：返回含 Edg/xxx 的 JSON 即成功
Invoke-RestMethod http://127.0.0.1:9223/json/version
```

注意：Edge 关窗后后台驻留进程可能吞掉启动参数——先 `Stop-Process` 结束 msedge 主进程再启动（详见 SKILL.md「Edge 后台进程抢占」）。

## 日常使用流程

用户在 Edge 里登录智慧树 → 打开某章作业答题页 → 对 Agent 说「做这章」：

```
sniff.mjs 抓包 → extract.mjs 提取题目 → Agent 出 answers.json → answer.mjs 一键点完 → 汇报完成率与答案，默认不提交
```

用户说「提交」时才走 submit/confirm 流程。

## 支持的端

- 本技能是纯文件 + Node 脚本，任何能运行 DSH/Agent 并驱动本机命令行的端都能用（Windows + Edge 为验证过的组合）。
- 非 Windows 端需要把 junction 逻辑换成对应方式（如 Linux/macOS 直接用 `--user-data-dir` 指向真实 profile 的副本目录，但注意登录态 cookie 锁问题——SKILL.md 有说明）。
