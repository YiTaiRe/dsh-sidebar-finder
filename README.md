# dsh-sidebar-finder

**把侧边栏的空间还给工作区，把「找东西」放进工作区标题行。**

一个 [DeepSeek Harness](https://github.com/deepseek-ai) 侧边栏插件：收纳挤占空间的面板列表，并给工作区加一个就地展开的搜索框 —— 文件名、文件内容、会话消息，一个入口全搜。

<p>
<img alt="platform" src="https://img.shields.io/badge/platform-DSH%20Web-4c8dff">
<img alt="license" src="https://img.shields.io/badge/license-MIT-green">
<img alt="deps" src="https://img.shields.io/badge/dependencies-zero-brightgreen">
</p>

---

## 它解决什么问题

### 1. 侧边栏被面板列表挤占

DSH 侧边栏顶部是一列功能面板（插件、插件市场、归档会话、自动化任务、上下文洞察、技能中心、记忆系统……）。面板一多，列表就把下方的工作区压缩得很小 —— 只有五六条会话可见，想找历史会话就得反复滚动。

这个插件把侧边栏整理成清晰的上下两层：

<p align="center">
  <img src="assets/sidebar-layout.svg" alt="改造前：面板列表把工作区压成窄条；改造后：面板收进「更多」，工作区恢复高度，查找入口落在标题行" width="880">
</p>

**效果**：面板区从约 266px 降到约 114px，工作区净增约 180px，可见条数从五六条变成十条以上。

哪些面板保留、哪些收纳，写进配置，随时可改。

### 2. 找不到东西 —— 文件和消息都找不到

DSH 自带会话标题搜索，但**搜不了文件内容，也搜不了对话正文**。工作区里的代码、文档，几天前聊过的某句话，全靠手工翻。

这个插件把查找入口放进工作区标题行，与其他图标并排，视觉与交互完全照抄宿主的会话搜索：

- **点一下**：标题行在原位变成输入框，会话列表照常显示
- **打字时**：结果就地替换列表，不打字不打扰
- **点 ×**：恢复原状

两个页签：

| 页签 | 搜什么 | 结果 |
|---|---|---|
| **文件** | 工作区文件名 + 全文内容 | 命中行带上下文，关键词高亮，点击直接打开文件 |
| **消息** | 当前会话 + 其他会话的对话正文 | 按「当前会话 / 其他会话」分组，带轮次号，点击跳到那一轮并高亮 |

---

## 特性

- **零运行时依赖** —— `dependencies` 为空，只声明一个 `@deepseek-ai/schemastery` 作为 peer（宿主自带）。不引入索引库、不下载模型、不起子进程。
- **不自建索引** —— 直接用宿主已有的工作区文件接口递归遍历，每次搜索现算。没有索引文件要维护，也不会搜出已被删除的陈旧结果。
- **只用官方扩展点** —— 通过 `sidebar.panellist.actions`（同步收纳状态）与 `shell.overlay`（搜索浮层）两个 slot 扩展，不改宿主源码。让位效果靠属性标记 + 样式表完成，不覆盖宿主节点的内联样式（否则会和宿主重渲染互相打架，表现为「标题行偶尔闪回来」）。
- **视觉对齐原生** —— 同一套尺寸、配色变量与过渡时长，深浅主题自动跟随。
- **中英双语** —— 通过宿主 locale 服务注册，跟随界面语言。
- **构建自带安全阀** —— 拼装后先在进程内做语法编译，再跑冒烟测试（槽注册、effect 数量、CSS 完整性、收纳规则、pin 同步），任一步失败就不写产物。

---

## 安装

仓库为公开仓库，在 DSH 的插件管理里添加地址即可：

```
https://github.com/YiTaiRe/dsh-sidebar-finder
```

安装后**重启 DSH** 生效（客户端插件在启动时加载，刷新窗口不够）。

---

## 兼容性

| 项 | 要求 |
|---|---|
| 平台 | DSH Web（`platform: web`） |
| 宿主核心 | `@deepseek-ai/dsh-client-ui-slots` / `-renderer` / `-layout` / `-sidebar` / `-conversation` / `-locale` |
| peer 依赖 | `@deepseek-ai/schemastery` ≥ 3.18.1（宿主自带） |
| 开发构建 | Node.js（仅构建期，运行期不需要） |

> 侧边栏与工作区的结构靠宿主 CSS 类名片段匹配（`[class*="_panelList"]` 这类）。宿主大改版可能失效，届时需要跟着调整 —— 见「已知限制」。

---

## 配置

改 profile 的 `cordis.patch.yml` 里 `id: sidebar-finder` 段的 `config`，重启生效。

### 面板收纳

| 键 | 默认 | 说明 |
|---|---|---|
| `alwaysVisible` | `[plugins, mnemon]` | 顶部常驻的面板 id 列表 |
| `collapseOthers` | `true` | 其余面板是否收进「更多」 |
| `workspaceMinHeight` | `240` | 工作区保底高度（px） |
| `panelListMaxHeightVh` | `40` | 面板区最大高度（vh） |

面板 id 就是你在 `cordis.patch.yml` 里看到的名字，例如 `plugins`、`mnemon`、`dsh-market`、`schedules`、`dsh-context`、`skill-explorer`。

### 文件搜索

| 键 | 默认 | 说明 |
|---|---|---|
| `excludeDirs` | `.git node_modules dist build .venv __pycache__ .next target` | 跳过的目录名 |
| `maxResults` | `200` | 结果上限 |
| `maxDepth` | `12` | 递归深度上限 |
| `textFileBudget` | `120` | 全文搜索最多读多少个文件 |
| `maxContentLines` | `4000` | 单文件最多读多少行 |
| `debounceMs` | `300` | 输入防抖（毫秒） |

### 消息搜索

| 键 | 默认 | 说明 |
|---|---|---|
| `maxMessageResults` | `40` | 消息命中上限 |
| `maxMessageSessions` | `6` | 除当前会话外，最多钻进几个其他会话 |
| `messagePageBudget` | `8` | 每个会话最多向前翻几页历史 |

> **说明**：`finderPosition` 目前是保留键（实现固定为「排在『更多』之后」）；`shortcut` 尚未实现，填了不生效。

---

## 设计取舍

**不自建索引。** 直接用宿主已有的工作区文件接口递归遍历，每次搜索现算。省掉了索引维护的复杂度和陈旧问题，代价是大仓库首次搜索要等一会儿 —— 所以有 `textFileBudget` 和 `maxContentLines` 控制预算。

**不改宿主代码。** 全部通过官方 slot 扩展点和 CSS 实现。视觉上刻意对齐宿主原生搜索：同一套尺寸、同一套配色变量、同一套过渡时长。深浅主题自动跟随。

**查找不抢工作区。** 空查询时只占标题行一行，会话列表照常可见可点；只有真正输入内容才用结果替换列表。这一点和宿主原生搜索行为一致。

**不做「智能」。** 没有向量检索、没有 embedding、不调模型。纯文件名匹配 + 子串匹配，行为可预测，也不会因为模型抖动给出时好时坏的结果。

---

## 已知限制

- **消息定位依赖已渲染的 DOM 行**。命中的消息如果太旧、当前视图还没加载到那一轮，会切到对应会话但不滚动定位。
- **宿主全文索引默认关闭时，「其他会话」要靠列表枚举兜底**。DSH 的会话全文搜索是 opt-in（`session-query-sqlite` 默认 `openAt: never`），未启用时插件会退回枚举会话列表拿候选；此时搜不到未加载的会话正文。启用宿主索引后结果更全。
- **选择器匹配的是宿主的 CSS 类名片段**（`[class*="_sectionHeader"]` 等）。宿主大改版可能失效，届时需要跟着调整。
- **只支持 Web 端**。`platform: web`，不涉及桌面端原生能力。

---

## 常见问题

**Q：面板没有收起来？**
确认 `collapseOthers: true` 且该面板 id 不在 `alwaysVisible` 里。`plugins` 由宿主强制常驻，列不列都会显示。

**Q：搜索很慢？**
调小 `textFileBudget`（减少全文读取的文件数）或 `maxDepth`。`excludeDirs` 里加上你的产物目录。

**Q：升级 DSH 后插件没反应 / 图标消失？**
先看插件是否还在启用状态（`cordis.patch.yml` 的 `sidebar-finder` 段有没有被写上 `disabled: true`），再看日志里有没有 `slot entry crashed`。

**Q：和别的侧边栏插件冲突吗？**
如果另一个插件也往 `sidebar.panellist.actions` 注册内容，会出现两组菜单项。本插件已不再自绘「更多」菜单，只同步 pin 状态。

---

## 开发

源码拆在 `src/` 下，按功能分 17 个片段；`client.js` 是构建产物，不要直接改。

```bash
# 改完 src/ 里的代码后构建
npm run build          # 拼装 + 语法检查 + 冒烟测试，全部通过才写 client.js

# 只校验，不写文件（CI / 提交前用）
npm run check
```

构建只写源码目录的 `client.js`；安装副本是它的硬链接，所以构建完还要把内容同步过去。

**必须原位写**，`rm` + `cp` 会打断硬链接，node_modules 里就留旧内容了：

```bash
node -e "const fs=require('fs');for(const d of process.argv.slice(1))fs.writeFileSync(d,fs.readFileSync('client.js'))" \
  C:/Users/<你>/.dsh/profiles/desktop/vendor/dsh-sidebar-finder/client.js \
  C:/Users/<你>/.dsh/profiles/desktop/node_modules/@local/dsh-sidebar-finder/client.js
```

**为什么是拼接而不是模块化：** 整个 `client.js` 跑在 ModuleLoader 的 factory 闭包里，所有片段本来就共享同一套闭包变量。改成各文件独立的模块作用域，需要给每个跨文件引用加显式 import/export，等于重写一遍 —— 而且本机没有 esbuild/rollup，改坏了没有编译期兜底。按顺序拼接保持语义完全一致，新增或删除文件只改 `scripts/build.mjs` 里的 `ORDER`。

**安全阀：** 构建先做语法校验（`vm.Script` 在进程内编译，等价于 `node --check`，但不起子进程），再跑冒烟测试。任一步失败就**不写 `client.js`**，原文件保持不动。`--check` 全程不落盘，只读沙箱里也能跑。

源码在 `packages/dsh-sidebar-finder/`，安装副本在 `<profile>/node_modules/@local/dsh-sidebar-finder/`，两者物理分离。

### 片段清单

| 文件 | 行数 | 内容 |
|---|---|---|
| `src/00-head.js` | 8 | ModuleLoader 外壳、React 取值 |
| `src/10-constants.js` | 10 | 面板 id、locale 命名空间、选择器 |
| `src/20-dict.js` | 57 | 中英词典 |
| `src/30-open-state.js` | 21 | 跨 slot 的打开状态 |
| `src/40-icon.js` | 27 | 图标（viewBox 与放大镜对齐） |
| `src/50-measure.js` | 185 | 工作区矩形测量、底部边界探测 |
| `src/60-overlay-helpers.js` | 32 | `openFile`、关键词高亮 |
| `src/65-header-entry.js` | 170 | 标题行入口的位置计算 |
| `src/70-overlay.js` | 465 | 搜索浮层主体 |
| `src/75-fs-search.js` | 422 | 工作区文件遍历与内容匹配 |
| `src/80-msg-search.js` | 375 | 会话消息检索与跳转 |
| `src/85-t-safe.js` | 11 | 词典读取（未注入 locale 时回退中文） |
| `src/90-css.js` | 462 | 样式表 |
| `src/92-runtime-vars.js` | 159 | 运行时 CSS 变量、菜单宽度测量 |
| `src/94-fallback-panel.js` | 15 | 兜底页 |
| `src/96-collapse.js` | 105 | 面板收纳（CSS 生成 + 官方 pin 同步） |
| `src/99-plugin.js` | 144 | 插件对象（inject / apply） |

---

## 更新日志

### 1.0.0

- 面板收纳：非白名单面板收进「更多」，工作区保底 240px
- 工作区标题行内联搜索：文件名、文件内容、会话消息
- 消息搜索跨会话：当前会话 + 其他会话分组显示
- 构建脚本零依赖，自带语法校验与冒烟测试

---

## 许可

MIT
