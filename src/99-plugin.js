/* 99-plugin.js —— 原 client.js 第 2395–2542 行 */
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
      },
    };
    // #endregion
  },
});
