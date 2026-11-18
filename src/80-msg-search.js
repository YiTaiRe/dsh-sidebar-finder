/* 80-msg-search.js —— 原 client.js 第 1303–1579 行 */
    // #region 消息检索
    /**
     * 消息正文都在 Session 的事件流里，不需要新接口：
     *   user/message       → event.data 本身就是一个消息（{role, content}）
     *   assistant/message  → event.data.message
     * 两者的 content 都是块数组，正文在 type==='text' 的块上。
     *
     * 一个会话打开时只加载尾部一页（约 500 条消息），更早的要 loadOlder() 往前翻，
     * 这里按预算翻有限页，避免一次搜索把长会话全量读进内存。
     */
    const MESSAGE_TYPES = new Set(['user/message', 'assistant/message']);

    /** 从一条消息事件里抽出纯文本；没有正文就返回空串。 */
    function messageTextOf(event) {
      try {
        const data = event && event.data;
        if (!data) return '';
        const message = event.type === 'user/message' ? data : data.message;
        const content = message && message.content;
        if (!Array.isArray(content)) return '';
        const parts = [];
        for (const block of content) {
          if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text);
        }
        return parts.join('');
      } catch {
        return '';
      }
    }

    /** 消息的轮次号；没有就返回 null。 */
    function messageTurnOf(event) {
      const turn = event && event.data && event.data.turn;
      return typeof turn === 'number' ? turn : null;
    }

    /** 从事件窗口里挑出所有消息条目。 */
    function messagesOf(entries) {
      const out = [];
      if (!Array.isArray(entries)) return out;
      for (const entry of entries) {
        const event = entry && entry.event ? entry.event : entry;
        if (!event || !MESSAGE_TYPES.has(event.type)) continue;
        const text = messageTextOf(event);
        if (!text) continue;
        out.push({ seq: event.seq, time: event.time, type: event.type, turn: messageTurnOf(event), text });
      }
      return out;
    }

    /** 在给定消息里找出命中，最多 maxHits 条。 */
    function matchMessages(messages, lowerQuery, maxHits) {
      const hits = [];
      for (const msg of messages) {
        if (hits.length >= maxHits) break;
        const lowerText = msg.text.toLowerCase();
        const at = lowerText.indexOf(lowerQuery);
        if (at < 0) continue;
        // 之前从命中点往前留 60 字，但结果行是单行 nowrap + 省略号，
        // 侧边栏一行只放得下三十几个字 —— 高亮词永远落在可视区外，
        // 用户看到的就是「整片没有一处亮」。
        // 改成只往前留 8 个字，让命中词稳定出现在第 9 个字附近。
        const PAD = 8;
        const start = Math.max(0, at - PAD);
        const snippet = msg.text.slice(start, start + 240).replace(/\s+/g, ' ').trim();
        hits.push({
          seq: msg.seq,
          turn: msg.turn,
          time: msg.time,
          role: msg.type,
          snippet,
          // 补一个「命中前还有多少字」的标记，渲染时据此加前置省略号
          lead: start > 0,
          text: msg.text,
        });
      }
      return hits;
    }

    /** 拿到某个会话的 live binding（含 eventSource）；没有 retain 就临时 retain。 */
    async function withSessionEvents(ctx, sessionId, signal, run) {
      const sessions = serviceOf(ctx, 'sessions');
      if (!sessions) return null;
      let reference = null;
      let binding = null;
      try {
        binding = sessions.binding(sessionId);
      } catch {
        binding = null;
      }
      if (!binding) {
        try {
          reference = sessions.retain(sessionId, { source: 'sidebar-finder', signal });
          await reference.ready;
          binding = reference.binding;
        } catch {
          try { reference?.release?.(); } catch { /* ignore */ }
          return null;
        }
      }
      try {
        return await run(binding);
      } finally {
        try { reference?.release?.(); } catch { /* ignore */ }
      }
    }

    /**
     * 在单个会话里搜消息。先扫已加载窗口，不够再往前翻页（受 pages 预算限制）。
     */
    async function searchSessionMessages(ctx, sessionId, lowerQuery, options) {
      const signal = options && options.signal;
      const maxHits = Math.max(1, Number(options && options.maxHits) || 20);
      const maxPages = Math.max(0, Number(options && options.maxPages) || 8);
      return withSessionEvents(ctx, sessionId, signal, async (binding) => {
        const session = binding.session;
        const source = binding.eventSource || (session && session.eventSource);
        if (!source || typeof source.getSnapshot !== 'function') return { hits: [], scanned: 0, truncated: false };

        let hits = [];
        let scanned = 0;
        let first = true;
        // 已经扫过的 seq。
        // loadOlder() 之后新快照是「前面多了一段、后面的照旧」，
        // 原来每翻一页都把整段重新抽文本、重新 toLowerCase、重新 indexOf 一遍。
        // 翻到第 8 页时同一批文本已经被处理了 8 次 —— 长会话里
        // 这就是搜索期间最明显的一处卡顿。按 seq 去重后每页只处理新增那段。
        const seen = new Set();
        for (let page = 0; page <= maxPages; page += 1) {
          if (signal && signal.aborted) break;
          const snap = source.getSnapshot();
          const messages = messagesOf(snap && snap.entries);
          scanned = messages.length;
          const fresh = [];
          for (const msg of messages) {
            if (msg.seq != null) {
              if (seen.has(msg.seq)) continue;
              seen.add(msg.seq);
            }
            fresh.push(msg);
          }
          hits = matchMessages(fresh, lowerQuery, maxHits);
          if (hits.length) return { hits, scanned, truncated: false };
          if (!snap || !snap.hasMore) return { hits, scanned, truncated: false };
          if (page === maxPages) break;
          if (first && session && typeof session.open === 'function') {
            try { await session.open(); } catch { /* 已打开 */ }
            first = false;
            continue;
          }
          const before = session && typeof session.loadOlder === 'function' ? session.loadOlder() : null;
          if (!before) break;
          try { await before; } catch { break; }
          first = false;
        }
        return { hits, scanned, truncated: true };
      });
    }

    /**
     * 不依赖宿主全文索引的候选会话枚举。
     *
     * 宿主的会话全文索引是**可选**的：dsh-base 的 cordis.patch.yml 里
     * `session-query-sqlite` 配的是 `openAt: never`，注释写明
     * 「Full-text session search is opt-in」，设成 never 时服务仍然挂载
     * （标题、血缘这些精确读照常可用），但任何搜索调用都会抛
     * SESSION_QUERY_SEARCH_DISABLED。没有 profile 覆盖的情况下，
     * sessions.search() 100% 失败，原来的 catch 又把它吞成空数组，
     * 症状就是「说全局搜索，却只有当前会话」。
     *
     * 退路是直接读列表快照：它不经过索引，本来就在内存里。
     */
    function listOtherSessions(ctx, scope, limit) {
      try {
        const sessions = serviceOf(ctx, 'sessions');
        const snap = sessions && sessions.list && sessions.list.getSnapshot
          ? sessions.list.getSnapshot()
          : null;
        const byId = snap && snap.byId;
        if (!byId) return [];
        const rows = Object.keys(byId)
          .map((id) => byId[id])
          .filter((row) => row && row.id
            && row.id !== scope.sessionId
            && !row.blank
            && row.origin !== 'subagent')
          .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
          .slice(0, Math.max(0, limit));
        return rows.map((row) => ({
          sessionId: row.id,
          snippet: row.displayTitle || row.title || row.id,
        }));
      } catch {
        return [];
      }
    }

    /**
     * 消息检索总入口：当前会话 + 其他会话。
     * 其他会话先用宿主的会话级搜索缩小候选，再逐个进去搜消息正文。
     */
    async function runMessageSearch(ctx, query, options) {
      const signal = options && options.signal;
      const lowerQuery = String(query).toLowerCase();
      const scope = currentScope(ctx);
      if (!scope) {
        const sessions = serviceOf(ctx, 'sessions');
        const snap = sessions && sessions.list && sessions.list.getSnapshot();
        return {
          error: 'no-session', results: [], scanned: 0, truncated: false,
          missing: [
            sessions ? 'sessions.list 里没有可用会话' : 'sessions',
            `ids=${snap && snap.ids ? snap.ids.length : 'n/a'}`,
            `phase=${(snap && snap.phase) || 'n/a'}`,
            `selection=${currentSessionId(ctx) || '(空)'}`,
          ],
          services: listServices(ctx),
        };
      }
      const maxHits = Math.max(1, Number(options && options.maxHits) || 20);
      const otherLimit = Math.max(0, Number(options && options.maxSessionCandidates) || 6);
      // 当前会话最多只占一半配额。
      // 这个搜索是**全局**的（当前会话 + 其他会话），但当前会话先搜，
      // 若把 maxHits 全给它，一次命中几十条的长会话就把配额吃干，
      // 下面「其他会话」的循环会在第一条就撞上 results.length >= maxHits 直接 break，
      // 表现出来的症状就是「明明说全局搜索，却只搜了当前对话」。
      // 一半是保守值：短会话命中少时，剩下的配额自然还回给其他会话。
      const hereHits = otherLimit > 0 ? Math.max(1, Math.ceil(maxHits / 2)) : maxHits;
      const results = [];
      let truncated = false;

      // 1) 当前会话
      if (!(signal && signal.aborted)) {
        const here = await searchSessionMessages(ctx, scope.sessionId, lowerQuery, {
          signal, maxHits: hereHits, maxPages: options && options.maxPages,
        });
        if (here && here.hits && here.hits.length) {
          for (const hit of here.hits) {
            results.push({
              kind: 'message',
              scope: 'current',
              sessionId: scope.sessionId,
              sessionTitle: scope.title,
              seq: hit.seq,
              turn: hit.turn,
              time: hit.time,
              role: hit.role,
              snippet: hit.snippet,
              text: hit.text,
            });
          }
        }
        if (here && here.truncated) truncated = true;
      }

      // 2) 其他会话：先拿候选
      // 这一段每一步失败都可能让「其他会话」整组消失，而症状与「没有匹配」
      // 完全一样，所以每一环都记下原因，由界面在缺组时显示出来。
      let candidates = [];
      const otherDiag = [];
      try {
        const sessions = serviceOf(ctx, 'sessions');
        if (!sessions) {
          otherDiag.push('sessions 服务取不到');
        } else if (typeof sessions.search !== 'function') {
          otherDiag.push('sessions.search 不是函数');
        } else {
          const res = await sessions.search(query, signal);
          if (!res) {
            otherDiag.push('search 返回空');
          } else if (!res.ok) {
            const e = res.error;
            otherDiag.push(`search 失败: ${(e && (e.code || e.message)) || String(e)}`);
          } else if (!res.value || !Array.isArray(res.value.items)) {
            otherDiag.push('search 结果结构不对');
          } else {
            const all = res.value.items;
            const others = all.filter((item) => item && item.sessionId && item.sessionId !== scope.sessionId);
            candidates = others.slice(0, otherLimit);
            otherDiag.push(
              `候选 ${others.length}/${all.length}`
              + (otherLimit < others.length ? `(上限 ${otherLimit})` : ''),
            );
            if (res.value.hasMore) truncated = true;
          }
        }
      } catch (error) {
        otherDiag.push(`search 抛错: ${error && error.message ? error.message : String(error)}`);
        candidates = [];
      }

      // 宿主索引可能根本没开（见 listOtherSessions 的说明），也可能搜索
      // 确实没有命中。两种情况下都退回列表枚举：多扫几个会话，总好过
      // 让「其他会话」整组凭空消失。
      if (!candidates.length) {
        const listed = listOtherSessions(ctx, scope, otherLimit);
        if (listed.length) {
          candidates = listed;
          otherDiag.push(`退回列表枚举 ${listed.length}`);
        } else {
          otherDiag.push(`列表里也没有其他会话(共 ${
            Object.keys((serviceOf(ctx, 'sessions')?.list?.getSnapshot() || {}).byId || {}).length
          })`);
        }
      }

      // 3) 逐个钻进去搜正文
      for (const candidate of candidates) {
        if (signal && signal.aborted) break;
        if (results.length >= maxHits) { truncated = true; break; }
        const remaining = maxHits - results.length;
        const found = await searchSessionMessages(ctx, candidate.sessionId, lowerQuery, {
          signal, maxHits: remaining, maxPages: options && options.maxPages,
        });
        if (!found || !found.hits || !found.hits.length) continue;
        const rec = serviceOf(ctx, 'sessions')?.list?.getSnapshot()?.byId?.[candidate.sessionId];
        const title = (rec && (rec.displayTitle || rec.title)) || candidate.snippet || candidate.sessionId;
        for (const hit of found.hits) {
          results.push({
            kind: 'message',
            scope: 'other',
            sessionId: candidate.sessionId,
            sessionTitle: title,
            seq: hit.seq,
            turn: hit.turn,
            time: hit.time,
            role: hit.role,
            snippet: hit.snippet,
            text: hit.text,
          });
        }
        if (found.truncated) truncated = true;
      }

      return {
        error: null, results, scanned: results.length, truncated, scope,
        // 仅消息检索有：其他会话这一组为什么可能是空的
        stats: { otherDiag, otherCount: candidates.length },
      };
    }

    /**
     * 打开某条消息：先切到那个会话，再按轮次滚动定位。
     * 聊天行带 data-chat-turn 属性，轮次号能直接对上；找不到就只切会话。
     */
    async function openMessage(ctx, result) {
      try {
        const workspace = serviceOf(ctx, 'uiWorkspace');
        if (workspace && typeof workspace.openSession === 'function') {
          await workspace.openSession(result.sessionId);
        } else {
          const sessions = serviceOf(ctx, 'sessions');
          if (!sessions || typeof sessions.retain !== 'function') return false;
          sessions.retain(result.sessionId, { source: 'sidebar-finder' });
        }
      } catch {
        return false;
      }
      if (typeof result.turn !== 'number') return true;
      // 等界面把消息渲染出来，再按轮次滚过去
      for (let attempt = 0; attempt < 12; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 120 : 90));
        const row = document.querySelector(`[data-chat-turn="${result.turn}"]`);
        if (row && typeof row.scrollIntoView === 'function') {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          row.setAttribute('data-wf-flash', 'true');
          window.setTimeout(() => row.removeAttribute('data-wf-flash'), 1600);
          return true;
        }
      }
      return false;
    }
    // #endregion

