/* 92-runtime-vars.js —— 原 client.js 第 2103–2250 行 */
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

