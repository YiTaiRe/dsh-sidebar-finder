/* 70-overlay.js —— 原 client.js 第 470–881 行 */

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

        // 打开时量一次；窗口尺寸变化时重量。
        //
        // 为什么要补测几次：底栏那张「今日消耗金额」卡是 fixed 定位、由别的
        // 插件异步渲染的，打开浮层那一刻它可能还没画出来，量到的底边会偏下。
        // 补 220ms / 600ms 两次，等它画稳了再量一遍。
        useEffect(() => {
          if (!isOpen) {
            setBox(null);
            return undefined;
          }
          const remeasure = () => setBox(measureRegion());
          remeasure();
          window.addEventListener('resize', remeasure);
          const timers = [60, 220, 600].map((ms) => window.setTimeout(remeasure, ms));
          return () => {
            window.removeEventListener('resize', remeasure);
            timers.forEach((t) => window.clearTimeout(t));
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
            // 有查询：铺到「底栏卡片上沿」为止。注意这里不能再用
            // Math.max(120, …) 兜底 —— 矮窗口下可用高度本来就不到 120，
            // 兜底反而会把浮层顶出边界、压到底部卡片上。
            // bodyHeight 已经把底部卡片让出来了，直接用即可。
            height: hasQuery
              ? Math.max(box.headHeight, box.bodyHeight + box.headHeight)
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
          {
            className: overlayClass,
            style,
            role: 'dialog',
            'aria-label': tSafe('finder.title'),
            // 标记：让 elementFromPoint 那一路能认出「这个位置是我们自己」。
            // 用自定义属性而不是类名，避免和样式选择器耦合。
            'data-wf-surface': 'finder',
          },
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
          // 底部渐隐：照抄宿主 .SJMXQW_fade 的做法 —— 一条 24px 高的
          // linear-gradient 盖在列表底部，从透明过渡到侧边栏底色。
          // 原生就这么处理「列表还没结束但视觉上还要让位给底部元素」，
          // 所以列表和底部卡片之间不会出现硬切边。
          hasQuery ? h('div', { className: 'wf-body' }, body) : null,
          hasQuery ? h('div', { className: 'wf-fade', 'aria-hidden': true }) : null,
        );
      };
    }
    // #endregion

