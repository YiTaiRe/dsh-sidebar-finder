/**
 * Host half of the sidebar-finder bundle.
 *
 * The Client module owns all rendering. This half exists so the bundle has a
 * Host entry point (the loader applies it) and so the configuration shape has
 * a single declared home. It deliberately registers no services: everything
 * the plugin needs (slots, layout, locale) is Client-side.
 */
import z from '@deepseek-ai/schemastery';

/**
 * 配置形态声明。
 *
 * 设计原则：**声明形状，但不让校验拦住插件启动**。
 *
 * cordis 的 `Fiber._reload()` 里 `this._resolveConfig()` 抛 ValidationError 时，
 * 错误会被 `logger.error` 记下、fiber 进入 `_error` 状态 —— 整个插件**不激活**。
 * 也就是说 schema 写严了，用户在 patch 里把 `workspaceMinHeight` 写成字符串，
 * 代价不是"这个配置没生效"，而是"这个插件整个不见了"，且原因藏在控制台里。
 *
 * 所以数值 / 布尔一律用 `union([正确类型, 字符串])`：
 * 既保留了"这里应该填什么"的声明（设置页与文档都读它），
 * 又允许 Excel 式的字符串写法进去，由 client 侧的 Number() / `=== true` 自行归一。
 *
 * 真正需要它帮忙挡的，是"整块写错"——比如把 `excludeDirs` 写成对象、
 * 把 `alwaysVisible` 写成数字。这些仍然会在 union 下报错，
 * 而且报错信息会明确指向字段名。
 */
const num = (fallback, note) => z.union([z.number(), z.string()]).default(fallback).description(note);
const flag = (fallback, note) => z.union([z.boolean(), z.string()]).default(fallback).description(note);
const list = (fallback, note) => z.union([z.array(z.string()), z.string()]).default(fallback).description(note);

export const Config = z.object({
  /** 顶部区常驻可见的面板 id。`plugins` 由宿主强制常驻，列出只为声明意图。 */
  alwaysVisible: list(['plugins', 'mnemon'], '顶部区常驻的面板 id 列表'),
  /** true：不在 alwaysVisible 里的面板全部收进「更多」。 */
  collapseOthers: flag(true, '是否把非白名单面板收进「更多」'),
  /** 工作区最小高度（px），防止被上方面板列表挤扁。 */
  workspaceMinHeight: num(240, '工作区最小高度（px）'),
  /** 面板列表最大高度（vh），超过则自己滚动。 */
  panelListMaxHeightVh: num(40, '面板列表最大高度（vh）'),
  /** 「查找」行的位置（保留键，当前实现固定在「更多」之后）。 */
  finderPosition: z.string().default('after-more').description('「查找」行位置'),
  /** 搜索时排除的目录名（任意层级）。 */
  excludeDirs: list(
    ['.git', 'node_modules', 'dist', 'build', '.venv', '__pycache__', '.next', 'target'],
    '搜索时排除的目录名（任意层级）',
  ),
  /** 单次搜索最大结果数。 */
  maxResults: num(200, '单次搜索最大结果数'),
  /** 目录递归深度上限。 */
  maxDepth: num(12, '目录递归深度上限'),
  /** 内容匹配的文件数预算（超出只做文件名匹配）。 */
  textFileBudget: num(120, '内容匹配的文件数预算'),
  /** 单文件最多读取行数。 */
  maxContentLines: num(4000, '单文件最多读取行数'),
  /** 消息检索：最多返回多少条消息命中。 */
  maxMessageResults: num(40, '消息检索最多返回条数'),
  /** 消息检索：除当前会话外，最多钻进多少个其他会话。 */
  maxMessageSessions: num(6, '消息检索最多钻取的会话数'),
  /** 消息检索：每个会话最多向前翻多少页历史。 */
  messagePageBudget: num(8, '每个会话最多翻页数'),
  /** 输入防抖（ms）。 */
  debounceMs: num(300, '输入防抖（ms）'),
  /** 快捷键；null 表示不注册，例如 "Ctrl+Shift+F"。 */
  shortcut: z.any().default(null).description('快捷键，null 表示不注册'),
});

export function apply() {}
