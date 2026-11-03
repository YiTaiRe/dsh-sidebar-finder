/* 60-overlay-helpers.js —— 原 client.js 第 282–312 行 */
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

