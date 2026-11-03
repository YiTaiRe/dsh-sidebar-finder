/* 75-fs-search.js —— 原 client.js 第 882–1302 行 */
    // #region 工作区搜索
    /**
     * 搜索能力的边界（都是宿主既有只读接口，不需要新权限）：
     *   ctx.sessions.list.getSnapshot().current           → 当前 sessionId
     *   ctx.sessions.list.getSnapshot().byId[sid].cwd     → 工作区根目录
     *   ctx.remote.workspaceFiles.list(sid, path)         → { path, entries:[{name,type,size}], truncated }
     *   ctx.remote.workspaceFiles.read(sid, path, range)  → { offset, text, lines, eof }
     *
     * list 只给一层的直接子项，所以遍历是自己做的：队列 + 并发上限 + 深度上限。
     */

    /** 这些目录名默认不进去（Config.excludeDirs 可覆盖）。 */
    const DEFAULT_EXCLUDE = ['.git', 'node_modules', 'dist', 'build', '.venv', '__pycache__'];

    /** 明显是二进制的扩展名，不读内容，只按文件名参与匹配。 */
    const BINARY_EXT = new Set([
      'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'avif', 'tif', 'tiff',
      'pdf', 'zip', 'gz', 'tar', '7z', 'rar', 'exe', 'dll', 'so', 'dylib', 'bin',
      'woff', 'woff2', 'ttf', 'otf', 'eot', 'mp3', 'mp4', 'mov', 'avi', 'mkv', 'wav',
      'docx', 'xlsx', 'pptx', 'asar', 'node', 'pyc', 'class', 'jar', 'wasm',
    ]);

    function extOf(name) {
      const i = String(name).lastIndexOf('.');
      return i > 0 ? String(name).slice(i + 1).toLowerCase() : '';
    }

    function isBinaryName(name) {
      return BINARY_EXT.has(extOf(name));
    }

    /**
     * 通过 ctx.inject 捕获到的真实服务实例。
     *
     * cordis 的 inject 会给出一个作用域化的 ctx，只有在那上面读 inner[name]
     * 才拿得到服务实例；父级 ctx 上的同名属性需要插件显式声明 inject，
     * 否则代理会抛 `cannot get property "xxx" without inject`。
     * 这里在 apply 阶段用 ctx.inject 把需要的服务抓一次存下来，
     * serviceOf 优先用它，读不到才退回 ctx.get。
     */
    const liveServices = {};

    /** 取一个 cordis 服务。读不到就返回 undefined，绝不让插件整体加载失败。 */
    function serviceOf(ctx, name) {
      if (!ctx) return undefined;
      // 整个函数体兜一层 try/catch：cordis 的 context 是 Proxy，
      // 读未 inject 的属性（尤其 "remote.workspaceFiles" 这种点号名）会抛
      // `cannot get property "xxx" without inject`，不能让它漏到调用方。
      try {
        // 优先级 1：ctx.inject 作用域里抓到的真实实例（最可靠）
        if (Object.prototype.hasOwnProperty.call(liveServices, name)) {
          const captured = liveServices[name];
          if (captured !== undefined && captured !== null) return captured;
        }
        if (typeof ctx.get === 'function') {
          // 先按默认 strict 取（只认已激活的服务），再退一步取未激活的实现，
          // 避免插件加载时序早于服务就绪时读不到。
          for (const strict of [true, false]) {
            try {
              const value = ctx.get(name, strict);
              if (value !== undefined && value !== null) return value;
            } catch {
              /* 该服务未提供，继续下一次尝试 */
            }
          }
        }
        // 只对不含点号的短名尝试直接读取；点号名一律走 inject 捕获或 ctx.get
        if (name.indexOf('.') < 0) {
          try {
            const direct = ctx[name];
            if (direct !== undefined && direct !== null) return direct;
          } catch {
            /* cordis 因未 inject 而抛错，视为不可用 */
          }
        }
      } catch {
        /* Proxy 抛错也视为不可用 */
      }
      return undefined;
    }

    /** Remote 载体：优先 ctx.get('remote')，退路是注入名 remote.workspaceFiles。 */
    function remoteOf(ctx) {
      try {
        const remote = serviceOf(ctx, 'remote');
        if (remote) return remote;
        const standalone = serviceOf(ctx, 'remote.workspaceFiles');
        if (standalone) return { workspaceFiles: standalone };
      } catch {
        /* 读不到就当没有 */
      }
      return undefined;
    }

    /**
     * 列出当前运行时可用的服务名。
     * cordis 的 ReflectService 用 props[name] = { type: "service" } 记录声明过的属性，
     * 所以 Object.keys(ctx.reflect.props) 就是服务名全集。
     * 这是排查「拿不到某个服务」最直接的证据来源。
     */
    function listServices(ctx) {
      const names = new Set();
      const collect = (source) => {
        try {
          if (!source || typeof source !== 'object') return;
          Object.keys(source).forEach((name) => names.add(name));
        } catch {
          /* 读不到就跳过 */
        }
      };
      try {
        collect(ctx && ctx.reflect && ctx.reflect.props);
      } catch {
        /* 忽略 */
      }
      try {
        collect(ctx && ctx.fiber && ctx.fiber.store);
      } catch {
        /* 忽略 */
      }
      return [...names].sort();
    }

    /** 从 ctx 里取搜索所需的三个能力；缺哪个都记进 missing 里，界面直接显示。 */
    function readSearchApis(ctx) {
      const missing = [];
      try {
        const sessions = serviceOf(ctx, 'sessions');
        const listSnap = sessions && sessions.list && sessions.list.getSnapshot();
        if (!sessions) missing.push('sessions');
        else if (!sessions.list) missing.push('sessions.list');
        else if (!listSnap) missing.push('sessions.list.getSnapshot()');

        // remote.workspaceFiles 在本宿主里是**独立服务名**（不是 remote 的属性）。
        // 注意：不要写 remote.workspaceFiles —— remote 也是 cordis 代理对象，
        // 访问它上面的点号属性同样会抛 `cannot get property ... without inject`。
        const workspaceFiles = serviceOf(ctx, 'remote.workspaceFiles');
        if (!workspaceFiles) missing.push('remote.workspaceFiles');

        if (!listSnap || !workspaceFiles) {
          return { error: 'no-api', missing, services: listServices(ctx) };
        }
        return { sessions, listSnap, workspaceFiles };
      } catch (error) {
        return { error: 'no-api', missing: [`抛错: ${error && error.message ? error.message : String(error)}`], services: listServices(ctx) };
      }
    }

    /** 当前会话 id 与工作区根；拿不到就没有可搜的范围。 */
    /**
     * 当前会话 id 与工作区根。
     *
     * 注意：sessions.list 的快照形状是 { ids, byId, phase, projectionsBySession }，
     * **没有 current 字段**（见 @deepseek-ai/dsh-api-session-controller 的
     * ClientSessions 构造函数：createSnapshotStore({ ids: [], byId: {}, phase: 'pending', ... })）。
     * 当前会话在 uiWorkspace.selection，它带 persist: { name: "dsh.sessions.current" }，
     * 快照形状 { sessionId }。所以优先级是：selection → 已 retain 的 mainView → 唯一会话。
     */
    function currentScope(ctx) {
      try {
        const sessions = serviceOf(ctx, 'sessions');
        const listSnap = sessions && sessions.list && sessions.list.getSnapshot();
        const byId = (listSnap && listSnap.byId) || {};
        const ids = (listSnap && listSnap.ids) || Object.keys(byId);

        let sessionId = currentSessionId(ctx);
        if (!sessionId) {
          // 退路：main 视图正在 retain 的那一个
          const retained = Object.values(byId).find((row) => row && (row.retainedBy?.mainView ?? 0) > 0);
          sessionId = retained && retained.sessionId;
        }
        if (!sessionId && ids.length === 1) sessionId = ids[0];
        if (!sessionId) return null;

        const rec = byId[sessionId];
        return {
          sessionId,
          cwd: (rec && rec.cwd) || '',
          title: (rec && (rec.displayTitle || rec.title)) || '',
        };
      } catch {
        return null;
      }
    }

    /** 当前会话 id：uiWorkspace.selection 是权威源，读不到再看持久化的 localStorage。 */
    function currentSessionId(ctx) {
      try {
        const workspace = serviceOf(ctx, 'uiWorkspace');
        const selection = workspace && workspace.selection;
        if (selection && typeof selection.getSnapshot === 'function') {
          const value = selection.getSnapshot();
          if (value && typeof value.sessionId === 'string' && value.sessionId) return value.sessionId;
        }
      } catch {
        /* 继续退路 */
      }
      try {
        const raw = globalThis.localStorage && globalThis.localStorage.getItem('dsh.sessions.current');
        if (raw) {
          const parsed = JSON.parse(raw);
          const nested = parsed && parsed.value && typeof parsed.value === 'object' ? parsed.value : parsed;
          if (nested && typeof nested.sessionId === 'string' && nested.sessionId) return nested.sessionId;
        }
      } catch {
        /* 读不到就放弃 */
      }
      return '';
    }

    /**
     * 递归遍历工作区，把文件清单交给 onFile。
     * 用队列而不是递归，配合并发上限，避免大仓库把主线程打满或触发限流。
     */
    async function walkWorkspace(ctx, options) {
      const apis = readSearchApis(ctx);
      if (!apis || apis.error) {
        return { error: 'no-api', missing: (apis && apis.missing) || [], services: (apis && apis.services) || [] };
      }
      const scope = currentScope(ctx);
      if (!scope) return { error: 'no-session' };

      const excludeDirs = new Set(
        (options && Array.isArray(options.excludeDirs) && options.excludeDirs.length
          ? options.excludeDirs
          : DEFAULT_EXCLUDE).map((s) => String(s)),
      );
      const maxFiles = Math.max(1, Number(options && options.maxResults) || 200);
      const maxDepth = Math.max(1, Number(options && options.maxDepth) || 12);
      const onFile = options && options.onFile;
      const signal = options && options.signal;

      const files = [];
      // list() 的 path 参数要求「绝对路径，或相对工作区根的路径」，
      // 空字符串会被后端判为非法（ok=false: path is required）。
      // 所以根目录传 cwd 绝对路径，取不到就退 './'，子目录则用相对路径。
      const rootPath = (scope && scope.cwd) ? scope.cwd : '.';
      const queue = [{ path: rootPath, depth: 0, root: true }];
      let truncated = false;
      // 遍历统计：零结果时用它区分「没读到目录」和「读到了但没文件」
      const stats = { dirs: 0, entries: 0, errors: [], sampleTypes: [] };

      while (queue.length) {
        if (signal && signal.aborted) return { error: 'aborted' };
        if (files.length >= maxFiles) { truncated = true; break; }
        // 每轮取一小批并发，兼顾速度与限流
        const batch = queue.splice(0, 8);
        const results = await Promise.all(batch.map(async (dir) => {
          try {
            const res = await apis.workspaceFiles.list(scope.sessionId, dir.path);
            return { dir, res };
          } catch (error) {
            return { dir, res: null, error };
          }
        }));
        for (const { dir, res, error } of results) {
          stats.dirs += 1;
          if (error) {
            if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: ${error && error.message ? error.message : String(error)}`);
            continue;
          }
          // 返回值可能是 { ok, value } 包装，也可能是裸值，两种都认。
          if (!res) { if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: 返回空`); continue; }
          if (res.ok === false) {
            if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: ok=false ${(res.error && res.error.message) || ''}`);
            continue;
          }
          const value = res.value || res;
          if (!value || typeof value !== 'object') { if (stats.errors.length < 5) stats.errors.push(`${dir.path || '(根)'}: 值不是对象`); continue; }
          const entries = Array.isArray(value.entries) ? value.entries : [];
          stats.entries += entries.length;
          // 用后端回的 path 当基准：它是「相对工作区根的路径，根为空」，
          // 拿它拼出来的子路径正好是后续 read()/list() 都能接受的相对路径。
          const base = typeof value.path === 'string' ? value.path : (dir.root ? '' : dir.path);
          for (const raw of entries) {
            // 条目可能是对象，也可能是纯字符串（不同后端实现不同），都兼容
            const entry = typeof raw === 'string' ? { name: raw } : raw;
            if (!entry || typeof entry.name !== 'string') continue;
            const type = String(entry.type || '').toLowerCase();
            if (stats.sampleTypes.length < 8 && stats.sampleTypes.indexOf(type) < 0) stats.sampleTypes.push(type || '(空)');
            const childPath = base ? `${base}/${entry.name}` : entry.name;
            // directory / dir / folder 都当目录；file / 空类型（无 size 视为文件）都当文件
            const isDir = type === 'directory' || type === 'dir' || type === 'folder';
            if (isDir) {
              if (excludeDirs.has(entry.name)) continue;
              if (dir.depth + 1 > maxDepth) continue;
              queue.push({ path: childPath, depth: dir.depth + 1 });
            } else {
              if (files.length >= maxFiles) { truncated = true; break; }
              const item = { path: childPath, name: entry.name, size: entry.size };
              files.push(item);
              if (typeof onFile === 'function') onFile(item);
            }
          }
        }
      }
      return { error: null, files, truncated, scope, stats };
    }

    /** 读一个文件的全部文本（按宿主默认每页行数翻页），用于全文匹配。 */
    async function readWholeText(ctx, sessionId, path, maxLines) {
      const apis = readSearchApis(ctx);
      if (!apis || apis.error) return null;
      const cap = Math.max(1, Number(maxLines) || 4000);
      let offset = 1;
      const chunks = [];
      let total = 0;
      while (total < cap) {
        let res;
        try {
          res = await apis.workspaceFiles.read(sessionId, path, { offset, limit: Math.min(500, cap - total) });
        } catch {
          return null;
        }
        // 返回值可能是 { ok, value } 包装，也可能是裸值，两种都认。
        if (!res) return chunks.length ? chunks.join('\n') : null;
        if (res.ok === false) return chunks.length ? chunks.join('\n') : null;
        const value = res.value || res;
        if (!value || typeof value.text !== 'string') return chunks.length ? chunks.join('\n') : null;
        if (value.lines === 0) break;
        chunks.push(value.text);
        total += value.lines;
        if (value.eof) break;
        offset += value.lines;
      }
      return chunks.join('\n');
    }

    /** 把一行里的关键词包成高亮片段，交给 React 渲染（不拼 HTML）。 */
    function highlightSegments(text, query) {
      const line = String(text == null ? '' : text);
      const needle = String(query || '');
      if (!needle) return [{ text: line, hit: false }];
      const lowerLine = line.toLowerCase();
      const lowerNeedle = needle.toLowerCase();
      const parts = [];
      let from = 0;
      for (;;) {
        const at = lowerLine.indexOf(lowerNeedle, from);
        if (at < 0) break;
        if (at > from) parts.push({ text: line.slice(from, at), hit: false });
        parts.push({ text: line.slice(at, at + needle.length), hit: true });
        from = at + needle.length;
      }
      if (!parts.length) return [{ text: line, hit: false }];
      if (from < line.length) parts.push({ text: line.slice(from), hit: false });
      return parts;
    }

    /**
     * 执行一次搜索。
     * 先按文件名匹配（便宜、全覆盖），再对「没被文件名命中的文本文件」读内容匹配。
     * 内容匹配有预算上限，避免大仓库卡死。
     */
    async function runSearch(ctx, query, options) {
      const q = String(query || '').trim();
      if (!q) return { error: null, results: [], scanned: 0, truncated: false, scope: null };
      const signal = options && options.signal;
      const opts = options || {};
      const contentBudget = Math.max(0, Number(opts.contentFileBudget) || 120);
      const results = [];
      const walked = await walkWorkspace(ctx, { ...opts, signal });
      if (walked.error) {
        return {
          error: walked.error, results: [], scanned: 0, truncated: false, scope: null,
          missing: walked.missing || [], services: walked.services || [],
        };
      }

      const lowerQ = q.toLowerCase();
      const leftovers = [];
      for (const file of walked.files) {
        if (signal && signal.aborted) return { error: 'aborted', results, scanned: 0, truncated: false, scope: walked.scope };
        if (file.name.toLowerCase().includes(lowerQ)) {
          results.push({ kind: 'name', path: file.path, name: file.name, size: file.size, matches: [] });
        } else if (!isBinaryName(file.name)) {
          leftovers.push(file);
        }
      }

      // 内容匹配：按预算逐个读，命中就带出行号和整行文本
      const budget = Math.min(contentBudget, leftovers.length);
      for (let i = 0; i < budget; i += 1) {
        if (signal && signal.aborted) return { error: 'aborted', results, scanned: i, truncated: walked.truncated, scope: walked.scope };
        const file = leftovers[i];
        const text = await readWholeText(ctx, walked.scope.sessionId, file.path, opts.maxContentLines);
        if (!text) continue;
        const matches = [];
        const lines = text.split('\n');
        for (let n = 0; n < lines.length && matches.length < 5; n += 1) {
          const lowerLine = lines[n].toLowerCase();
          const col = lowerLine.indexOf(lowerQ);
          if (col >= 0) {
            // 和消息检索同一个问题：整行从 0 截 400 字，
            // 命中落在 400 字之后就完全看不到高亮。
            // 改成以命中点为中心取一段窗口。
            const START = Math.max(0, col - 24);
            matches.push({
              lineNumber: n + 1,
              line: lines[n].slice(START, START + 400),
              lead: START > 0,
            });
          }
        }
        if (matches.length) {
          results.push({ kind: 'content', path: file.path, name: file.name, size: file.size, matches });
        }
      }

      return {
        error: null,
        results,
        scanned: walked.files.length,
        truncated: walked.truncated,
        scope: walked.scope,
        // 零结果时把遍历实况带回去，界面上能直接看出卡在哪一步
        stats: walked.stats,
      };
    }
    // #endregion

