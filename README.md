# dsh-sidebar-finder

**给 DSH 侧边栏做两件事：把空间还给工作区，把查找放进工作区。**

---

## 它解决什么问题

### 1. 侧边栏被面板列表挤占

DSH 侧边栏顶部是一列功能面板（插件、插件市场、归档会话、自动化任务、上下文洞察、技能中心、记忆系统……）。面板一多，列表就把下方的工作区压缩得很小——只有五六条会话可见，想找历史会话就得反复滚动。

这个插件把侧边栏整理成清晰的上下两层：

```
┌─────────────────────────────┐
│  插件                        │  ← 保留常用入口
│  记忆系统                     │
│  更多                        │  ← 其余全部收纳进来
├─────────────────────────────┤
│  工作区            🔍 ⚙ 📁+  │  ← 查找入口就在这一行
│   📁 项目 A                  │
│   📁 项目 B                  │  ← 保底 240px，不再是窄条
│   📁 项目 C                  │
│   …                          │
└─────────────────────────────┘
```

**效果**：面板区从约 266px 降到约 114px，工作区净增约 180px，可见条数从五六条变成十条以上。

哪些面板保留、哪些收纳，写进配置，随时可改。

### 2. 找不到东西——文件和消息都找不到

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

消息检索会顺着会话历史向前翻页，不限于当前加载的那几百条；其他会话先用会话级搜索缩小候选，再逐条钻进去搜正文。

---

## 安装

仓库为公开仓库，在 DSH 的插件管理里添加地址即可：

```
https://github.com/YiTaiRe/dsh-sidebar-finder
```

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

---

## 设计取舍

**不自建索引。** 直接用宿主已有的工作区文件接口递归遍历，每次搜索现算。省掉了索引维护的复杂度和陈旧问题，代价是大仓库首次搜索要等一会儿——所以有 `textFileBudget` 和 `maxContentLines` 控制预算。

**不改宿主代码。** 全部通过官方 slot 扩展点和 CSS 实现。视觉上刻意对齐宿主原生搜索：同一套尺寸、同一套配色变量、同一套过渡时长。深浅主题自动跟随。

**查找不抢工作区。** 空查询时只占标题行一行，会话列表照常可见可点；只有真正输入内容才用结果替换列表。这一点和宿主原生搜索行为一致。

---

## 已知限制

- **面板收纳需要打开一次「更多」菜单**才生效。宿主只在菜单渲染时才提供 pin 回调，插件初始化拿不到——重启后打开一次菜单即恢复。
- **消息定位依赖已渲染的 DOM 行**。命中的消息如果太旧、当前视图还没加载到那一轮，会切到对应会话但不滚动定位。
- **选择器匹配的是宿主的 CSS 类名片段**（`[class*="_sectionHeader"]` 等）。宿主大改版可能失效，届时需要跟着调整。

---

## 开发

源码拆在 `src/` 下，按功能分 17 个片段；`client.js` 是构建产物，不要直接改。

```bash
# 改完 src/ 里的代码后构建
npm run build          # 拼装 + 语法检查 + 冒烟测试，全部通过才写 client.js

# 只校验，不写文件（CI / 提交前用）
npm run check

# 构建完同步到安装位置
node scripts/sync-plugin.mjs

# 重启 DSH 生效
```

**为什么是拼接而不是模块化：** 整个 `client.js` 跑在 ModuleLoader 的 factory 闭包里，所有片段本来就共享同一套闭包变量。改成各文件独立的模块作用域，需要给每个跨文件引用加显式 import/export，等于重写一遍——而且本机没有 esbuild/rollup，改坏了没有编译期兜底。按顺序拼接保持语义完全一致，新增或删除文件只改 `scripts/build.mjs` 里的 `ORDER`。

**安全阀：** 构建先 `node --check`，再跑冒烟测试（验证四个槽注册、六个 effect、CSS 完整性、收纳规则、pin 同步）。任一步失败就**不写 `client.js`**，原文件保持不动。`sync-plugin.mjs` 同步前也会先跑一次 `--check`，防止改了 `src/` 忘了构建。

源码在 `packages/dsh-sidebar-finder/`，安装副本在 `<profile>/node_modules/@local/dsh-sidebar-finder/`，两者物理分离。

### 片段清单

| 文件 | 行数 | 内容 |
|---|---|---|
| `src/00-head.js` | 7 | ModuleLoader 外壳、React 取值 |
| `src/10-constants.js` | 9 | 面板 id、locale 命名空间、选择器 |
| `src/20-dict.js` | 56 | 中英词典 |
| `src/30-open-state.js` | 20 | 跨 slot 的打开状态 |
| `src/40-icon.js` | 26 | 图标（viewBox 与放大镜对齐） |
| `src/50-measure.js` | 163 | 工作区矩形测量、底部边界探测 |
| `src/60-overlay-helpers.js` | 31 | `openFile`、关键词高亮 |
| `src/65-header-entry.js` | 157 | 标题行入口的位置计算 |
| `src/70-overlay.js` | 412 | 搜索浮层主体 |
| `src/75-fs-search.js` | 421 | 工作区文件遍历与内容匹配 |
| `src/80-msg-search.js` | 277 | 会话消息检索与跳转 |
| `src/85-t-safe.js` | 10 | 词典读取（未注入 locale 时回退中文） |
| `src/90-css.js` | 513 | 样式表 |
| `src/92-runtime-vars.js` | 148 | 运行时 CSS 变量、菜单宽度测量 |
| `src/94-fallback-panel.js` | 14 | 兜底页 |
| `src/96-collapse.js` | 130 | 面板收纳（CSS 生成 + 「更多」补行） |
| `src/99-plugin.js` | 148 | 插件对象（inject / apply） |

推送：

```bash
bash scripts/push.sh "提交说明"
```

---

## 许可

MIT
