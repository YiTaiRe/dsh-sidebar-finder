/* 30-open-state.js —— 原 client.js 第 73–92 行 */

    // #region 打开状态（图标行与浮层跨 slot 共享）
    let open = false;
    const listeners = new Set();
    function setOpen(next) {
      if (open === next) return;
      open = next;
      listeners.forEach((fn) => fn(open));
    }
    function useOpen() {
      const [, force] = useState(0);
      useEffect(() => {
        const fn = () => force((n) => n + 1);
        listeners.add(fn);
        return () => listeners.delete(fn);
      }, []);
      return open;
    }
    // #endregion

