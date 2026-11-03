/* 94-fallback-panel.js —— 原 client.js 第 2251–2264 行 */

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

