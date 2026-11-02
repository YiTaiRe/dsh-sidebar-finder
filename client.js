window.__ModuleLoader__.load({
  id: '@local/dsh-sidebar-finder',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useRef, useEffect, useCallback } = React;

    // #region 常量
    /** 面板 id。也用作 main 槽的 key。 */
    const PANEL_ID = 'sidebar-finder';
    /** locale 命名空间。 */
    const NS = 'sidebar-finder';
    /** 宿主侧边栏的类名带哈希前缀（x-Wl6W_），用属性选择器避开升级改名。 */
    const SEL_SIDEBAR = '[data-slot="sidebar"]';
    // #endregion

    // #region 字典
    const zh = {
      finder: {
        title: '查找',
        placeholder: '搜索工作区文件…',
        empty: '未找到匹配',
        hint: '输入关键词开始搜索',
        searching: '搜索中…',
        count: '找到 {n} 个结果',
        truncated: '结果已截断',
        failed: '搜索失败，请重试',
        noApi: '当前环境不支持工作区搜索',
        noSession: '没有打开的工作区',
        close: '关闭',
        fileGroup: '文件',
        msgGroup: '消息',
        msgEmpty: '消息里没有匹配',
        msgScanning: '正在翻查会话消息…',
        msgHere: '当前会话',
        msgOther: '其他会话',
        msgTurn: '第 {n} 轮',
        msgOpenFail: '无法定位到该消息',
        msgPlaceholder: '搜索会话消息…',
      },
      panels: { more: '更多' },
      collapse: { done: '已按配置收纳 {n} 项', none: '无需收纳' },
      fallback: { title: '工作区查找', body: '在侧边栏点「查找」可打开搜索浮层。' },
      dock: {
        toggle: '更多附件与操作',
        recent: '最近改动',
        loading: '正在读取工作区…',
        empty: '工作区里还没有可引用的文件',
        failed: '读不到工作区文件',
        noSession: '还没有打开的会话',
        insert: '插入引用',
        open: '在查找中浏览…',
        inserted: '已插入引用',
        notReady: '输入框还没准备好，稍后再试',
      },
    };
    const en = {
      finder: {
        title: 'Find',
        placeholder: 'Search workspace files…',
        empty: 'No match',
        hint: 'Type to start searching',
        searching: 'Searching…',
        count: '{n} result(s)',
        truncated: 'results truncated',
        failed: 'Search failed, please retry',
        noApi: 'Workspace search is unavailable here',
        noSession: 'No workspace is open',
        close: 'Close',
        fileGroup: 'Files',
        msgGroup: 'Messages',
        msgEmpty: 'No match in messages',
        msgScanning: 'Scanning session messages…',
        msgHere: 'Current session',
        msgOther: 'Other sessions',
        msgTurn: 'Turn {n}',
        msgOpenFail: 'Cannot locate that message',
        msgPlaceholder: 'Search session messages…',
      },
      panels: { more: 'More' },
      collapse: { done: 'Collapsed {n} panel(s) per config', none: 'Nothing to collapse' },
      fallback: { title: 'Workspace finder', body: 'Open the search overlay from "Find" in the sidebar.' },
      dock: {
        toggle: 'More attachments & actions',
        recent: 'Recently changed',
        loading: 'Reading workspace…',
        empty: 'No files to reference yet',
        failed: 'Cannot read workspace files',
        noSession: 'No open session',
        insert: 'Insert reference',
        open: 'Browse in Find…',
        inserted: 'Reference inserted',
        notReady: 'Composer is not ready, try again',
      },
    };
    // #endregion

    // #region 打开状态（图标行与浮层跨 slot 共享）
    let open = false;
    const listeners = new Set();
    function setOpen(next) {
      if (open === next) return;
      open = next;
      listeners.forEach((fn) => fn(open));
    }
    /**
     * 给「在自己组件里也叫 setOpen」的地方用的别名。
     * 模块级的 setOpen 会被组件内的 useState 解构遮蔽，
     * 所以发图区那块统一走这个不会撞名的入口。
     */
    function openFinderOverlay() {
      setOpen(true);
    }
    function useOpen() {
      const [, force] = useState(0);
      useEffect(() => {
        const fn = () => force((n) => n + 1);
        listeners.add(fn);
        return () => listeners.delete(fn);
      }, []);
      return open;
    }
    // #endregion

    // #region 图标
    function FinderIcon({ size = 18 }) {
      // 内容查找图标：文档 + 文本行，刻意与宿主的放大镜（会话搜索）区分。
      //
      // 尺寸对齐的关键在 viewBox，不在 size 数值。
      // 原生 IconSearchOutlineRegular 是 Fluent 图标，字形几乎填满画布；
      // 先前用 "0 0 24 24" 时，这个文档只占约 71% 高度 / 54% 宽度，
      // 于是同为 14px 也显得比放大镜小一圈。
      // 这里把 viewBox 收紧到描边包围盒（4.75..20.25 / 2.75..20.25 再取正方形），
      // 图标即以真实尺寸绘制，和放大镜视觉等大；保持正方形避免被拉伸。
      return h(
        'svg',
        {
          viewBox: '2.75 2.75 18.5 18.5', width: size, height: size,
          fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
          strokeLinecap: 'round', strokeLinejoin: 'round',
          'aria-hidden': true, style: { display: 'block' },
        },
        h('path', { d: 'M5.5 3.5h8.5l4.5 4.5v12.5H5.5z' }),
        h('path', { d: 'M14 3.5V8h4.5' }),
        h('path', { d: 'M8.5 12h7' }),
        h('path', { d: 'M8.5 15.5h4.5' }),
      );
    }
    // #endregion

    // #region 工作区矩形测量
    /**
     * 量工作区（regionArea）在视口中的位置，让浮层精确覆盖它。
     * 只用宿主导出的结构标记；量不到时回退到居中卡片。
     */
    function measureRegion() {
      const why = (reason, extra) => {
        try {
          window.__wfDiag = Object.assign({ reason, at: Date.now() }, extra || {});
        } catch { /* 忽略 */ }
        return null;
      };
      try {
        const root = document.querySelector(SEL_SIDEBAR);
        if (!root) return why('no-sidebar-root', { sel: SEL_SIDEBAR });
        const region = root.querySelector('[class*="_regionArea"]');
        if (!region) {
          const classes = Array.from(root.querySelectorAll('*')).slice(0, 40)
            .map((el) => el.className && String(el.className)).filter(Boolean);
          return why('no-region-area', { sample: classes });
        }
        const r = region.getBoundingClientRect();
        if (r.width < 80 || r.height < 80) {
          return why('region-too-small', { w: Math.round(r.width), h: Math.round(r.height) });
        }
        // 标题行（sectionHeader）也在这个矩形里。原生是「标题行原位变成输入框」，
        // 所以把矩形拆成两段：head 精确压住标题行，body 接在它下面，
        // 看上去就是那一行自己变了，而不是上面盖了一层。
        const header = root.querySelector('[class*="_sectionHeader"]');
        let headTop = r.top;
        let headHeight = 36;
        // 横向分两层看：
        //   barXxx  = 输入框的视觉范围（和原生 .searchExpanded 逐像素对齐）
        //   bodyXxx = 结果区/背景的范围（通栏，和原生 .listArea 等宽）
        // 原生 .searchExpanded 是 width:calc(100% + 4px) + margin-inline:-2px，
        // 向右溢出的 2px 被 .sectionHeader 的 overflow:hidden 裁掉，
        // 所以输入框视觉上 = left: hr.left + 2、width: hr.width - 2。
        let barLeft = r.left;
        let barWidth = r.width;
        if (header) {
          const hr = header.getBoundingClientRect();
          if (hr.height >= 16 && hr.width >= 80) {
            headTop = hr.top;
            headHeight = hr.height;
            // 原生 .searchExpanded 是 width:calc(100% + 4px) + margin-inline:-2px，
            // 向右溢出的 2px 被 .sectionHeader 的 overflow:hidden 裁掉。
            // 所以视觉上：左边缘 = hr.left + 2，宽度 = hr.width - 2。
            // 之前写成 hr.width - 4，右侧就一直差 2px，和放大镜对不齐。
            barLeft = hr.left + 2;
            barWidth = Math.max(80, hr.width - 2);
          }
        }
        // 底部界限：footArea（「今日消耗金额」那一栏）在 regionArea 之后，
        // 但它可能因为内容溢出或绝对定位压进工作区范围。
        // 结果区必须止步在它上边缘，否则列表会从它下面穿过去。
        let bottomLimit = r.top + r.height;
        try {
          const foot = root.querySelector('[class*="_footArea"]');
          if (foot) {
            const fr = foot.getBoundingClientRect();
            if (fr.height > 0 && fr.top > r.top && fr.top < bottomLimit) {
              bottomLimit = fr.top;
            }
          }
        } catch { /* 忽略 */ }

        // 取侧边栏根节点实际渲染出的底色。--dsw-specific-sidebar-fill
        // 是定义在侧边栏根节点上的自定义属性，而我们的浮层挂在 shell.overlay
        // （侧边栏的兄弟节点），拿不到继承值，只能用计算后的颜色。
        let sidebarFill = '';
        try {
          const computed = window.getComputedStyle(root).backgroundColor;
          if (computed && computed !== 'transparent' && computed !== 'rgba(0, 0, 0, 0)') {
            sidebarFill = computed;
          }
        } catch { /* 忽略 */ }
        return {
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
          sidebarFill,
          headTop,
          headHeight,
          barLeft,
          barWidth,
          // 背景与结果区用整块工作区宽度，和原生列表通栏一致
          bodyLeft: r.left,
          bodyWidth: r.width,
          // 输入框相对整块的内缩量：容器通栏后，靠这两个值把输入框摆回原位
          headPadLeft: Math.max(0, barLeft - r.left),
          headPadRight: Math.max(0, (r.left + r.width) - (barLeft + barWidth)),
          bodyTop: headTop + headHeight,
          bodyHeight: Math.max(0, bottomLimit - (headTop + headHeight)),
          // 结果区能用的最大高度：矮窗口下也不能把输入行挤掉
          maxBody: Math.max(0, bottomLimit - (headTop + headHeight)),
        };
      } catch (error) {
        return why('threw', { message: error && error.message ? error.message : String(error) });
      }
    }
    // #endregion

    // #region 搜索浮层
    /**
     * 点结果时打开文件。宿主把「打开工作区文件」放在 remote.session 上，
     * 走它才能复用宿主自己的预览面板，而不是另开窗口。
     */
    function openFile(ctx, path) {
      try {
        const remoteSession = serviceOf(ctx, 'remote.session') || remoteOf(ctx)?.session;
        if (remoteSession?.openWorkspacePath) {
          Promise.resolve(remoteSession.openWorkspacePath({ path })).catch(() => {});
          return true;
        }
      } catch {
        /* 打不开就只关浮层 */
      }
      return false;
    }

    /** 结果里高亮关键词的那一段。 */
    function Highlighted({ text, query }) {
      const parts = highlightSegments(text, query);
      if (parts.length === 1) return parts[0].text;
      return h(
        React.Fragment,
        null,
        parts.map((part, i) => (part.hit
          ? h('mark', { key: i, className: 'wf-mark' }, part.text)
          : h(React.Fragment, { key: i }, part.text))),
      );
    }

    // #region 工作区标题行入口
    /**
     * 宿主把工作区标题行（sectionLabel + 搜索/设置/新建三个图标）整块写死在
     * WorkspaceBrowser 里，sidebar.workspaces 的子插槽只有 directoryFlow /
     * session.menu.item / session.row.action / leading / hover，没有头部插槽。
     *
     * 所以这里用一个贴在标题行图标区左侧的小按钮作入口：位置在每次布局后
     * 用 getBoundingClientRect 量出来，样式照抄宿主的 searchButton
     * （28×28、radius-sm、hover 变亮），视觉上和那三个图标同排。
     */
    // 收起动画期间，搜索槽的 left 和右侧图标组的宽度都在过渡中，
    // 实时读到的都是中间值。这里缓存一次「动画结束后」的稳定值，
    // 动画期间直接用它，位置就不会漂。
    let cachedSlotLeft = 0;

    function measureHeaderSlot() {
      try {
        const root = document.querySelector(SEL_SIDEBAR);
        if (!root) return null;
        const header = root.querySelector('[class*="_sectionHeader"]');
        if (!header) return null;
        const hr = header.getBoundingClientRect();
        if (hr.width < 80 || hr.height < 16) return null;
        // 宿主的会话搜索展开后，输入框铺满整行、把图标区挤走，这时让位。
        if (header.querySelector('[class*="_searchExpanded"]')
          || header.querySelector('[class*="_searchSlotExpanded"]')) {
          return null;
        }
        const slot = header.querySelector('[class*="_searchSlot"]');
        const size = 28;
        let right;
        if (slot) {
          const sr = slot.getBoundingClientRect();
          if (sr.width <= 34) {
            // 已经完全收拢：这是精确值，记下来当基准
            cachedSlotLeft = sr.left;
            right = sr.left;
          } else {
            // 还在 .18s 收起过渡中。实时读会拿到一路滑动的中间值，
            // 用刚才缓存的稳定基准，一帧就能给出终点位置。
            right = cachedSlotLeft || (hr.right - 96);
          }
        } else {
          const actions = header.querySelector('[class*="_headerActions"]');
          right = actions ? actions.getBoundingClientRect().left : (hr.right - 96);
        }
        // 图标区左侧至少要留出一个按钮的宽度，否则不显示（宁可没有入口，也不重叠）
        const left = Math.round(right - size - 4);
        if (left < hr.left + 2) return null;
        return {
          top: hr.top + Math.round((hr.height - size) / 2),
          left,
          size,
        };
      } catch {
        return null;
      }
    }

    function makeHeaderEntry(ctx, config) {
      return function HeaderEntry() {
        const isOpen = useOpen();
        const [pos, setPos] = useState(null);

        useEffect(() => {
          // 浮层打开时让位给搜索框
          if (isOpen) return undefined;
          let stopped = false;
          let raf = 0;
          let last = '';
          const settles = [];

          const apply = () => {
            if (stopped) return;
            const next = measureHeaderSlot();
            const key = next ? `${next.top}:${next.left}` : '';
            if (key !== last) {
              last = key;
              setPos(next);
            }
          };
          // 合并同一帧内的多次触发，避免重复量布局
          const schedule = () => {
            if (stopped || raf) return;
            raf = window.requestAnimationFrame(() => {
              raf = 0;
              apply();
            });
          };
          // 宿主的展开/收起是 width .18s 的过渡。收起后第一次重量就能拿到
          // 稳定基准（缓存进 measureHeaderSlot），所以这里只需要在动画结束后
          // 再补一次，确认最终位置 —— 补太多次会让每帧都重渲染，反而显得卡。
          const settle = () => {
            schedule();
            settles.push(window.setTimeout(apply, 210));
          };

          apply();

          // 通路一：点标题行（放大镜 / 视图选项 / 导入）时立刻重量。
          // 原生一展开就把搜索槽撑满，我的图标要让位，这里不能等轮询。
          const onClick = (event) => {
            const header = document.querySelector(`${SEL_SIDEBAR} [class*="_sectionHeader"]`);
            if (header && event.target instanceof Node && header.contains(event.target)) {
              settle();
            }
          };
          window.addEventListener('click', onClick, true);

          // 通路二：DOM 变化时立刻重量。
          // 观察的是标题行的**父节点**而不是标题行本身 —— React 在开关搜索时
          // 会重建标题行节点，直接观察它的话回调就跟着旧节点一起废掉了。
          const anchor = document.querySelector(`${SEL_SIDEBAR} [class*="_sectionHeader"]`);
          let observer = null;
          if (typeof MutationObserver !== 'undefined') {
            const target = (anchor && anchor.parentElement) || document.querySelector(SEL_SIDEBAR);
            if (target) {
              observer = new MutationObserver(settle);
              observer.observe(target, {
                attributes: true,
                attributeFilter: ['class', 'style'],
                childList: true,
                subtree: true,
              });
            }
          }

          window.addEventListener('resize', settle);
          return () => {
            stopped = true;
            if (raf) window.cancelAnimationFrame(raf);
            settles.forEach((id) => window.clearTimeout(id));
            if (observer) observer.disconnect();
            window.removeEventListener('click', onClick, true);
            window.removeEventListener('resize', settle);
          };
        }, [isOpen]);

        if (isOpen || !pos) return null;
        return h('button', {
          type: 'button',
          className: 'wf-entry',
          onClick: () => setOpen(true),
          'aria-label': tSafe('finder.title'),
          title: tSafe('finder.title'),
          style: {
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: pos.size,
            height: pos.size,
            zIndex: 30,
          },
        }, h(FinderIcon, { size: 14 }));
      };
    }
    // #endregion

    function makeSearchOverlay(ctx, config) {
      return function SearchOverlay() {
        const isOpen = useOpen();
        const [box, setBox] = useState(null);
        const [query, setQuery] = useState('');
        const [mode, setMode] = useState('files');
        const [state, setState] = useState({ status: 'idle', results: [], scanned: 0, truncated: false, error: null });
        const inputRef = useRef(null);
        const abortRef = useRef(null);

        // 打开期间让宿主的那一行（和列表）让位。
        // 除了写属性给 CSS 用，这里还直接改内联样式 —— 属性选择器一旦因为
        // 宿主结构变动而失配，内联样式仍然能把标题行藏住，不会两层叠在一起。
        // 让位完全通过属性 + 样式表完成，不碰宿主节点的 style。
        // 之前这里是 hideNode() 直接写 el.style.visibility：
        //   1. 违反 practices.md「不得写 slot 外的 DOM」；
        //   2. 宿主 React 重渲染时会把内联样式覆盖回去，还原时我们又把
        //      自己之前记录的旧值写回去，两边互相打架，肉眼表现是
        //      "偶尔标题行闪回来一下"。
        // 现在只 setAttribute / removeAttribute 自己的标记，让 CSS 去隐藏。
        useEffect(() => {
          const node = document.querySelector(SEL_SIDEBAR);
          if (!node) return undefined;
          const hasQuery = query.trim() !== '';
          if (!isOpen) node.removeAttribute('data-wf-open');
          else node.setAttribute('data-wf-open', hasQuery ? 'all' : 'head');
          return () => {
            const current = document.querySelector(SEL_SIDEBAR);
            if (current) current.removeAttribute('data-wf-open');
          };
        }, [isOpen, query]);

        // 打开时量一次；窗口尺寸变化时重量
        useEffect(() => {
          if (!isOpen) {
            setBox(null);
            return undefined;
          }
          const remeasure = () => setBox(measureRegion());
          remeasure();
          window.addEventListener('resize', remeasure);
          const timer = window.setTimeout(remeasure, 60);
          return () => {
            window.removeEventListener('resize', remeasure);
            window.clearTimeout(timer);
          };
        }, [isOpen]);

        // Esc 关闭；打开时聚焦输入框；关闭时清空
        useEffect(() => {
          if (!isOpen) {
            setQuery('');
            setState({ status: 'idle', results: [], scanned: 0, truncated: false, error: null });
            return undefined;
          }
          const onKey = (event) => {
            if (event.key === 'Escape') setOpen(false);
          };
          window.addEventListener('keydown', onKey);
          const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 20);
          return () => {
            window.removeEventListener('keydown', onKey);
            window.clearTimeout(focusTimer);
          };
        }, [isOpen]);

        // 输入防抖后真正搜索；上一次没跑完就取消
        useEffect(() => {
          if (!isOpen) return undefined;
          const q = query.trim();
          if (!q) {
            setState({ status: 'idle', results: [], scanned: 0, truncated: false, error: null });
            return undefined;
          }
          const debounceMs = Math.max(0, Number(config && config.debounceMs) || 300);
          let cancelled = false;
          const timer = window.setTimeout(() => {
            if (cancelled) return;
            if (abortRef.current) abortRef.current.abort();
            const controller = typeof AbortController === 'function' ? new AbortController() : null;
            abortRef.current = controller;
            setState((prev) => ({ ...prev, status: 'searching', error: null }));
            const runner = mode === 'messages' ? runMessageSearch : runSearch;
            runner(ctx, q, {
              excludeDirs: config && config.excludeDirs,
              maxResults: config && config.maxResults,
              maxDepth: config && config.maxDepth,
              contentFileBudget: config && config.textFileBudget,
              maxContentLines: config && config.maxContentLines,
              maxHits: config && config.maxMessageResults,
              maxSessionCandidates: config && config.maxMessageSessions,
              maxPages: config && config.messagePageBudget,
              signal: controller ? controller.signal : undefined,
            })
              .then((res) => {
                if (cancelled) return;
                if (res.error === 'aborted') return;
                setState({
                  status: res.error ? 'error' : 'done',
                  results: res.results || [],
                  scanned: res.scanned || 0,
                  truncated: Boolean(res.truncated),
                  error: res.error || null,
                  missing: res.missing || [],
                  services: res.services || [],
                  message: res.message || '',
                  stats: res.stats || null,
                  scopePath: (res.scope && res.scope.cwd) || '',
                });
              })
              .catch((error) => {
                if (!cancelled) {
                  setState({
                    status: 'error', results: [], scanned: 0, truncated: false, error: 'failed',
                    missing: [], services: [], message: error && error.message ? error.message : String(error),
                  });
                }
              });
          }, debounceMs);
          return () => {
            cancelled = true;
            window.clearTimeout(timer);
            if (abortRef.current) {
              try { abortRef.current.abort(); } catch { /* 已结束 */ }
              abortRef.current = null;
            }
          };
        }, [isOpen, query, mode]);

        if (!isOpen) return null;

        // 照宿主的会话搜索做：展开只把标题行换成输入框，下面的会话列表照常显示；
        // 只有真的输入了内容，才在列表位置盖上来显示匹配结果。
        // 原生 deriveSearchResults 第一行就是 if (q === "") return { items: [] }，
        // 空查询不产生任何结果，列表也就不会被替换 —— 这里保持一致。
        const hasQuery = query.trim() !== '';
        const style = box
          ? {
            position: 'fixed',
            top: box.headTop,
            // 容器通栏（和工作区同宽）：背景、页签、结果区都吃满，
            // 输入框的内缩交给 .wf-head 的 padding，这样两者各自到位。
            left: box.bodyLeft,
            width: box.bodyWidth,
            // 背景取侧边栏实测底色，视觉上才算「同一块」。
            // 同时存成变量：吸顶的分组标题要用同一个颜色，
            // 否则文字会从它下面透上来。
            background: box.sidebarFill || undefined,
            '--wf-surface': box.sidebarFill || 'transparent',
            // 空查询：只占标题行那一行的高度，不碰下面的列表。
            // 有查询：铺到 footArea 上边缘为止（bodyHeight 已经扣掉了 footArea），
            // 内容比可用高度短时按内容收缩，不硬撑出空白。
            height: hasQuery
              ? Math.max(120, Math.min(box.bodyHeight + box.headHeight,
                box.maxBody + box.headHeight))
              : box.headHeight,
          }
          : {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 520,
            height: 'auto',
            maxHeight: 420,
          };
        const overlayClass = box
          ? `wf-overlay is-inline${hasQuery ? '' : ' is-compact'}`
          : 'wf-overlay';

        const body = [];
        // 空/等待/出错这些「没有结果」的状态统一用居中的小块呈现，
        // 避免浮层里孤零零一行小字吊在左上角。
        const stateBlock = (key, text, extra) => h(
          'div',
          { key, className: 'wf-state' },
          h('div', { className: 'wf-state-icon' }, h(FinderIcon, { size: 20 })),
          h('div', { className: 'wf-state-text' }, text),
          extra || null,
        );
        if (state.status === 'idle') {
          body.push(stateBlock('hint', tSafe('finder.hint')));
        } else if (state.status === 'searching') {
          body.push(stateBlock('busy', tSafe(mode === 'messages' ? 'finder.msgScanning' : 'finder.searching')));
        } else if (state.status === 'error') {
          const key = state.error === 'no-api'
            ? 'finder.noApi'
            : state.error === 'no-session'
              ? 'finder.noSession'
              : 'finder.failed';
          // 诊断信息：缺哪个服务、当前运行时有哪些服务。定位问题靠它，正常时不出现。
          const detail = [];
          if (state.missing && state.missing.length) detail.push(`缺少: ${state.missing.join(', ')}`);
          if (state.services && state.services.length) detail.push(`可用: ${state.services.join(', ')}`);
          if (state.message) detail.push(state.message);
          body.push(stateBlock(
            'err',
            h('span', { className: 'wf-error' }, tSafe(key)),
            detail.length ? h('div', { className: 'wf-diag' }, detail.join(' | ')) : null,
          ));
        } else if (!state.results.length) {
          // 零结果时把遍历实况写出来：扫了几个目录、拿到多少条目、有没有报错
          const s = state.stats;
          const lines = [];
          if (mode !== 'messages' && s) {
            const bits = [`目录 ${s.dirs || 0}`, `条目 ${s.entries || 0}`, `文件 ${state.scanned || 0}`];
            if (s.sampleTypes && s.sampleTypes.length) bits.push(`类型 ${s.sampleTypes.join('/')}`);
            if (state.scopePath) bits.push(`根 ${state.scopePath}`);
            lines.push(h('div', { key: 'scan', className: 'wf-diag' }, `扫描: ${bits.join(' · ')}`));
            if (s.errors && s.errors.length) {
              lines.push(h('div', { key: 'scanErr', className: 'wf-diag' }, `错误: ${s.errors.join(' | ')}`));
            }
          }
          body.push(stateBlock(
            'empty',
            tSafe(mode === 'messages' ? 'finder.msgEmpty' : 'finder.empty'),
            lines.length ? h('div', { className: 'wf-diag-wrap' }, lines) : null,
          ));
        } else {
          body.push(h(
            'div',
            { key: 'meta', className: 'wf-meta' },
            tSafe('finder.count').replace('{n}', String(state.results.length)),
            state.truncated ? ` · ${tSafe('finder.truncated')}` : '',
          ));
          if (mode === 'messages') {
            // 按「当前会话 / 其他会话」分组，避免长结果里分不清来源
            const groups = [
              { key: 'current', labelKey: 'finder.msgHere' },
              { key: 'other', labelKey: 'finder.msgOther' },
            ];
            for (const group of groups) {
              const items = state.results.filter((item) => item.scope === group.key);
              if (!items.length) continue;
              body.push(h('div', { key: `g-${group.key}`, className: 'wf-group' }, tSafe(group.labelKey)));
              items.forEach((item, i) => {
                body.push(h(
                  'button',
                  {
                    key: `m:${item.sessionId}:${item.seq}:${i}`,
                    type: 'button',
                    className: 'wf-row',
                    title: `${item.sessionTitle || item.sessionId}${typeof item.turn === 'number' ? ` · ${tSafe('finder.msgTurn').replace('{n}', String(item.turn))}` : ''}`,
                    onClick: () => {
                      openMessage(ctx, item).then((ok) => {
                        if (ok) setOpen(false);
                      });
                    },
                  },
                  h(
                    'span',
                    { className: 'wf-row-name' },
                    h('span', { className: 'wf-role' }, item.role === 'user/message' ? '你' : 'AI'),
                    // 命中前若有被裁掉的内容，补一个前置省略号，
                    // 否则看起来像是消息开头就是这几个字
                    item.lead ? h('span', { className: 'wf-lead' }, '…') : null,
                    h(Highlighted, { text: item.snippet, query }),
                  ),
                  h(
                    'span',
                    { className: 'wf-row-sub wf-path' },
                    item.sessionTitle || item.sessionId,
                    typeof item.turn === 'number' ? ` · ${tSafe('finder.msgTurn').replace('{n}', String(item.turn))}` : '',
                  ),
                ));
              });
            }
          } else {
            state.results.forEach((item, i) => {
              body.push(h(
                'button',
                {
                  key: `${item.kind}:${item.path}:${i}`,
                  type: 'button',
                  className: 'wf-row',
                  title: item.path,
                  onClick: () => {
                    openFile(ctx, item.path);
                    setOpen(false);
                  },
                },
                h('span', { className: 'wf-row-name' }, h(Highlighted, { text: item.name, query })),
                item.kind === 'content' && item.matches.length
                  ? h(
                    'span',
                    { className: 'wf-row-sub' },
                    item.matches.slice(0, 2).map((m, k) => h(
                      'span',
                      { key: k, className: 'wf-line' },
                      h('span', { className: 'wf-lineno' }, String(m.lineNumber)),
                      m.lead ? h('span', { className: 'wf-lead' }, '…') : null,
                      h(Highlighted, { text: m.line, query }),
                    )),
                  )
                  : h('span', { className: 'wf-row-sub wf-path' }, item.path),
              ));
            });
          }
        }

        return h(
          'div',
          { className: overlayClass, style, role: 'dialog', 'aria-label': tSafe('finder.title') },
          h(
            'div',
            {
              className: 'wf-head',
              style: box
                ? { paddingLeft: box.headPadLeft, paddingRight: box.headPadRight }
                : undefined,
            },
            /* 完全照宿主 .searchExpanded 的内部结构：
               [[图标] [输入框] [清除×]] 全都在同一个 30px 高的圆角边框里，
               而不是图标在外、输入框在内两个独立元件。 */
            h(
              'div',
              { className: 'wf-searchbar' },
              h('span', { className: 'wf-searchbar-icon', 'aria-hidden': true },
                h(FinderIcon, { size: 11 })),
              h('input', {
                ref: inputRef,
                className: 'wf-input',
                /* 用 text 而不是 search：type=search 会被浏览器加上一个原生清除圆叉，
                   和宿主的输入框不一致，看起来像多了一个按钮。 */
                type: 'text',
                value: query,
                placeholder: tSafe(mode === 'messages' ? 'finder.msgPlaceholder' : 'finder.placeholder'),
                'aria-label': tSafe(mode === 'messages' ? 'finder.msgPlaceholder' : 'finder.placeholder'),
                onChange: (event) => setQuery(event.target.value),
                onKeyDown: (event) => {
                  if (event.key !== 'Escape') return;
                  // 有内容先清空，空了再关闭 —— 和宿主 onKeyDown 的处理一致
                  if (query !== '') setQuery('');
                  else setOpen(false);
                },
              }),
              /* 原生 clearButton 是常驻的：空输入时它负责收起搜索，
                 有输入时负责清空。所以这里不能按 query 隐藏，否则空态右侧会空一块。 */
              h('button', {
                type: 'button',
                className: 'wf-clearbtn',
                'aria-label': tSafe('finder.close'),
                onClick: () => {
                  if (query !== '') {
                    setQuery('');
                    inputRef.current?.focus();
                  } else {
                    setOpen(false);
                  }
                },
              }, h('svg', {
                viewBox: '0 0 24 24', width: 12, height: 12,
                fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
                strokeLinecap: 'round', 'aria-hidden': true,
              }, h('path', { d: 'M5 5l14 14M19 5L5 19' }))),
            ),
          ),
          // 空查询时不渲染页签和结果区：原生放大镜刚展开就是一个纯输入框，
          // 下面的会话列表照常显示，只有打字后才切换成搜索结果。
          hasQuery
            ? h(
              'div',
              { className: 'wf-tabs', role: 'tablist' },
              h(
                'button',
                {
                  type: 'button',
                  role: 'tab',
                  className: `wf-tab${mode === 'files' ? ' is-active' : ''}`,
                  'aria-selected': mode === 'files',
                  onClick: () => setMode('files'),
                },
                tSafe('finder.fileGroup'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  role: 'tab',
                  className: `wf-tab${mode === 'messages' ? ' is-active' : ''}`,
                  'aria-selected': mode === 'messages',
                  onClick: () => setMode('messages'),
                },
                tSafe('finder.msgGroup'),
              ),
            )
            : null,
          hasQuery ? h('div', { className: 'wf-body' }, body) : null,
        );
      };
    }
    // #endregion

    // #region 工作区搜索
    /**
     * 搜索能力的边界（都是宿主既有只读接口，不需要新权限）：
     *   ctx.sessions.list.getSnapshot().current           → 当前 sessionId
     *   ctx.sessions.list.getSnapshot().byId[sid].cwd     → 工作区根目录
     *   ctx.remote.workspaceFiles.list(sid, path)         → { path, entries:[{name,type,size}], truncated }
     *   ctx.remote.workspaceFiles.read(sid, path, range)  → { offset, text, lines, eof }
     *
     * list 只给一层的直接子项，所以遍历是自己做的：队列 + 并发上限 + 深度上限。
     */

    /** 这些目录名默认不进去（Config.excludeDirs 可覆盖）。 */
    const DEFAULT_EXCLUDE = ['.git', 'node_modules', 'dist', 'build', '.venv', '__pycache__'];

    /** 明显是二进制的扩展名，不读内容，只按文件名参与匹配。 */
    const BINARY_EXT = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tif', 'tiff',
      'pdf', 'zip', 'gz', 'tar', '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'bin',
      'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'mov', 'avi', 'mkv', 'wav',
      'docx', 'xlsx', 'pptx', 'asar', 'node', 'pyc', 'class', 'jar', 'wasm',
    ]);

    function extOf(name) {
      const i = String(name).lastIndexOf('.');
      return i > 0 ? String(name).slice(i + 1).toLowerCase() : '';
    }

    function isBinaryName(name) {
      return BINARY_EXT.has(extOf(name));
    }

    /**
     * 通过 ctx.inject 捕获到的真实服务实例。
     *
     * cordis 的 inject 会给出一个作用域化的 ctx，只有在那上面读 inner[name]
     * 才拿得到服务实例；父级 ctx 上的同名属性需要插件显式声明 inject，
     * 否则代理会抛 `cannot get property "xxx" without inject`。
     * 这里在 apply 阶段用 ctx.inject 把需要的服务抓一次存下来，
     * serviceOf 优先用它，读不到才退回 ctx.get。
     */
    const liveServices = {};

    /** 取一个 cordis 服务。读不到就返回 undefined，绝不让插件整体加载失败。 */
    function serviceOf(ctx, name) {
      if (!ctx) return undefined;
      // 整个函数体兜一层 try/catch：cordis 的 context 是 Proxy，
      // 读未 inject 的属性（尤其 "remote.workspaceFiles" 这种点号名）会抛
      // `cannot get property "xxx" without inject`，不能让它漏到调用方。
      try {
        // 优先级 1：ctx.inject 作用域里抓到的真实实例（最可靠）
        if (Object.prototype.hasOwnProperty.call(liveServices, name)) {
          const captured = liveServices[name];
          if (captured !== undefined && captured !== null) return captured;
        }
        if (typeof ctx.get === 'function') {
          // 先按默认 strict 取（只认已激活的服务），再退一步取未激活的实现，
          // 避免插件加载时序早于服务就绪时读不到。
          for (const strict of [true, false]) {
            try {
              const value = ctx.get(name, strict);
              if (value !== undefined && value !== null) return value;
            } catch {
              /* 该服务未提供，继续下一次尝试 */
            }
          }
        }
        // 只对不含点号的短名尝试直接读取；点号名一律走 inject 捕获或 ctx.get
        if (name.indexOf('.') < 0) {
          try {
            const direct = ctx[name];
            if (direct !== undefined && direct !== null) return direct;
          } catch {
            /* cordis 因未 inject 而抛错，视为不可用 */
          }
        }
      } catch {
        /* Proxy 抛错也视为不可用 */
      }
      return undefined;
    }

    /** Remote 载体：优先 ctx.get('remote')，退路是注入名 remote.workspaceFiles。 */
    function remoteOf(ctx) {
      try {
        const remote = serviceOf(ctx, 'remote');
        if (remote) return remote;
        const standalone = serviceOf(ctx, 'remote.workspaceFiles');
        if (standalone) return { workspaceFiles: standalone };
      } catch {
        /* 读不到就当没有 */
      }
      return undefined;
    }

    /**
     * 列出当前运行时可用的服务名。
     * cordis 的 ReflectService 用 props[name] = { type: "service" } 记录声明过的属性，
     * 所以 Object.keys(ctx.reflect.props) 就是服务名全集。
     * 这是排查「拿不到某个服务」最直接的证据来源。
     */
    function listServices(ctx) {
      const names = new Set();
      const collect = (source) => {
        try {
          if (!source || typeof source !== 'object') return;
          Object.keys(source).forEach((name) => names.add(name));
        } catch {
          /* 读不到就跳过 */
        }
      };
      try {
        collect(ctx && ctx.reflect && ctx.reflect.props);
      } catch {
        /* 忽略 */
      }
      try {
        collect(ctx && ctx.fiber && ctx.fiber.store);
      } catch {
        /* 忽略 */
      }
      return [...names].sort();
    }

    /** 从 ctx 里取搜索所需的三个能力；缺哪个都记进 missing 里，界面直接显示。 */
    function readSearchApis(ctx) {
      const missing = [];
      try {
        const sessions = serviceOf(ctx, 'sessions');
        const listSnap = sessions && sessions.list && sessions.list.getSnapshot();
        if (!sessions) missing.push('sessions');
        else if (!sessions.list) missing.push('sessions.list');
        else if (!listSnap) missing.push('sessions.list.getSnapshot()');

        // remote.workspaceFiles 在本宿主里是**独立服务名**（不是 remote 的属性）。
        // 注意：不要写 remote.workspaceFiles —— remote 也是 cordis 代理对象，
        // 访问它上面的点号属性同样会抛 `cannot get property ... without inject`。
        const workspaceFiles = serviceOf(ctx, 'remote.workspaceFiles');
        if (!workspaceFiles) missing.push('remote.workspaceFiles');

        if (!listSnap || !workspaceFiles) {
          return { error: 'no-api', missing, services: listServices(ctx) };
        }
        return { sessions, listSnap, workspaceFiles };
      } catch (error) {
        return { error: 'no-api', missing: [`抛错: ${error && error.message ? error.message : String(error)}`], services: listServices(ctx) };
      }
    }

    /** 当前会话 id 与工作区根；拿不到就没有可搜的范围。 */
    /**
     * 当前会话 id 与工作区根。
     *
     * 注意：sessions.list 的快照形状是 { ids, byId, phase, projectionsBySession }，
     * **没有 current 字段**（见 @deepseek-ai/dsh-api-session-controller 的
     * ClientSessions 构造函数：createSnapshotStore({ ids: [], byId: {}, phase: 'pending', ... })）。
     * 当前会话在 uiWorkspace.selection，它带 persist: { name: "dsh.sessions.current" }，
     * 快照形状 { sessionId }。所以优先级是：selection → 已 retain 的 mainView → 唯一会话。
     */
    function currentScope(ctx) {
      try {
        const sessions = serviceOf(ctx, 'sessions');
        const listSnap = sessions && sessions.list && sessions.list.getSnapshot();
        const byId = (listSnap && listSnap.byId) || {};
        const ids = (listSnap && listSnap.ids) || Object.keys(byId);

        let sessionId = currentSessionId(ctx);
        if (!sessionId) {
          // 退路：main 视图正在 retain 的那一个
          const retained = Object.values(byId).find((row) => row && (row.retainedBy?.mainView ?? 0) > 0);
          sessionId = retained && retained.sessionId;
        }
        if (!sessionId && ids.length === 1) sessionId = ids[0];
        if (!sessionId) return null;

        const rec = byId[sessionId];
        return {
          sessionId,
          cwd: (rec && rec.cwd) || '',
          title: (rec && (rec.displayTitle || rec.title)) || '',
        };
      } catch {
        return null;
      }
    }

    /** 当前会话 id：uiWorkspace.selection 是权威源，读不到再看持久化的 localStorage。 */
    function currentSessionId(ctx) {
      try {
        const workspace = serviceOf(ctx, 'uiWorkspace');
        const selection = workspace && workspace.selection;
        if (selection && typeof selection.getSnapshot === 'function') {
          const value = selection.getSnapshot();
          if (value && typeof value.sessionId === 'string' && value.sessionId) return value.sessionId;
        }
      } catch {
        /* 继续退路 */
      }
      try {
        const raw = globalThis.localStorage && globalThis.localStorage.getItem('dsh.sessions.current');
        if (raw) {
          const parsed = JSON.parse(raw);
          const nested = parsed && parsed.value && typeof parsed.value === 'object' ? parsed.value : parsed;
          if (nested && typeof nested.sessionId === 'string' && nested.sessionId) return nested.sessionId;
        }
      } catch {
        /* 读不到就放弃 */
      }
      return '';
    }

    /**
     * 递归遍历工作区，把文件清单交给 onFile。
     * 用队列而不是递归，配合并发上限，避免大仓库把主线程打满或触发限流。
     */
    async function walkWorkspace(ctx, options) {
      const apis = readSearchApis(ctx);
      if (!apis || apis.error) {
        return { error: 'no-api', missing: (apis && apis.missing) || [], services: (apis && apis.services) || [] };
      }
      const scope = currentScope(ctx);
      if (!scope) return { error: 'no-session' };

      const excludeDirs = new Set(
        (options && Array.isArray(options.excludeDirs) && options.excludeDirs.length
          ? options.excludeDirs
          : DEFAULT_EXCLUDE).map((s) => String(s)),
      );
      const maxFiles = Math.max(1, Number(options && options.maxResults) || 200);
      const maxDepth = Math.max(1, Number(options && options.maxDepth) || 12);
      const onFile = options && options.onFile;
      const signal = options && options.signal;

      const files = [];
      // list() 的 path 参数要求「绝对路径，或相对工作区根的路径」，
      // 空字符串会被后端判为非法（ok=false: path is required）。
      // 所以根目录传 cwd 绝对路径，取不到就退 './'，子目录则用相对路径。
      const rootPath = (scope && scope.cwd) ? scope.cwd : '.';
      const queue = [{ path: rootPath, depth: 0, root: true }];
      let truncated = false;
      // 遍历统计：零结果时用它区分「没读到目录」和「读到了但没文件」
      const stats = { dirs: 0, entries: 0, errors: [], sampleTypes: [] };

      while (queue.length) {
        if (signal && signal.aborted) return { error: 'aborted' };
        if (files.length >= maxFiles) { truncated = true; break; }
        // 每轮取一小批并发，兼顾速度与限流
        const batch = queue.splice(0, 8);
        const results = await Promise.all(batch.map(async (dir) => {
          try {
            const res = await apis.workspaceFiles.list(scope.sessionId, dir.path);
            return { dir, res };
          } catch (error) {
            return { dir, res: null, error };
          }
        }));
        for (const { dir, res, error } of results) {
          stats.dirs += 1;
          if (error) {
            if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: ${error && error.message ? error.message : String(error)}`);
            continue;
          }
          // 返回值可能是 { ok, value } 包装，也可能是裸值，两种都认。
          if (!res) { if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: 返回空`); continue; }
          if (res.ok === false) {
            if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: ok=false ${(res.error && res.error.message) || ''}`);
            continue;
          }
          const value = res.value || res;
          if (!value || typeof value !== 'object') { if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: 值不是对象`); continue; }
          const entries = Array.isArray(value.entries) ? value.entries : [];
          stats.entries += entries.length;
          // 用后端回的 path 当基准：它是「相对工作区根的路径，根为空」，
          // 拿它拼出来的子路径正好是后续 read()/list() 都能接受的相对路径。
          const base = typeof value.path === 'string' ? value.path : (dir.root ? '' : dir.path);
          for (const raw of entries) {
            // 条目可能是对象，也可能是纯字符串（不同后端实现不同），都兼容
            const entry = typeof raw === 'string' ? { name: raw } : raw;
            if (!entry || typeof entry.name !== 'string') continue;
            const type = String(entry.type || '').toLowerCase();
            if (stats.sampleTypes.length < 8 && stats.sampleTypes.indexOf(type) < 0) stats.sampleTypes.push(type || '(空)');
            const childPath = base ? `${base}/${entry.name}` : entry.name;
            // directory / dir / folder 都当目录；file / 空类型（无 size 视为文件）都当文件
            const isDir = type === 'directory' || type === 'dir' || type === 'folder';
            if (isDir) {
              if (excludeDirs.has(entry.name)) continue;
              if (dir.depth + 1 > maxDepth) continue;
              queue.push({ path: childPath, depth: dir.depth + 1 });
            } else {
              if (files.length >= maxFiles) { truncated = true; break; }
              const item = { path: childPath, name: entry.name, size: entry.size };
              files.push(item);
              if (typeof onFile === 'function') onFile(item);
            }
          }
        }
      }
      return { error: null, files, truncated, scope, stats };
    }

    /** 读一个文件的全部文本（按宿主默认每页行数翻页），用于全文匹配。 */
    async function readWholeText(ctx, sessionId, path, maxLines) {
      const apis = readSearchApis(ctx);
      if (!apis || apis.error) return null;
      const cap = Math.max(1, Number(maxLines) || 4000);
      let offset = 1;
      const chunks = [];
      let total = 0;
      while (total < cap) {
        let res;
        try {
          res = await apis.workspaceFiles.read(sessionId, path, { offset, limit: Math.min(500, cap - total) });
        } catch {
          return null;
        }
        // 返回值可能是 { ok, value } 包装，也可能是裸值，两种都认。
        if (!res) return chunks.length ? chunks.join('\n') : null;
        if (res.ok === false) return chunks.length ? chunks.join('\n') : null;
        const value = res.value || res;
        if (!value || typeof value.text !== 'string') return chunks.length ? chunks.join('\n') : null;
        if (value.lines === 0) break;
        chunks.push(value.text);
        total += value.lines;
        if (value.eof) break;
        offset += value.lines;
      }
      return chunks.join('\n');
    }

    /** 把一行里的关键词包成高亮片段，交给 React 渲染（不拼 HTML）。 */
    function highlightSegments(text, query) {
      const line = String(text == null ? '' : text);
      const needle = String(query || '');
      if (!needle) return [{ text: line, hit: false }];
      const lowerLine = line.toLowerCase();
      const lowerNeedle = needle.toLowerCase();
      const parts = [];
      let from = 0;
      for (;;) {
        const at = lowerLine.indexOf(lowerNeedle, from);
        if (at < 0) break;
        if (at > from) parts.push({ text: line.slice(from, at), hit: false });
        parts.push({ text: line.slice(at, at + needle.length), hit: true });
        from = at + needle.length;
      }
      if (!parts.length) return [{ text: line, hit: false }];
      if (from < line.length) parts.push({ text: line.slice(from), hit: false });
      return parts;
    }

    /**
     * 执行一次搜索。
     * 先按文件名匹配（便宜、全覆盖），再对「没被文件名命中的文本文件」读内容匹配。
     * 内容匹配有预算上限，避免大仓库卡死。
     */
    async function runSearch(ctx, query, options) {
      const q = String(query || '').trim();
      if (!q) return { error: null, results: [], scanned: 0, truncated: false, scope: null };
      const signal = options && options.signal;
      const opts = options || {};
      const contentBudget = Math.max(0, Number(opts.contentFileBudget) || 120);
      const results = [];
      const walked = await walkWorkspace(ctx, { ...opts, signal });
      if (walked.error) {
        return {
          error: walked.error, results: [], scanned: 0, truncated: false, scope: null,
          missing: walked.missing || [], services: walked.services || [],
        };
      }

      const lowerQ = q.toLowerCase();
      const leftovers = [];
      for (const file of walked.files) {
        if (signal && signal.aborted) return { error: 'aborted', results, scanned: 0, truncated: false, scope: walked.scope };
        if (file.name.toLowerCase().includes(lowerQ)) {
          results.push({ kind: 'name', path: file.path, name: file.name, size: file.size, matches: [] });
        } else if (!isBinaryName(file.name)) {
          leftovers.push(file);
        }
      }

      // 内容匹配：按预算逐个读，命中就带出行号和整行文本
      const budget = Math.min(contentBudget, leftovers.length);
      for (let i = 0; i < budget; i += 1) {
        if (signal && signal.aborted) return { error: 'aborted', results, scanned: i, truncated: walked.truncated, scope: walked.scope };
        const file = leftovers[i];
        const text = await readWholeText(ctx, walked.scope.sessionId, file.path, opts.maxContentLines);
        if (!text) continue;
        const matches = [];
        const lines = text.split('\n');
        for (let n = 0; n < lines.length && matches.length < 5; n += 1) {
          const lowerLine = lines[n].toLowerCase();
          const col = lowerLine.indexOf(lowerQ);
          if (col >= 0) {
            // 和消息检索同一个问题：整行从 0 截 400 字，
            // 命中落在 400 字之后就完全看不到高亮。
            // 改成以命中点为中心取一段窗口。
            const START = Math.max(0, col - 24);
            matches.push({
              lineNumber: n + 1,
              line: lines[n].slice(START, START + 400),
              lead: START > 0,
            });
          }
        }
        if (matches.length) {
          results.push({ kind: 'content', path: file.path, name: file.name, size: file.size, matches });
        }
      }

      return {
        error: null,
        results,
        scanned: walked.files.length,
        truncated: walked.truncated,
        scope: walked.scope,
        // 零结果时把遍历实况带回去，界面上能直接看出卡在哪一步
        stats: walked.stats,
      };
    }
    // #endregion

    // #region 消息检索
    /**
     * 消息正文都在 Session 的事件流里，不需要新接口：
     *   user/message       → event.data 本身就是一个消息（{role, content}）
     *   assistant/message  → event.data.message
     * 两者的 content 都是块数组，正文在 type==='text' 的块上。
     *
     * 一个会话打开时只加载尾部一页（约 500 条消息），更早的要 loadOlder() 往前翻，
     * 这里按预算翻有限页，避免一次搜索把长会话全量读进内存。
     */
    const MESSAGE_TYPES = new Set(['user/message', 'assistant/message']);

    /** 从一条消息事件里抽出纯文本；没有正文就返回空串。 */
    function messageTextOf(event) {
      try {
        const data = event && event.data;
        if (!data) return '';
        const message = event.type === 'user/message' ? data : data.message;
        const content = message && message.content;
        if (!Array.isArray(content)) return '';
        const parts = [];
        for (const block of content) {
          if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
        }
        return parts.join('');
      } catch {
        return '';
      }
    }

    /** 消息的轮次号；没有就返回 null。 */
    function messageTurnOf(event) {
      const turn = event && event.data && event.data.turn;
      return typeof turn === 'number' ? turn : null;
    }

    /** 从事件窗口里挑出所有消息条目。 */
    function messagesOf(entries) {
      const out = [];
      if (!Array.isArray(entries)) return out;
      for (const entry of entries) {
        const event = entry && entry.event ? entry.event : entry;
        if (!event || !MESSAGE_TYPES.has(event.type)) continue;
        const text = messageTextOf(event);
        if (!text) continue;
        out.push({ seq: event.seq, time: event.time, type: event.type, turn: messageTurnOf(event), text });
      }
      return out;
    }

    /** 在给定消息里找出命中，最多 maxHits 条。 */
    function matchMessages(messages, lowerQuery, maxHits) {
      const hits = [];
      for (const msg of messages) {
        if (hits.length >= maxHits) break;
        const lowerText = msg.text.toLowerCase();
        const at = lowerText.indexOf(lowerQuery);
        if (at < 0) continue;
        // 之前从命中点往前留 60 字，但结果行是单行 nowrap + 省略号，
        // 侧边栏一行只放得下三十几个字 —— 高亮词永远落在可视区外，
        // 用户看到的就是「整片没有一处亮」。
        // 改成只往前留 8 个字，让命中词稳定出现在第 9 个字附近。
        const PAD = 8;
        const start = Math.max(0, at - PAD);
        const snippet = msg.text.slice(start, start + 240).replace(/\s+/g, ' ').trim();
        hits.push({
          seq: msg.seq,
          turn: msg.turn,
          time: msg.time,
          role: msg.type,
          snippet,
          // 补一个「命中前还有多少字」的标记，渲染时据此加前置省略号
          lead: start > 0,
          text: msg.text,
        });
      }
      return hits;
    }

    /** 拿到某个会话的 live binding（含 eventSource）；没有 retain 就临时 retain。 */
    async function withSessionEvents(ctx, sessionId, signal, run) {
      const sessions = serviceOf(ctx, 'sessions');
      if (!sessions) return null;
      let reference = null;
      let binding = null;
      try {
        binding = sessions.binding(sessionId);
      } catch {
        binding = null;
      }
      if (!binding) {
        try {
          reference = sessions.retain(sessionId, { source: 'sidebar-finder', signal });
          await reference.ready;
          binding = reference.binding;
        } catch {
          try { reference?.release?.(); } catch { /* ignore */ }
          return null;
        }
      }
      try {
        return await run(binding);
      } finally {
        try { reference?.release?.(); } catch { /* ignore */ }
      }
    }

    /**
     * 在单个会话里搜消息。先扫已加载窗口，不够再往前翻页（受 pages 预算限制）。
     */
    async function searchSessionMessages(ctx, sessionId, lowerQuery, options) {
      const signal = options && options.signal;
      const maxHits = Math.max(1, Number(options && options.maxHits) || 20);
      const maxPages = Math.max(0, Number(options && options.maxPages) || 8);
      return withSessionEvents(ctx, sessionId, signal, async (binding) => {
        const session = binding.session;
        const source = binding.eventSource || (session && session.eventSource);
        if (!source || typeof source.getSnapshot !== 'function') return { hits: [], scanned: 0, truncated: false };

        let hits = [];
        let scanned = 0;
        let first = true;
        for (let page = 0; page <= maxPages; page += 1) {
          if (signal && signal.aborted) break;
          const snap = source.getSnapshot();
          const messages = messagesOf(snap && snap.entries);
          scanned = messages.length;
          hits = matchMessages(messages, lowerQuery, maxHits);
          if (hits.length) return { hits, scanned, truncated: false };
          if (!snap || !snap.hasMore) return { hits, scanned, truncated: false };
          if (page === maxPages) break;
          if (first && session && typeof session.open === 'function') {
            try { await session.open(); } catch { /* 已打开 */ }
            first = false;
            continue;
          }
          const before = session && typeof session.loadOlder === 'function' ? session.loadOlder() : null;
          if (!before) break;
          try { await before; } catch { break; }
          first = false;
        }
        return { hits, scanned, truncated: true };
      });
    }

    /**
     * 消息检索总入口：当前会话 + 其他会话。
     * 其他会话先用宿主的会话级搜索缩小候选，再逐个进去搜消息正文。
     */
    async function runMessageSearch(ctx, query, options) {
      const signal = options && options.signal;
      const lowerQuery = String(query).toLowerCase();
      const scope = currentScope(ctx);
      if (!scope) {
        const sessions = serviceOf(ctx, 'sessions');
        const snap = sessions && sessions.list && sessions.list.getSnapshot();
        return {
          error: 'no-session', results: [], scanned: 0, truncated: false,
          missing: [
            sessions ? 'sessions.list 里没有可用会话' : 'sessions',
            `ids=${snap && snap.ids ? snap.ids.length : 'n/a'}`,
            `phase=${(snap && snap.phase) || 'n/a'}`,
            `selection=${currentSessionId(ctx) || '(空)'}`,
          ],
          services: listServices(ctx),
        };
      }
      const maxHits = Math.max(1, Number(options && options.maxHits) || 20);
      const otherLimit = Math.max(0, Number(options && options.maxSessionCandidates) || 6);
      const results = [];
      let truncated = false;

      // 1) 当前会话
      if (!(signal && signal.aborted)) {
        const here = await searchSessionMessages(ctx, scope.sessionId, lowerQuery, {
          signal, maxHits, maxPages: options && options.maxPages,
        });
        if (here && here.hits && here.hits.length) {
          for (const hit of here.hits) {
            results.push({
              kind: 'message',
              scope: 'current',
              sessionId: scope.sessionId,
              sessionTitle: scope.title,
              seq: hit.seq,
              turn: hit.turn,
              time: hit.time,
              role: hit.role,
              snippet: hit.snippet,
              text: hit.text,
            });
          }
        }
        if (here && here.truncated) truncated = true;
      }

      // 2) 其他会话：先拿候选
      let candidates = [];
      try {
        const sessions = serviceOf(ctx, 'sessions');
        if (sessions && typeof sessions.search === 'function') {
          const res = await sessions.search(query, signal);
          if (res && res.ok && res.value && Array.isArray(res.value.items)) {
            candidates = res.value.items
              .filter((item) => item && item.sessionId && item.sessionId !== scope.sessionId)
              .slice(0, otherLimit);
            if (res.value.hasMore) truncated = true;
          }
        }
      } catch {
        candidates = [];
      }

      // 3) 逐个钻进去搜正文
      for (const candidate of candidates) {
        if (signal && signal.aborted) break;
        if (results.length >= maxHits) { truncated = true; break; }
        const remaining = maxHits - results.length;
        const found = await searchSessionMessages(ctx, candidate.sessionId, lowerQuery, {
          signal, maxHits: remaining, maxPages: options && options.maxPages,
        });
        if (!found || !found.hits || !found.hits.length) continue;
        const rec = serviceOf(ctx, 'sessions')?.list?.getSnapshot()?.byId?.[candidate.sessionId];
        const title = (rec && (rec.displayTitle || rec.title)) || candidate.snippet || candidate.sessionId;
        for (const hit of found.hits) {
          results.push({
            kind: 'message',
            scope: 'other',
            sessionId: candidate.sessionId,
            sessionTitle: title,
            seq: hit.seq,
            turn: hit.turn,
            time: hit.time,
            role: hit.role,
            snippet: hit.snippet,
            text: hit.text,
          });
        }
        if (found.truncated) truncated = true;
      }

      return { error: null, results, scanned: results.length, truncated, scope };
    }

    /**
     * 打开某条消息：先切到那个会话，再按轮次滚动定位。
     * 聊天行带 data-chat-turn 属性，轮次号能直接对上；找不到就只切会话。
     */
    async function openMessage(ctx, result) {
      try {
        const workspace = serviceOf(ctx, 'uiWorkspace');
        if (workspace && typeof workspace.openSession === 'function') {
          await workspace.openSession(result.sessionId);
        } else {
          const sessions = serviceOf(ctx, 'sessions');
          if (!sessions || typeof sessions.retain !== 'function') return false;
          sessions.retain(result.sessionId, { source: 'sidebar-finder' });
        }
      } catch {
        return false;
      }
      if (typeof result.turn !== 'number') return true;
      // 等界面把消息渲染出来，再按轮次滚过去
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 120 : 90));
        const row = document.querySelector(`[data-chat-turn="${result.turn}"]`);
        if (row && typeof row.scrollIntoView === 'function') {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          row.setAttribute('data-wf-flash', 'true');
          window.setTimeout(() => row.removeAttribute('data-wf-flash'), 1600);
          return true;
        }
      }
      return false;
    }
    // #endregion

    // #region 词典读取（未注入 locale 时回退中文）
    let translate = null;
    function tSafe(key) {
      const dict = (translate && translate(key)) || '';
      if (dict) return dict;
      const [group, name] = key.split('.');
      return (zh[group] && zh[group][name]) || key;
    }
    // #endregion

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
  /* flex 容器里想让它能收缩，必须显式 min-height:0，
     否则 min-height:auto 会撑到内容高度、max-height 失效。 */
  flex: 0 1 auto;
  min-height: 0;
  max-height: min(220px, 36vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  /* 负外边距 + 等量内边距：滚动条贴到菜单边缘，
     行本身仍然保持原来的 8px 内缩，视觉上和上面的原生项对齐。 */
  margin: 0 -4px;
  padding: 0 4px;
  /* 负外边距让它比内容区宽 8px，若不裁剪会冒出横向滚动条 */
  overflow-x: hidden;
}
.wf-menu-list::-webkit-scrollbar { width: 6px; }
.wf-menu-list::-webkit-scrollbar-track { background: transparent; }
.wf-menu-list::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l2);
  border-radius: 3px;
}
.wf-menu-list::-webkit-scrollbar-thumb:hover {
  background: var(--dsw-alias-scrollbar-hover-l2);
}
.wf-menu-sep {
  height: 0.5px;
  margin: 3px 2px;
  background: var(--dsw-alias-border-l2, var(--dsw-alias-border-l3));
}
/* #region 发图区下拉板块 */
.wf-dock {
  display: flex;
  flex-direction: column;
  margin: 0 2px 2px;
  min-width: 0;
}
.wf-dock-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  max-width: 100%;
  padding: 3px 6px;
  border: none;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
  transition: background-color 120ms ease, color 120ms ease;
}
.wf-dock-toggle:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
}
.wf-dock-toggle:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.wf-dock-toggle:disabled { opacity: .6; cursor: default; }
.wf-dock-caret {
  flex: none;
  width: 10px;
  text-align: center;
  font-size: 9px;
  opacity: .8;
}
.wf-dock-note {
  flex: none;
  margin-left: 2px;
  color: var(--dsw-alias-label-dimmed);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wf-dock-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  max-height: min(200px, 32vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  margin-top: 2px;
  padding: 2px 0 0;
}
.wf-dock-panel::-webkit-scrollbar { width: 6px; }
.wf-dock-panel::-webkit-scrollbar-thumb {
  border-radius: 3px;
  background: var(--dsw-alias-scrollbar-bg-l2);
}
.wf-dock-panel::-webkit-scrollbar-thumb:hover {
  background: var(--dsw-alias-scrollbar-hover-l2);
}
.wf-dock-group {
  padding: 2px 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 16px;
}
.wf-dock-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
  min-width: 0;
  padding: 4px 6px;
  border: none;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}
