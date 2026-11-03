/* 85-t-safe.js —— 原 client.js 第 1580–1589 行 */
    // #region 词典读取（未注入 locale 时回退中文）
    let translate = null;
    function tSafe(key) {
      const dict = (translate && translate(key)) || '';
      if (dict) return dict;
      const [group, name] = key.split('.');
      return (zh[group] && zh[group][name]) || key;
    }
    // #endregion

