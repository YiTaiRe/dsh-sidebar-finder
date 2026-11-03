/* 40-icon.js —— 原 client.js 第 93–118 行 */
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

