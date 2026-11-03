/* 96-collapse.js —— 原 client.js 第 2265–2394 行 */
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

