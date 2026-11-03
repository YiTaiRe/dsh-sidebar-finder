/* 65-header-entry.js —— 原 client.js 第 313–469 行 */
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