.wf-dock-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.wf-dock-row:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
.wf-dock-name,
.wf-dock-path {
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.wf-dock-path {
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 14px;
}
.wf-dock-hint {
  padding: 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}
.wf-dock-action {
  align-self: flex-start;
  margin: 2px 6px 4px;
  padding: 3px 6px;
  border: none;
  border-radius: var(--dsw-radius-sm, 6px);
  background: transparent;
  color: var(--dsw-alias-link);
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
}
.wf-dock-action:hover { background: var(--dsw-alias-interactive-bg-hover); }
.wf-dock-action:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: -2px;
}
@media (max-height: 520px) {
  .wf-dock-panel { max-height: 140px; }
}
/* #endregion */
`;

    function applyCss() {
      const style = document.createElement('style');
      style.setAttribute('data-wf-style', '');
      style.textContent = CSS;
      document.head.appendChild(style);
      return () => {
        if (style.parentNode) style.parentNode.removeChild(style);
      };
    }

    // #region 运行时 CSS 变量（不写宿主 DOM）
    /**
     * 运行时算出来的尺寸变量，统一放进**我们自己的**一张 <style> 里。
     *
     * 之前是 `documentElement.style.setProperty('--wf-...', ...)` 直接写
     * 宿主根元素的内联样式。问题是 documentElement 归宿主所有：主题切换、
     * 缩放重算、窗口最大化这些操作宿主都会重设它的 style，我们的变量
     * 会跟着一起被清掉，而且没有任何通知 —— 表现就是"用着用着工作区
     * 高度限制没了"。改成自己维护一张样式表后，变量和规则同源、同生命周期，
     * 宿主动不到。
     *
     * practices.md 明确禁止写 slot 外的 DOM；往 document.head 里放一张
     * 带自己标记的 <style> 是官方认可的写样式方式（dsh-ui-harmonizer、
     * 宿主自己的 WorkspaceBrowser.module.css 都这么做），和改宿主节点的
     * 内联 style 是两回事。
     */
    const runtimeVars = new Map();
    let varsStyle = null;
    let varsDisposed = false;
    function flushVars() {
      try {
        // teardown 之后不再重建样式表：卸载顺序不保证，如果 applyVars 的
        // 清理在 teardown 之后才跑，setVar(..., null) 会把一个空的
        // <style> 又造出来，等于留个孤儿标签在 head 里。
        if (varsDisposed) return;
        if (!varsStyle) {
          if (typeof document === 'undefined' || !document.head) return;
          if (runtimeVars.size === 0) return;
          varsStyle = document.createElement('style');
          varsStyle.setAttribute('data-wf-vars', '');
          document.head.appendChild(varsStyle);
        }
        if (runtimeVars.size === 0) {
          varsStyle.textContent = '';
          return;
        }
        const body = Array.from(runtimeVars.entries())
          .map(([name, value]) => `  ${name}: ${value};`)
          .join('\n');
        varsStyle.textContent = `:root {\n${body}\n}\n`;
      } catch { /* 忽略 */ }
    }
    function setVar(name, value) {
      if (varsDisposed) return;
      if (value == null) runtimeVars.delete(name);
      else runtimeVars.set(name, value);
      flushVars();
    }
    function teardownVars() {
      varsDisposed = true;
      runtimeVars.clear();
      try {
        if (varsStyle && varsStyle.parentNode) varsStyle.parentNode.removeChild(varsStyle);
      } catch { /* 忽略 */ }
      varsStyle = null;
    }
    // #endregion

    /**
     * 把 Config 里的尺寸变成 CSS 变量，让样式表里的
     * var(--wf-region-min) / var(--wf-panel-max) 真正跟着配置走。
     */
    function applyVars(config) {
      if (typeof document === 'undefined') return undefined;
      const min = Number(config && config.workspaceMinHeight);
      const maxVh = Number(config && config.panelListMaxHeightVh);
      if (Number.isFinite(min) && min > 0) setVar('--wf-region-min', `${min}px`);
      if (Number.isFinite(maxVh) && maxVh > 0) setVar('--wf-panel-max', `${maxVh}vh`);
      return () => {
        setVar('--wf-region-min', null);
        setVar('--wf-panel-max', null);
      };
    }
    /**
     * 把「更多」锚点按钮的实测宽度写进 --wf-more-w。
     * 菜单是 portal 到 body 的，既拿不到侧边栏的继承值，也不在侧边栏子树里，
     * 所以宽度只能由 JS 量出来写变量。
     *
     * 为什么必须量按钮而不是算「侧边栏宽 - 28」：
     * 宿主的定位是 x = anchorRect.right - 菜单宽度，
     * 只有菜单宽度严格等于锚点宽度，左边缘才和按钮对齐。
     * 而锚点宽度还受滚动条、内边距、外边距共同影响，算不如量。
     */
    function measureMoreAnchor() {
      if (typeof document === 'undefined') return undefined;
      let observer = null;
      let timer = 0;
      let watched = null;
      const write = () => {
        try {
          const sidebar = document.querySelector(SEL_SIDEBAR);
          if (!sidebar) return false;
          // [aria-haspopup="menu"] 只有「更多」这一个按钮会有
          const anchor = sidebar.querySelector('[aria-haspopup="menu"]');
          if (!anchor) return false;
          const r = anchor.getBoundingClientRect();
          if (!(r.width > 0)) return false;
          setVar('--wf-more-w', Math.round(r.width) + 'px');
          if (typeof ResizeObserver === 'function' && watched !== anchor) {
            try {
              if (watched && observer) observer.unobserve(watched);
              observer.observe(anchor);
              watched = anchor;
            } catch { /* 忽略 */ }
          }
          return true;
        } catch {
          return false;
        }
      };
      if (typeof ResizeObserver === 'function') {
        try { observer = new ResizeObserver(() => write()); } catch { observer = null; }
      }
      const ok = write();
      // 侧边栏可能比插件晚挂载；按钮在开合菜单时也会重建，所以要持续兜几拍
      const hasInterval = typeof window.setInterval === 'function';
      let tries = 0;
      if (hasInterval) {
        timer = window.setInterval(() => {
          tries += 1;
          write();
          if ((ok && tries > 6) || tries > 120) {
            window.clearInterval(timer);
            timer = 0;
          }
        }, 250);
      }
      const hasEvent = typeof window.addEventListener === 'function';
      if (hasEvent) window.addEventListener('resize', write);
      return () => {
        try { if (timer) window.clearInterval(timer); } catch { /* 忽略 */ }
        if (observer) { try { observer.disconnect(); } catch { /* 忽略 */ } }
        try { if (hasEvent) window.removeEventListener('resize', write); } catch { /* 忽略 */ }
        setVar('--wf-more-w', null);
      };
    }
    // #endregion

    // #region 发图区下拉板块
    /*
     * 挂在 `conversation.composer.dock`（kind: list / scope: session）。
     * 这个槽的 inject 会给到 `keyboard`，也就是宿主的 SessionInputShell
     * 实例，它的 actions 面是公开的草稿写入入口：
     *   captureInsertion() → { draftRev, start, end }  当前光标与草稿版本
     *   insertText(text, span)                          在 span 处插入（一次 paste 编辑）
     *   setDraft(text)                                  整框覆盖
     *
     * 为什么要用 insertText 而不是 setDraft：
     * setDraft 会带上 history-merge 标签并进上一条撤销记录，
     * 用户按一次 Ctrl+Z 会把插入前的草稿一起吞掉；
     * insertText 是独立的 paste 记录，撤销只回退这一次插入。
     *
     * 为什么不能「点最近文件 → 变成附件」：
     * 宿主 addFiles(files) 收的是真实 File 对象，内部用 bridge.pathFor(file)
     * 取本地路径再转成 @引用。浏览器端插件造不出带本地路径的 File，
     * 所以这里走「插入 @路径 引用」这条路 —— 语义上等价，宿主本身也是
     * 把文件引用渲染成 chip 的。
     */
    const MENTION_SAFE = /[\u0000-\u001f\u007f-\u009f"]/u;

    /**
     * 复刻宿主的 formatFileMention：无空格/引号时是 `@path`，
     * 有空格或需要保留时是 `@"path"`，目录结尾补斜杠。
     * 路径含控制字符或引号时返回 undefined（宿主也拒绝）。
     */
    function formatMention(path, kind) {
      if (typeof path !== 'string' || path === '') return undefined;
      const full = kind === 'directory' ? `${path}/` : path;
      if (MENTION_SAFE.test(full)) return undefined;
      if (!/\s/u.test(full)) return `@${full}`;
      if (kind === 'directory') return `@"${full}`;
      return `@"${full}"`;
    }

    /** 把路径写进草稿。优先 insertText（独立撤销步），失败退 setDraft。 */
    function insertReference(keyboard, text) {
      if (!keyboard || typeof text !== 'string' || text === '') return 'notReady';
      const actions = keyboard.actions || keyboard;
      try {
        if (typeof actions.captureInsertion === 'function' && typeof actions.insertText === 'function') {
          const span = actions.captureInsertion();
          if (span && actions.insertText(text, span) === true) return 'inserted';
        }
      } catch { /* 落到降级路径 */ }
      try {
        const current = keyboard.draftSnapshot;
        const base = typeof current === 'string' ? current : '';
        if (typeof actions.setDraft === 'function') {
          actions.setDraft(base ? `${base} ${text}` : text);
          return 'inserted';
        }
      } catch { /* 忽略 */ }
      return 'notReady';
    }

    /**
     * 取工作区里最近改动的文件。
     * 没有 mtime 可用（list 只给 name/type/size），所以用「遍历顺序 + 深度」
     * 做近似：先列根目录，再按目录名序深入，浅层的排在前面。
     * 这样至少稳定、可预测，不会每次刷新都换一批。
     */
    async function recentFiles(ctx, options) {
      const opts = options || {};
      const apis = readSearchApis(ctx);
      if (apis.error) return { error: apis.error, files: [] };
      const scope = currentScope(ctx);
      if (!scope) return { error: 'no-session', files: [] };
      const limit = Math.max(1, Number(opts.limit) || 12);
      const walk = await walkWorkspace(ctx, {
        signal: opts.signal,
        excludeDirs: opts.excludeDirs,
        // 多取一些再截断：浅层的排在前面，后面的可能都是深目录
        maxResults: Math.max(limit * 3, 40),
        maxDepth: Math.max(1, Number(opts.maxDepth) || 3),
      });
      if (walk.error) return { error: walk.error, files: [] };
      return { error: null, files: (walk.files || []).slice(0, limit) };
    }

    /** 一行文件条目 */
    function DockRow({ file, onPick }) {
      const label = file.path || file.name;
      return h(
        'button',
        {
          type: 'button',
          className: 'wf-dock-row',
          title: label,
          onClick: () => onPick(file),
        },
        h('span', { className: 'wf-dock-name' }, file.name || label),
        h('span', { className: 'wf-dock-path' }, file.path || ''),
      );
    }

    function makeComposerDock(ctx, config) {
      return function ComposerDock(props) {
        const keyboard = props && props.keyboard;
        const [open, setOpen] = useState(false);
        const [state, setState] = useState({ status: 'idle', files: [], error: null, note: '' });
        const [busy, setBusy] = useState(false);

        // 只在第一次展开时读一次，之后靠手动刷新，避免每次开合都扫盘
        const load = useCallback(async () => {
          setState((prev) => ({ ...prev, status: 'loading', error: null }));
          try {
            const res = await recentFiles(ctx, { limit: 12, maxDepth: 3 });
            if (res.error) setState({ status: 'error', files: [], error: res.error, note: '' });
            else setState({ status: 'done', files: res.files, error: null, note: '' });
          } catch (error) {
            setState({ status: 'error', files: [], error: error && error.message ? error.message : 'failed', note: '' });
          }
        }, []);

        useEffect(() => {
          if (!open) return undefined;
          if (state.status !== 'idle') return undefined;
          load();
          return undefined;
        }, [open, state.status, load]);

        const pick = (file) => {
          const text = formatMention(file.path || file.name, file.kind || 'file');
          if (!text) {
            setState((prev) => ({ ...prev, note: tSafe('dock.notReady') }));
            return;
          }
          setBusy(true);
          const outcome = insertReference(keyboard, text);
          setBusy(false);
          setState((prev) => ({ ...prev, note: outcome === 'inserted' ? tSafe('dock.inserted') : tSafe('dock.notReady') }));
          if (outcome === 'inserted') {
            setOpen(false);
            window.setTimeout(() => setState((prev) => ({ ...prev, note: '' })), 1600);
          }
        };

        const body = !open ? null : h(
          'div',
          { className: 'wf-dock-panel' },
          state.status === 'loading'
            ? h('div', { className: 'wf-dock-hint' }, tSafe('dock.loading'))
            : state.status === 'error'
              ? h('div', { className: 'wf-dock-hint' }, state.error === 'no-session' ? tSafe('dock.noSession') : tSafe('dock.failed'))
              : state.files.length === 0
                ? h('div', { className: 'wf-dock-hint' }, tSafe('dock.empty'))
                : [
                  h('div', { className: 'wf-dock-group' }, tSafe('dock.recent')),
                  ...state.files.map((file) => h(DockRow, { key: file.path || file.name, file, onPick: pick })),
                ],
          h(
            'button',
            {
              type: 'button',
              className: 'wf-dock-action',
              onClick: () => {
                // 打开「查找」浮层并切到文件页签，让它去挑
                setOpen(false);
                openFinderOverlay();
              },
            },
            tSafe('dock.open'),
          ),
        );

        return h(
          'div',
          { className: `wf-dock${open ? ' is-open' : ''}` },
          h(
            'button',
            {
              type: 'button',
              className: 'wf-dock-toggle',
              'aria-expanded': open ? 'true' : 'false',
              disabled: busy,
              onClick: () => setOpen((v) => !v),
            },
            h('span', { className: 'wf-dock-caret', 'aria-hidden': 'true' }, open ? '▾' : '▸'),
            h('span', null, tSafe('dock.toggle')),
            state.note ? h('span', { className: 'wf-dock-note' }, state.note) : null,
          ),
          body,
        );
      };
    }
    // #endregion

    // #region 兜底页（防 selectPanel 抛错）
    // 面板行已从 sidebar.panellist 移除，这里只作为极端情况的安全网：
    // 若别处仍以 PANEL_ID 调 selectPanel，main 槽能有内容可渲染。
    function FallbackPanel() {
      return h(
        'div',
        { style: { padding: 24, color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } },
        h('div', { style: { fontWeight: 600, marginBottom: 6, color: 'var(--dsw-alias-label-primary)' } }, tSafe('fallback.title')),
        h('div', null, tSafe('fallback.body')),
      );
    }
    // #endregion

    // #region 面板收纳
    /*
     * 宿主把侧边栏面板分成两拨：`unpinned` 里的收进「更多」，其余平铺。
     * 但置顶状态只存在于内存，且写入口 `setPinned` 只传给
     * `sidebar.panellist.actions` 的注册者，而那个槽只在「更多」展开时才挂载。
     * 所以「启动即收纳」在公开 API 上做不到。
     *
     * 这里换一条路：不改宿主的置顶状态，直接用样式把非白名单的面板行隐藏，
     * 再把自己注册进 `sidebar.panellist.actions`，把这些面板补进「更多」菜单。
     * 宿主默认的「更多」只放「浏览更多插件/创建你的插件」，不列面板，
     * 所以补进去的这几行既是收纳结果，也是唯一的入口。
     */

    /** Config 里的白名单，规范化成 Set；`plugins` 与查找行自身永远可见。 */
    function normalizeVisible(config) {
      const raw = config && Array.isArray(config.alwaysVisible) && config.alwaysVisible.length
        ? config.alwaysVisible
        : ['plugins', 'mnemon'];
      const set = new Set(['plugins', PANEL_ID]);
      raw.forEach((id) => {
        if (typeof id === 'string' && id) set.add(id);
      });
      return set;
    }

    /**
     * 真正要隐藏哪些面板。
     * `collapseOthers: false` 时不隐藏任何面板——白名单此时无意义，
     * 但仍要保留查找行之外的面板，所以返回空集合。
     */

    /** 面板标签可能是函数（locale 绑定），统一解成字符串。 */
    function panelLabelOf(options) {
      const label = options && options.label;
      if (typeof label === 'function') {
        try {
          return String(label() || options.id || '');
        } catch {
          return String(options.id || '');
        }
      }
      return String(label || (options && options.id) || '');
    }

    /** 把标签安全地放进属性选择器：转义引号与反斜杠。 */
    function cssString(value) {
      return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }

    /**
     * 生成隐藏非白名单面板行的样式。
     * 用 aria-label 精确定位（宿主给每个面板行的 button 都设了它），
     * 只做样式覆盖，不动宿主 DOM。
     */
    function buildCollapseCss(labels) {
      const list = Array.from(labels || []);
      if (!list.length) return '';
      const selectors = list
        .map((label) => `${SEL_SIDEBAR} nav[class*="_panelList"] > [class*="_panelRow"][aria-label=${cssString(label)}]`)
        .join(',\n');
      return `${selectors} { display: none !important; }`;
    }

    /**
     * 「更多」菜单里补出的面板行。
     * 宿主会把全部面板（含 id/label/active）和 onOpen/onDismiss/onPinnedChange 传进来。
     *
     * 另有一件重要的事：宿主只在这个菜单挂载时才会把 `onPinnedChange` 交出来，
     * 这是整个 DSH 里唯一能改面板「固定/收起」状态的入口（pin 状态纯内存、无持久化）。
     * 所以菜单一打开，就按 Config 把该露的固定、其余收起——宿主随后自己把
     * 收起的行从侧边栏移除，比纯 CSS 隐藏彻底，也不依赖 aria-label 是否对得上。
     */
    function makeMorePanels(getHiddenIds, getVisible, config) {
      return function MorePanels(props) {
        const entries = (props && props.entries) || [];
        const onOpen = props && props.onOpen;
        const onDismiss = props && props.onDismiss;
        const onPinnedChange = props && props.onPinnedChange;
        const hiddenIds = getHiddenIds();

        // 菜单挂载即按 Config 同步一次 pin 状态（每个面板只调一次）
        useEffect(() => {
          if (typeof onPinnedChange !== 'function') return;
          if (config && config.collapseOthers === false) return;
          const visible = getVisible();
          entries.forEach((entry) => {
            if (!entry || typeof entry.id !== 'string') return;
            try {
              onPinnedChange(entry.id, visible.has(entry.id));
            } catch {
              /* 单个面板失败不影响其余 */
            }
          });
          // 只在菜单首次挂载时同步；entries 引用变化不该反复写 pin
          // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        const hidden = entries.filter((entry) => entry && hiddenIds.has(entry.id));
        if (!hidden.length) return null;
        // 这些行是补进「更多」菜单的，行数一多就会把菜单撑到超过宿主的高度上限，
        // 导致最后一行被拦腰截断（看着像菜单漏了半个）。
        // 所以给它们单独一个带高度上限的滚动容器：菜单总高保持住，
        // 多出来的部分只在这一段里滚，宿主菜单本身不再被截断。
        return h(
          React.Fragment,
          null,
          h('div', { className: 'wf-menu-sep', role: 'separator' }),
          h(
            'div',
            { className: 'wf-menu-list' },
            hidden.map((entry) => h(
              'button',
              {
                key: entry.id,
                type: 'button',
                className: 'wf-menu-item',
                'data-current': entry.active ? 'true' : undefined,
                onClick: () => {
                  if (typeof onDismiss === 'function') onDismiss();
                  if (typeof onOpen === 'function') onOpen(entry.id);
                },
              },
              h('span', { className: 'wf-menu-label' }, entry.label || entry.id),
            )),
          ),
        );
      };
    }
    // #endregion

    // #region 插件的 client 半
    return {
      // 只声明 slots（注册面板与浮层的核心能力，宿主一定有）。
      // 其余服务（sessions / remote / 等）一律用 serviceOf(ctx, name) → ctx.get(name) 读取：
      //   - cordis 的 ctx.get 读的是全局服务表，不受 inject 限制；
      //   - 而 Fiber._refresh() 规定 inject 里任一服务缺失就会把插件判为 INACTIVE，
      //     整个插件静默不加载。少声明 + 容错读取，比过度声明安全得多。
      inject: ['slots'],
      apply(ctx, config) {
        // 先把要用的服务抓进 liveServices：ctx.inject 会给出作用域化 ctx，
        // 只有在那上面读才拿得到真实实例。缺哪个都不影响插件加载，只是对应功能不可用。
        ['sessions', 'remote', 'remote.session', 'remote.workspaceFiles', 'uiWorkspace', 'locale'].forEach((name) => {
          try {
            ctx.inject([name], (inner) => {
              try {
                const value = inner && inner[name];
                if (value !== undefined && value !== null) liveServices[name] = value;
              } catch {
                /* 未提供，保持 undefined */
              }
            });
          } catch {
            /* 注入本身失败也继续，serviceOf 会走退路 */
          }
        });

        // 词典：拿不到也不影响功能，tSafe 会回退中文
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, { zh, en });
          } catch {
            return () => {};
          }
        }, 'sidebar-finder: dictionaries');
        try {
          const bound = ctx.locale.bind(NS);
          translate = (key) => {
            try {
              return bound(key);
            } catch {
              return '';
            }
          };
        } catch {
          translate = null;
        }

        // 样式
        ctx.effect(() => applyCss(), 'sidebar-finder: styles');
        // 尺寸配置 → CSS 变量
        ctx.effect(() => applyVars(config), 'sidebar-finder: vars');
        // 「更多」锚点宽度 → CSS 变量（让菜单与那一行按钮对齐）
        ctx.effect(() => measureMoreAnchor(), 'sidebar-finder: more-anchor');

        // ---- 收纳：隐藏非白名单面板行 + 把它们补进「更多」 ----
        const visible = normalizeVisible(config);
        // 收纳结果：id 给「更多」菜单补行用，label 给隐藏样式用，两者同源同时更新
        const hiddenIds = new Set();

        // 收纳样式单独一张表，随面板清单变化重建
        let collapseStyle = null;
        let lastCss = '';
        const syncCollapse = () => {
          let entries = [];
          try {
            entries = ctx.slots.entriesOfSlot('sidebar.panellist') || [];
          } catch {
            entries = [];
          }
          // 先算 id → label，写入共享的 hiddenIds
          hiddenIds.clear();
          const labels = new Set();
          (entries || []).forEach((entry) => {
            const options = entry && entry.options;
            if (!options || typeof options.id !== 'string') return;
            if (options.id === PANEL_ID || visible.has(options.id)) return;
            if (config && config.collapseOthers === false) return;
            hiddenIds.add(options.id);
            const label = panelLabelOf(options);
            if (label) labels.add(label);
          });
          const next = buildCollapseCss(labels);
          if (next === lastCss) return;
          lastCss = next;
          if (!collapseStyle) {
            collapseStyle = document.createElement('style');
            collapseStyle.setAttribute('data-wf-collapse', '');
            document.head.appendChild(collapseStyle);
          }
          collapseStyle.textContent = next;
        };

        ctx.effect(() => {
          syncCollapse();
          let unsubscribe = null;
          try {
            unsubscribe = ctx.slots.subscribe('sidebar.panellist', syncCollapse);
          } catch {
            unsubscribe = null;
          }
          // 面板标签随语言切换而变，隐藏规则是按 aria-label 匹配的，
          // 所以词典变化时也要重建，否则切到英文后收纳会失效
          let unsubscribeLocale = null;
          try {
            unsubscribeLocale = ctx.locale.subscribe(syncCollapse);
          } catch {
            unsubscribeLocale = null;
          }
          return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
            if (typeof unsubscribeLocale === 'function') unsubscribeLocale();
            if (collapseStyle && collapseStyle.parentNode) collapseStyle.parentNode.removeChild(collapseStyle);
            collapseStyle = null;
            lastCss = '';
            hiddenIds.clear();
          };
        }, 'sidebar-finder: collapse');

        // 运行时变量样式表的收尾。放在最后一个 effect，卸载顺序上意味着
        // 前面的 effect 已经把自己的变量项删干净了，这里只需要摘掉 <style>。
        ctx.effect(() => () => teardownVars(), 'sidebar-finder: vars-teardown');

        // 「更多」里补出被收纳的面板，并在菜单打开时同步一次官方 pin 状态
        const MorePanels = makeMorePanels(() => hiddenIds, () => visible, config);
        ctx.slots.inject('sidebar.panellist.actions', () => ctx.slots.register({
          name: 'sidebar.panellist.actions',
          id: 'sidebar-finder-more',
        }, MorePanels));

        // 工作区标题行入口：宿主没给这一行留插槽，所以用一个精确定位的按钮
        // 贴在标题行图标区左侧（走官方 shell.overlay 出口，不往 body 塞节点）
        const HeaderEntry = makeHeaderEntry(ctx, config);
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'sidebar-finder-entry',
        }, HeaderEntry));

        // 搜索浮层：走官方 shell.overlay 出口，不往 body 里塞节点
        const SearchOverlay = makeSearchOverlay(ctx, config);
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'sidebar-finder-overlay',
        }, SearchOverlay));

        // 发图区下拉板块：官方给的输入框下方插槽
        // （conversation.composer.dock，kind: list / scope: session）
        const ComposerDock = makeComposerDock(ctx, config);
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'sidebar-finder-dock',
          order: 30,
        }, ComposerDock));
      },
    };
    // #endregion
  },
});
