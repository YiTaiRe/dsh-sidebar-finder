# dsh-sidebar-finder

DSH 侧边栏改造插件：面板收纳 + 工作区标题行内联查找（文件 / 会话消息）。


## 当前状态：已从 profile 注销

2026-11-02：因为 pnpm 无法在本环境运行（全局 store 锁被占用），插件**已从 profile 完全注销**，
以免影响其它插件的更新。注销内容：

- profile `package.json`：移除 `dependencies` 与 `dsh.profile.bundles` 里的登记
- profile `cordis.patch.yml`：移除 `insert: sidebar-finder` 整段（47 行）
- 删除 `node_modules/@local/` 与 `vendor/`

源码与三份防护**全部保留**，随时可重新安装。

### 重新安装的正确姿势

**不要**再用 `link:` 或 junction —— 那是上次源码被删的原因。

等 pnpm 可用后（关闭所有 DSH 进程再跑）：

```bash
# 1) 源码放进 profile 内的 vendor/（pnpm 不管理这里）
cp -r packages/dsh-sidebar-finder "$DSH_PROFILE_DIR/vendor/"
# 2) 声明为 file: 依赖，让 pnpm 写进 lockfile（关键）
#    在 profile/package.json 的 dependencies 加：
#    "@local/dsh-sidebar-finder": "file:vendor/dsh-sidebar-finder"
# 3) 把包名加回 dsh.profile.bundles
# 4) 跑 pnpm install，让 pnpm 自己建立 node_modules 链接
```

第 4 步是关键：让 **pnpm 自己**建链接，它就认得这个包，不会再当垃圾清理。

安装形态（重要，改动前务必读完）

这个插件**不是**用 `link:` 或 junction 装的。原因是一次真实事故：

> profile 的 `node_modules` 归 pnpm 管理。某次插件升级触发 pnpm 按 `pnpm-lock.yaml`
> 重算目录，本插件不在 lockfile 里 → 被判为多余项 → 递归删除
> `node_modules/@local/dsh-sidebar-finder`。那条是 **Windows junction（重解析点）**，
> 删除穿透到目标目录，**把工作区里的插件源码一起清空了**（7 个文件全变 0 字节）。
> 最后靠会话日志 `session.v4.jsonl.zstd` 多帧解压 + 重放 write/edit 才恢复。

所以现在的形态是：

| 项目 | 位置 | 说明 |
|---|---|---|
| 源码（唯一真源） | `packages/dsh-sidebar-finder/` | git 仓库，8 文件 |
| 安装副本 | `~/.dsh/profiles/desktop/node_modules/@local/dsh-sidebar-finder/` | **真实副本**，非链接 |
| 登记 | profile `package.json` 的 `dsh.profile.bundles` | 保留 |
| 依赖声明 | profile `package.json` 的 `dependencies` | **已删除**（不再有 `link:`） |

`dependencies` 里不声明它，pnpm 就不知道有这个包，也就不会去动它；但宿主仍能解析，
因为 `resolveBundleDir` 用的是 `createRequire(profile/package.json).resolve.paths()`
逐级查找 `node_modules` 目录，只要目录真实存在就能找到（已验证返回
`<profile>/node_modules/@local/dsh-sidebar-finder`）。

**风险提示**：pnpm 在 `nodeLinker: hoisted` 模式下，理论上仍可能把 `node_modules` 里
「不在 lockfile 中」的目录当垃圾清掉。现在它是真实目录（不是链接），**被删也只丢副本，
不会伤到源码** —— 跑一次下面的同步脚本即可恢复。

## 改完代码怎么让它生效

```bash
cd <项目根>
node scripts/sync-plugin.mjs
```

脚本会：清空安装副本 → 从源码复制 8 个条目 → 对 `client.js`/`index.js`/`package.json`
做 md5 校验。然后**重启 DSH** 生效。

`--dry` 可只看会复制什么，不写入。

## 三级防护

1. **git**（`packages/dsh-sidebar-finder/.git`）：`.gitattributes` 固定 LF，
   避免 Windows checkout 改换行造成虚假 diff。
