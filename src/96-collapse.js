/* 96-collapse.js —— 原 client.js 第 2265–2394 行 */
    // #region 面板收纳
    /*
     * 宿主把侧边栏面板分成两拨：`unpinned` 里的收进「更多」，其余平铺。
     * 但置顶状态只存在于内存，且写入口 `setPinned` 只传给
     * `sidebar.panellist.actions` 的注册者，而那个槽只在「更多」展开时才挂载。
     * 所以「启动即收纳」在公开 API 上做不到。
     *
     * 这里用两条路配合：
     *   ① 样式表按 aria-label 直接隐藏非白名单的面板行 —— 启动瞬间就生效；
     *   ② 注册进 `sidebar.panellist.actions`，借菜单挂载时交出的
     *      `onPinnedChange` 把官方 pin 状态同步一次，宿主随后自己把
     *      收起的行从侧边栏移除（比纯样式彻底，也不再依赖 aria-label）。
     *
     * 不要再往这个菜单里补自绘的行：DSH 2.0.23 起宿主
     * （@deepseek-ai/dsh-client-ui-entry-customization）自己就会把未固定的
     * 面板列进「更多」，带图标、勾选和固定按钮。再画一遍就是同一个面板两遍。
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
        .map((label) => `${SEL_SIDEBAR} nav[class*="_panelList"] [class*="_panelRow"][aria-label=${cssString(label)}]`)
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
    function makeMorePanels(getVisible, config) {
      return function SyncPins(props) {
        const entries = (props && props.entries) || [];
        const onPinnedChange = props && props.onPinnedChange;

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

        return null;
      };
    }
    // #endregion

