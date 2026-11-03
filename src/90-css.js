/* 90-css.js —— 原 client.js 第 1590–2102 行 */
    // #region 样式
    const CSS = `
/* ---- 工作区标题行入口（贴住宿主图标区左侧） ---- */
/* 尺寸与取色照抄宿主 .searchButton：28×28、radius-sm、hover 变亮 */
.wf-entry {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm, 4px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.wf-entry:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.wf-entry:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}

/* ---- 工作区保底尺寸 ---- */
${SEL_SIDEBAR} [class*="_regionArea"] {
  min-height: var(--wf-region-min, 240px);
}
/* 面板多了自己滚，不再挤压工作区 */
${SEL_SIDEBAR} nav[class*="_panelList"] {
  max-height: var(--wf-panel-max, 40vh);
  overflow-y: auto;
  scrollbar-gutter: stable;
}

/* ---- 搜索浮层 ---- */
.wf-overlay {
  z-index: 40;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--dsw-alias-bg-base);
  border: 1px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
  /* 阴影只在「量不到位置」的卡片兜底形态下出现。原本 22% / 28px 在深色主题里
     会压出一圈发黑的灰边，比背景还暗；收到 14% / 16px，只留一层能感到的浮动。 */
  box-shadow: 0 4px 16px rgb(0 0 0 / 14%);
  overflow: hidden;
}
/* 就地展开形态：输入行压住原标题行、结果区占住原列表位置。
   底下的标题行和会话列表在打开期间被 data-wf-open 隐藏，
   所以这里可以用透明背景，不会透出任何东西。 */
.wf-overlay.is-inline {
  border: none;
  border-radius: 0;
  box-shadow: none;
  /* 必须不透明：底下的宿主标题行即使因为结构变动没藏住，
     也不会和我们的输入行叠字。
     颜色必须取侧边栏自己的填充色（--dsw-specific-sidebar-fill），
     不能用 bg-base —— 那是主区域的底色，和侧边栏本来就不同，
     铺上去会明显看出「这里贴了一块别的颜色」。 */
  background: var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base));
}
/* 输入行始终是 36px 高（宿主 sectionHeader 的高度），
   里面那个 28×28 图标按钮 + 30px 高的边框输入框，和原生放大镜展开后逐像素一致。
   is-inline 下不再单独改高度，否则会和基础样式打架。 */
.wf-overlay.is-inline .wf-head {
  /* 关键：基础样式里 .wf-head 是 height:100%（当年浮层是一张卡片，
     头部占满卡片高度是对的）。但就地展开后，浮层高度 = 标题行 + 列表区，
     再取 100% 会让输入行被 align-items:center 顶到整块正中间，
     页签和结果区则被挤出容器、被 overflow:hidden 裁掉。
     展开态下头部必须严格等于标题行高度。 */
  height: 36px;
  min-height: 36px;
  flex: none;
  margin-inline: 0;
  border-bottom: none;
}
.wf-overlay.is-inline .wf-tabs {
  border-bottom: 1px solid var(--dsw-alias-border-l3);
  /* 和结果区一起通栏，只留上下间距 */
  padding: 0;
  gap: 2px;
}
/* 就地展开形态下，页签用下划线而不是色块：
   色块 + 大内边距在这么窄的地方太压，视觉上盖过输入框。
   下划线是这类面板里最轻的分段方式，也和宿主的行内切换语感一致。 */
.wf-overlay.is-inline .wf-tab {
  padding: 6px 8px;
  border-radius: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
}
.wf-overlay.is-inline .wf-tab:hover {
  background: transparent;
  color: var(--dsw-alias-label-secondary);
}
.wf-overlay.is-inline .wf-tab.is-active {
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
  box-shadow: inset 0 -2px 0 var(--dsw-alias-label-primary);
}
/* ---- 就地展开：分两级让位，和原生放大镜一致 ---- */
/* 原生「展开」只把标题行换成输入框，会话列表照常显示；
   只有查询非空（deriveSearchResults 里 if (q === "") return items:[]）才切换成结果列表。
   我们没有标题行插槽，所以把原有的标题行藏掉、用输入行占它的位置。 */
/* head：只藏标题行，会话列表保留 —— 这是刚展开、还没输入时的状态 */
/* 注意：data-wf-open 加在侧边栏根节点自身上，所以这里用
   [data-wf-open="..."] 的属性选择器向后代匹配即可。
   故意不写 [data-slot="sidebar"] 前缀 —— 那个属性是宿主渲染器给的，
   一旦哪天改了写法，整条规则会静默失效；而我们自己 setAttribute 的
   data-wf-open 一定在，从它出发匹配最稳。 */
[data-wf-open="head"] [class*="_sectionHeader"] {
  visibility: hidden;
}
/* all：连列表一起让位 —— 有查询时结果区要接在输入行下面占住列表的位置 */
[data-wf-open="all"] [class*="_sectionHeader"],
[data-wf-open="all"] [class*="_listArea"],
[data-wf-open="all"] [class*="_treeBody"],
[data-wf-open="all"] [class*="_groupSection"] {
  visibility: hidden;
}
/* 紧凑态（空查询）：只有一行输入框，没有页签和结果区 */
.wf-overlay.is-inline.is-compact { height: auto !important; }
.wf-overlay.is-inline .wf-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  /* 横向不留内边距：结果区要和上面标题行一样通栏，
     缩进由每一行自己的 padding 负责，否则背景看着像缩了一圈。
     底部留 10px：最后一行不至于被容器边缘齐茬切断，
     紧挨着下面的「今日消耗金额」看着像被压住。 */
  padding: 4px 0 10px;
  /* 背景交给最外层的 .wf-overlay：这里再刷一层同样颜色，
     滚动条和圆角处会出现一道可见的接缝，看着像两个小方块叠着。 */
  background: transparent;
  overscroll-behavior: contain;
}
/* 滚动条用宿主侧边栏同款配色，默认那条浅灰在深色背景上很扎眼 */
.wf-overlay.is-inline .wf-body::-webkit-scrollbar { width: 8px; }
.wf-overlay.is-inline .wf-body::-webkit-scrollbar-track { background: transparent; }
.wf-overlay.is-inline .wf-body::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l2);
  border-radius: 4px;
}
.wf-overlay.is-inline .wf-body::-webkit-scrollbar-thumb:hover {
  background: var(--dsw-alias-scrollbar-hover-l2);
}
/* 底部渐隐：完全照抄宿主 .SJMXQW_fade 的思路 ——
   24px 高、绝对定位贴底、从透明渐变到侧边栏底色、不接收鼠标事件。
   原生用它来处理「列表在视觉上要给底部让位」，所以滚动内容
   到边缘时是柔和淡出，而不是被一刀切断。
   底色取 --wf-surface（.wf-overlay 上设的侧边栏实测色），
   拿不到时退回宿主自己的 sidebar-fill 变量。 */
.wf-overlay.is-inline .wf-fade {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 24px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    transparent,
    var(--wf-surface, var(--dsw-specific-sidebar-fill, var(--dsw-alias-bg-base)))
  );
}
/* 输入行：数值全部照抄宿主 .sectionHeader / .searchExpanded / .searchButton，
   这样展开后的观感和原生放大镜完全一致，看不出是两个来源。 */
.wf-head {
  display: flex;
  align-items: center;
  height: 100%;
  box-sizing: border-box;
  /* 宿主 .searchExpanded 是 width:calc(100% + 4px) + margin-inline:-2px，
     也就是比可用宽度向左右各多出 2px。这里容器不留内边距，
     由 .wf-searchbar 自己的负外边距完成外扩，和原生逐像素一致。 */
  padding: 0;
  border-bottom: 1px solid var(--dsw-alias-border-l3);
  color: var(--dsw-alias-label-caption);
  flex: none;
}
/* 对应宿主的 .searchExpanded：整个圆角边框是一个容器，
   图标、输入框、清除按钮都在框里面。 */
/* 对应宿主的 .searchExpanded：整个圆角边框是一个容器，
   图标、输入框、清除按钮都在框里面。
   外层已经按 header 几何算好了精确的 left/width，这里不再做负外边距外扩 ——
   负外边距要靠父级 overflow:hidden 裁剪才对称，我们没有那道裁剪，会露缺口。 */
.wf-searchbar {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  height: 30px;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 0 4px 0 0;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md, 8px);
  background: transparent;
}
/* 对应宿主的 .searchButton：28×28 的图标区，展开态图标 11px */
.wf-searchbar-icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--dsw-alias-label-caption);
}
/* 对应宿主的 .clearButton：常驻 24×24，颜色 label-secondary */
.wf-clearbtn {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: var(--dsw-radius-sm, 4px);
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.wf-clearbtn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.wf-clearbtn:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.wf-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  margin-left: -2px;
  padding: 0 0 0 2px;
}
.wf-input::placeholder { color: var(--dsw-alias-label-tertiary); }
.wf-body { flex: 1 1 auto; min-height: 0; overflow: auto; padding: 6px; }
.wf-hint { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
/* 无结果/等待/出错时的居中块：给一个图标和一行说明，而不是吊在左上角 */
.wf-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 22px 14px;
  text-align: center;
}
.wf-state-icon { color: var(--dsw-alias-label-dimmed); opacity: 0.55; }
.wf-state-text { color: var(--dsw-alias-label-tertiary); font-size: 12px; line-height: 18px; }
.wf-diag-wrap { margin-top: 2px; max-width: 100%; }
.wf-error { color: var(--dsw-alias-state-error-primary); }
/* 诊断行：只在出错时出现，等宽小字，便于把服务名看清楚 */
.wf-diag { margin-top: 6px; color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 1.5; word-break: break-all; user-select: text; }
.wf-meta {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  margin-bottom: 2px;
  padding: 2px 8px 0;
}
.wf-overlay.is-inline .wf-group {
  /* 分组标题吸顶：滚动时「当前会话 / 其他会话」始终可辨，
     否则一滚就不知道自己在看哪一组 */
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 8px 4px;
  background: var(--wf-surface, transparent);
}
.wf-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: none;
  border-radius: var(--dsw-radius-sm, 4px);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.wf-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.wf-row-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wf-row-sub {
  display: flex;
  flex-direction: column;
  gap: 1px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  font-family: var(--dsh-font-family-code, ui-monospace, monospace);
  overflow: hidden;
}
.wf-path {
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wf-line {
  display: flex;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.wf-lineno {
  flex: none;
  color: var(--dsw-alias-label-dimmed);
  min-width: 22px;
  text-align: right;
}
.wf-lead {
  flex: none;
  color: var(--dsw-alias-label-dimmed);
  margin-right: 1px;
}
.wf-mark {
  /* 原来只用 state-warn-secondary 铺底，在深色主题下几乎和正文同亮度，
     看不出高亮。这里同时改字色并加粗，任何主题下都能一眼分辨。 */
  background: var(--dsw-alias-state-warn-secondary);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
  border-radius: 2px;
  padding: 0 1px;
}

/* 文件 / 消息 切换页签 */
.wf-tabs {
  flex: none;
  display: flex;
  gap: 4px;
  padding: 0 10px 8px;
  border-bottom: 1px solid var(--dsw-alias-border-l3);
}
.wf-tab {
  flex: none;
  padding: 4px 12px;
  border: none;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.wf-tab:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.wf-tab.is-active {
  background: var(--dsw-alias-button-elevated-fill);
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.wf-group {
  flex: none;
  padding: 8px 2px 2px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  letter-spacing: 0.02em;
}
.wf-role {
  flex: none;
  margin-right: 6px;
  padding: 0 5px;
  border-radius: var(--dsw-radius-xs, 4px);
  background: var(--dsw-alias-bg-skeleton);
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 16px;
}
/* 跳转后短暂高亮定位到的消息 */
[data-wf-flash="true"] {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
  border-radius: var(--dsw-radius-sm, 6px);
  transition: outline-color 240ms ease;
}

/* 窄窗与减少动效 */
@media (max-width: 640px) {
  .wf-overlay { border-radius: 0; }
  .wf-state { padding: 16px 10px; gap: 6px; }
  .wf-head { padding: 6px 8px; }
  .wf-tab { padding: 4px 8px; }
}
@media (max-height: 520px) {
  .wf-state { padding: 12px 10px; }
  .wf-state-icon { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .wf-overlay,
  .wf-overlay .wf-head,
  .wf-overlay .wf-body,
  .wf-entry { animation: none !important; transition: none !important; }
}

/* ---- 展开动画：只动合成层，不碰布局 ---- */
/* 上一版用 clip-path 在整个工作区上做 260ms 揭幕，那是主线程上的重绘，
   一打开就整块重画，手感发涩。改成只用 opacity + 极小的位移：
   这两个属性由合成器处理，不触发 layout / paint，开起来是丝滑的。 */
@keyframes wf-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes wf-rise {
  from {
    opacity: 0;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.wf-overlay {
  animation: wf-fade 120ms ease-out both;
}
.wf-overlay .wf-head {
  animation: wf-fade 150ms ease-out both;
}
.wf-overlay .wf-body {
  animation: wf-rise 140ms ease-out both;
}
/* 入口按钮出现时同样淡入，避免它「啪」地跳进标题行 */
.wf-entry {
  animation: wf-fade 140ms var(--ds-ease-in-out, cubic-bezier(0.4, 0, 0.2, 1)) both;
}

/* ---- 「更多」里被收纳的面板行（自绘，不用 primitives） ---- */
/* 数值照抄宿主 Menu.module.css 的 .item / .separator，
   保证自绘行和原生菜单项在同一张卡片里看不出差别。 */
.wf-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  box-sizing: border-box;
  min-height: 34px;
  padding: 6px 8px;
  border: none;
  border-radius: var(--dsw-radius-md);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.wf-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.wf-menu-item:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover);
  outline: none;
}
.wf-menu-item[data-current="true"] { color: var(--dsw-alias-state-business-primary); }
/* 被收纳面板的容器：限高 + 内部滚动。
   宿主菜单自身有 max-height，行数一多就把最后一行截断；
   给这一段单独限高后，菜单总高是稳定的，超出只在这里滚。 */
/* 「更多」菜单要和它自己那一行按钮的背景严丝合缝对齐。
   宿主定位是 x = anchorRect.right - 菜单宽度，所以只要菜单宽度 === 锚点按钮宽度，
   左边缘就会自动落在按钮左边缘上。
   --wf-more-w 由 JS 实测「更多」按钮的 rect 写入（见 measureMoreAnchor）。
   三个宽度属性都要写：宿主的 place() 会往菜单元素上写内联 min-width
   （= Math.min(锚点宽, ...)），只改 width 会被它顶住，实测就差那 11px。 */
[class*="_moreMenu"] {
  width: var(--wf-more-w, 288px) !important;
  min-width: var(--wf-more-w, 288px) !important;
  max-width: var(--wf-more-w, 288px) !important;
}
/* 菜单变窄后长标签要能省略，不能撑破卡片 */
.wf-menu-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.wf-menu-list {
  /* 这里刻意不设 max-height / overflow：
     宿主的 Menu 外层已经有 .scrollable（max-height 按视口算），
     自己再套一层就会出第二个滚动条，看着像菜单里嵌了个小窗口。
     交给宿主统一滚，行为跟原生项完全一致。 */
  display: flex;
  flex-direction: column;
}
.wf-menu-sep {
  height: 0.5px;
  margin: 3px 2px;
  background: var(--dsw-alias-border-l2, var(--dsw-alias-border-l3));
}
`;