2. **源码 tar 快照**：`_tmp/backups/dsh-sidebar-finder-src-<ts>.tar.gz`（约 28 KB，纯 8 文件）。
   另有含 `.git` 的完整包 `dsh-sidebar-finder-<ts>.tar.gz`（约 75 KB）。
3. **安装副本与源码物理分离**：源码在工作区，副本在 profile，pnpm 只能碰副本。

## 从会话日志恢复（最后手段）

如果源码和快照都丢了，DSH 会话日志里存着完整的 `write`/`edit` 操作历史：

```bash
# 日志位置
~/.dsh/sessions/--<工作区路径转义>--/session-<id>/session.v4.jsonl.zstd
```

要点：**是多帧 zstd**。`zlib.zstdDecompressSync()` 单帧只解出开头几百字节，
必须按 magic `28b52ffd` 扫描出全部帧、逐帧解压再 `Buffer.concat`。
参考脚本 `_tmp/replay.mjs`、`_tmp/replay-all.mjs`。

重放规则：按 `seq` 升序，`write` 设基线，`edit` 用 `content.indexOf(old_string)` 精确替换。
注意有些 `edit` 在真实历史里本来就是失败的（`old_string was not found`），重放时会同样失败，
这是正确的，不是重放缺陷。

## 配置

改 `~/.dsh/profiles/desktop/cordis.patch.yml` 里 `id: sidebar-finder` 段的 `config`：

| 键 | 默认 | 说明 |
|---|---|---|
| `alwaysVisible` | `[plugins, mnemon]` | 顶部常驻面板 |
| `collapseOthers` | `true` | 其余面板收进「更多」 |
| `workspaceMinHeight` | `240` | 工作区保底高度 px |
| `panelListMaxHeightVh` | `40` | 面板区最大高度 vh |
| `excludeDirs` | `.git node_modules dist build .venv __pycache__ .next target` | 搜索跳过目录 |
| `maxResults` | `200` | 文件搜索结果上限 |
| `maxDepth` | `12` | 目录递归深度 |
| `textFileBudget` | `120` | 全文搜索读多少个文件 |
| `maxContentLines` | `4000` | 单文件最多读多少行 |
| `maxMessageResults` | `40` | 消息命中上限 |
| `maxMessageSessions` | `6` | 除当前会话外钻几个会话 |
| `messagePageBudget` | `8` | 每会话向前翻几页 |
| `debounceMs` | `300` | 输入防抖 |

改完同样要重启 DSH。

## 已知限制

- 面板收纳依赖宿主「更多」菜单打开过一次（宿主只在该菜单渲染时提供 `onPinnedChange`），
  且 pin 状态是纯内存、重启重置。
- 消息定位靠 `[data-chat-turn="N"]` DOM 锚点，太旧未渲染的消息只能切会话不能滚动定位。
- 选择器匹配的是宿主哈希类名（`[class*="_sectionHeader"]` 等），宿主大改版可能失效。

## 本地开发与推送

改完代码后，在项目根目录执行：

```bash
bash scripts/push.sh "你的提交说明"
```

脚本会依次完成三件事：先 `git add -A`，再自动提交，最后推送到 GitHub。

**为什么不能直接 `git push`**（三个环境坑，脚本已全部绕过）：

1. Git 默认临时目录 `<系统临时目录>\...` 在本环境不可写，
   会报「对路径 ...system-commandline-sentinel-files 的访问被拒绝」→ 脚本把
   `TMPDIR`/`TEMP`/`TMP` 全部指到 `_tmp/gittmp`。
2. 全局 `~/.gitconfig` 只读，装不了 credential helper → 脚本改用 `gh auth token`
   取令牌，通过 `-c http.extraheader` 临时注入，不写任何全局配置。
3. MSYS 会把 `/user` 这类参数改写成 Windows 路径 → 脚本设置
   `MSYS_NO_PATHCONV=1` 和 `MSYS2_ARG_CONV_EXCL='*'`。

只推送已有提交（不新建提交）：`bash scripts/push.sh --no-commit`
