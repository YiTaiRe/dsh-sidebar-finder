/* 50-measure.js —— 原 client.js 第 119–281 行 */
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
        // 底部界限：结果区必须止步在侧边栏底部的浮动卡之上，否则列表会从
        // 「今日消耗金额」那张卡下面穿过去。
        //
        // 踩过两次坑，记下来免得再走一遍：
        //   第一次只量 [class*="_footArea"] 上边缘 —— 没用。
        //   第二次以为卡是 footArea 里的 fixed 子元素，在 foot 里找 —— 也没用。
        // 真相：那张卡是 @kenz1117/dsh-ui-usage-billing 用 createPortal 传送到
        // 宿主根节点之外的固定浮层，从视口底部往上浮。它既不在 footArea 里，
        // 也不在侧边栏子树里，所以前面两种找法都看不见它。
        //
        // 于是分成两路取最靠上的边界：
        //   ① footArea 上边缘（没有浮动卡时的自然边界）
        //   ② 全页里那些 position:fixed 的浮层，只要横向压在侧边栏上、
        //      纵向落在侧边栏下半段，就认为它会挡住结果区，取它的上边缘
        let bottomLimit = r.top + r.height;
        const sidebarBox = root.getBoundingClientRect();

        try {
          const foot = root.querySelector('[class*="_footArea"]');
          if (foot) {
            const fr = foot.getBoundingClientRect();
            if (fr.height > 0 && fr.top > r.top && fr.top < bottomLimit) {
              bottomLimit = fr.top;
            }
          }
        } catch { /* 忽略 */ }

        // 第三路（真正管用的那一路）：从下往上逐点探测「这个位置最上层是谁」。
        //
        // 前两路为什么失效：按 position:fixed + 类名扫全页，扫不到那张卡。
        // 但卡片的 z-index 是 2000，我们的浮层只有 40 —— 它明明画在上层，
        // 却因为 DOM 挂在传送门里、或者定位方式不同而漏掉了。
        //
        // 与其猜它长什么样、挂在哪，不如直接问浏览器：在侧边栏中轴线上，
        // 从工作区底边往上每个点，elementFromPoint 返回的最上层元素
        // 还是不是我们自己的浮层？第一次「不再是我们的」那一行，
        // 就是底部卡片的上边缘 —— 不依赖类名、不依赖定位方式、不依赖 DOM 归属。
        //
        // pointer-events:none 的元素会被 elementFromPoint 跳过，
        // 所以我们的渐隐条不会干扰探测结果。
        try {
          const x = Math.round(sidebarBox.left + Math.min(24, sidebarBox.width * 0.5));
          if (x > sidebarBox.left + 1 && x < sidebarBox.right - 1) {
            const bottomEdge = Math.floor(r.top + r.height) - 1;
            let sawOther = 0;
            let found = -1;
            for (let y = bottomEdge; y > r.top + 40; y -= 2) {
              const el = document.elementFromPoint(x, y);
              if (!el) break;
              const mine = typeof el.closest === 'function'
                ? el.closest('[data-wf-surface]')
                : null;
              if (mine) {
                // 撞回自己了：只有当底下连着几行都不是自己时才算「真的被挡住」
                if (sawOther >= 3) found = y;
                break;
              }
              sawOther += 1;
            }
            if (found > 0 && found < bottomLimit) bottomLimit = found;
          }
        } catch { /* 忽略 */ }

        // 给卡片本身留一点缝，别贴脸
        const FOOT_GAP = 6;
        if (bottomLimit < r.top + r.height) bottomLimit = Math.max(r.top, bottomLimit - FOOT_GAP);
        try {
          window.__wfBottom = {
            bottomLimit: Math.round(bottomLimit),
            regionBottom: Math.round(r.top + r.height),
            gap: Math.round(r.top + r.height - bottomLimit),
          };
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

