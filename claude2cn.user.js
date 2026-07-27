// ==UserScript==
// @name         Claude 中文汉化 用量显示 Claude.ai
// @namespace    https://github.com/jyking/claude2cn/
// @homepageURL  https://github.com/jyking/claude2cn/
// @author       jyking
// @version      1.7.8
// @description  Claude 中文汉化 ai翻译 10000行翻译, 剩余用量显示
// @icon         https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/cd02a42d9-Vq_H3mgS.svg
// @match        https://claude.ai/*
// @require      https://update.greasyfork.org/scripts/580982/1841849/claude2cn-design.js?v1.7.8
// @require      https://update.greasyfork.org/scripts/588732/1886288/claude2cn-translations-1.js?v1.7.8
// @require      https://update.greasyfork.org/scripts/588733/1886289/claude2cn-translations-2.js?v1.7.8
// @require      https://update.greasyfork.org/scripts/588734/1886290/claude2cn-translations-3.js?v1.7.8
// @require      https://update.greasyfork.org/scripts/588736/1886294/claude2cn-translations-4.js?v1.7.8
// @grant        none
// @license      MIT
// @run-at       document-start
// ==/UserScript==

(function () {
  "use strict";

  // 添加 CSS 变量
  const style = document.createElement("style");
  style.textContent = `
    :root {
      --font-anthropic-serif: "Anthropic Serif", Georgia, "Times New Roman", Times, "Noto Serif CJK SC", "Source Han Serif SC", "Noto Serif SC", "Source Hans Serif CN", "Songti SC", SimSun, serif;
    }
  `;
  // document_start 时 <head> 可能尚未创建,回退到 <html> 以免抛错中断整个 IIFE
  (document.head || document.documentElement).appendChild(style);

  try {
    localStorage.setItem("spa:i18nSkipEnUsBase", "0");
  } catch {}

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0].url;

    if (
      !url.includes("/i18n/en-US.json") &&
      !url.includes("/i18n/statsig/en-US.json") &&
      !url.includes("/i18n/dynamic/en-US.json")
    ) {
      return originalFetch(...args);
    }

    const response = await originalFetch(...args);

    try {
      const json = await response.json();
      const dict = typeof TRANSLATIONS !== "undefined" ? TRANSLATIONS : {};
      for (const key of Object.keys(json)) {
        const val = json[key];
        if (typeof val === "string" && dict[val]) {
          json[key] = dict[val];
        }
      }

      // 只保留 content-type，丢弃原始的 content-encoding / content-length，
      // 否则新 body（未压缩明文）会按旧编码解码失败，导致页面回退英文。
      const headers = new Headers();
      headers.set(
        "content-type",
        response.headers.get("content-type") || "application/json"
      );

      return new Response(JSON.stringify(json), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      // 翻译失败时原样返回，避免页面拿到 reject 回退英文
      return response;
    }
  };

  // ── 远程词库兜底（仅浏览器扩展环境）──
  // 油猴用户由 GreasyFork/GitHub raw @require 自动更新；扩展走商店审核有延迟，
  // 故在扩展中后台拉取最新 3 个分片 + extra 覆盖层，内容有变则热替换全局 TRANSLATIONS。
  // 打包词库始终作为离线基线，远程失败不影响使用。
  // fetch hook / DOM 翻译均按需读取全局 TRANSLATIONS，热替换后下一次调用即生效。
  if (typeof GM_info === "undefined") {
    (async () => {
      try {
        const META_KEY = "claude2cn_remote_meta_v1";
        const TTL_MS = 6 * 60 * 60 * 1000; // 每 6h 至多检查一次
        const BASE =
          "https://raw.githubusercontent.com/jyking/claude2cn/main/";
        const REMOTE_FILES = [
          "claude2cn-translations-1.user.js",
          "claude2cn-translations-2.user.js",
          "claude2cn-translations-3.user.js",
          "claude2cn-translations-4.user.js",
        ];

        let meta = {};
        try {
          meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
        } catch {}
        if (Date.now() - (meta.checkedAt || 0) < TTL_MS) return;

        // 并行拉取 4 个文件；单个失败用空串占位（eval 空串无副作用，打包基线仍生效）
        const texts = await Promise.all(
          REMOTE_FILES.map((f) =>
            originalFetch(BASE + f, { cache: "no-cache" })
              .then((r) => (r.ok ? r.text() : ""))
              .catch(() => "")
          )
        );
        const combined = texts.join("\n;\n");

        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(combined)
        );
        const hash = Array.from(new Uint8Array(digest))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        try {
          localStorage.setItem(
            META_KEY,
            JSON.stringify({ checkedAt: Date.now(), hash })
          );
        } catch {}

        if (hash === meta.hash) return; // 内容未变，跳过 eval

        // 间接 eval = 全局作用域；4 个分片均为
        // `var TRANSLATIONS = typeof...; Object.assign(TRANSLATIONS, {...});`
        // 累加执行后直接更新全局对象，fetch hook / DOM 翻译下一次调用即生效。
        (0, eval)(combined);
        console.info(`[claude2cn] 词库已热更新（${hash.slice(0, 8)}）`);
      } catch (e) {
        console.warn("[claude2cn] 远程词库检查失败，使用打包词库", e);
      }
    })();
  }

  const ClaudeUsageWidget = (() => {
    "use strict";

    let orgId = null;
    let autoRefreshTimer = null;
    let countdownTimer = null;
    let isHovered = false;
    let panel = null;
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let savedPosition = { left: null, right: 4, top: 50, isRight: true }; // 默认右上角

    let usageData = {
      fiveHour: { utilization: 0, resets_at: null },
      sevenDay: { utilization: 0, resets_at: null },
      planName: "",
      lastFetch: null,
      fetchError: null,
    };

    const _origFetch = window.fetch.bind(window);

    function hookFetch() {
      window.fetch = function (...args) {
        const url =
          typeof args[0] === "string"
            ? args[0]
            : args[0] instanceof Request
              ? args[0].url
              : "";
        captureOrgId(url);
        return _origFetch(...args);
      };

      const _origXHROpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url, ...rest) {
        if (typeof url === "string") captureOrgId(url);
        return _origXHROpen.call(this, method, url, ...rest);
      };
    }

    function captureOrgId(url) {
      if (!url) return;
      const m = url.match(
        /\/api\/organizations\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      );
      if (!m) return;
      const newId = m[1];
      if (orgId !== newId) {
        orgId = newId;
        console.log("[Claude用量] orgId 已获取:", orgId);
      }
      if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
      autoRefreshTimer = setTimeout(fetchUsage, 600);
    }

    async function discoverOrgId() {
      if (orgId) return true;
      const candidates = [
        "https://claude.ai/api/bootstrap",
        // "https://claude.ai/api/organizations",
      ];
      for (const url of candidates) {
        try {
          const res = await _origFetch(url, {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (!res.ok) continue;
          const data = await res.json();
          const str = JSON.stringify(data);
          const m = str.match(
            /"(?:uuid|id|organization_id)"\s*:\s*"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i,
          );
          if (m && !orgId) {
            orgId = m[1];
            console.log(`[Claude用量] 从 ${url} 获取 orgId`, orgId);
            return true;
          }
        } catch {}
      }
      return false;
    }

    function createPanel() {
      const metrics = getPanelMetrics();
      panel = document.createElement("div");
      panel.id = "claude-usage-panel-bottom";
      Object.assign(panel.style, {
        position: "fixed",
        top: "50px",
        right: metrics.defaultRight + "px",
        zIndex: "1000",
        background: "rgb(254, 252, 245)",
        border: "1px solid rgb(240, 235, 225)",
        borderRadius: metrics.borderRadius,
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "rgb(80, 75, 65)",
        padding: metrics.padding,
        width: "auto",
        minWidth: metrics.minWidth + "px",
        userSelect: "none",
        boxShadow: "none",
        cursor: "move",
        transition: "all 0.2s ease",
        touchAction: "none",
      });
      return panel;
    }

    function applyTheme() {
      if (!panel) return;
      const isDark =
        document.documentElement.classList.contains("dark") ||
        document.documentElement.getAttribute("data-theme") === "dark" ||
        window.matchMedia("(prefers-color-scheme: dark)").matches;

      if (isDark) {
        Object.assign(panel.style, {
          background: "rgb(40, 38, 35)",
          borderColor: "rgb(60, 55, 50)",
          color: "rgb(200, 195, 185)",
        });
      } else {
        Object.assign(panel.style, {
          background: "rgb(254, 252, 245)",
          borderColor: "rgb(240, 235, 225)",
          color: "rgb(80, 75, 65)",
        });
      }
    }

    function pct(v) {
      return Math.min(100, Math.max(0, Math.round(v || 0)));
    }

    function clr(p) {
      return p < 60 ? "#10b981" : p < 85 ? "#f59e0b" : "#ef4444";
    }

    function clrDark(p) {
      return p < 60 ? "#34d399" : p < 85 ? "#fbbf24" : "#f87171";
    }

    function cdText(ts) {
      if (!ts) return "";
      const target =
        typeof ts === "string" ? new Date(ts).getTime() : ts * 1000;
      const diff = target - Date.now();
      if (diff <= 0) return "已重置";
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    function fmtTime(ts) {
      if (!ts) return "—";
      const d = typeof ts === "string" ? new Date(ts) : new Date(ts * 1000);
      if (isNaN(d.getTime())) return "—";
      return d.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    function isMobileLayout() {
      return window.innerWidth <= 768;
    }

    function getPanelMetrics() {
      if (isMobileLayout()) {
        return {
          defaultRight: null,
          collapsedWidth: 32,
          expandedWidth: Math.min(180, window.innerWidth - 16),
          minWidth: 32,
          padding: "3px 2px",
          borderRadius: "4px",
        };
      }
      return {
        defaultRight: 8,
        collapsedWidth: 56,
        expandedWidth: 180,
        minWidth: 56,
        padding: "8px 10px",
        borderRadius: "6px",
      };
    }

    function getMobileAnchorPosition() {
      return {
        left: Math.round(window.innerWidth * 0.64),
        top: 4,
      };
    }

    function renderPanel() {
      if (
        !document.body ||
        !panel ||
        !document.getElementById("claude-usage-panel-bottom")
      )
        return;
      applyTheme();

      if (!orgId) {
        panel.innerHTML = `
        <div style="font-size:10px;opacity:0.6;text-align:center;">
          ⏳
        </div>`;
        return;
      }

      if (usageData.fetchError) {
        panel.innerHTML = `
        <div style="font-size:10px;opacity:0.6;text-align:center;">⚠️</div>`;
        return;
      }

      const fh = usageData.fiveHour;
      const sd = usageData.sevenDay;
      const fhPct = pct(fh.utilization);
      const sdPct = pct(sd.utilization);
      const fhRemain = 100 - fhPct;
      const sdRemain = 100 - sdPct;

      const isDark = document.documentElement.classList.contains("dark");
      const fhColor = isDark ? clrDark(fhPct) : clr(fhPct);
      const sdColor = isDark ? clrDark(sdPct) : clr(sdPct);
      const isMobile = isMobileLayout();

      const textMuted = isDark
        ? "rgba(200, 195, 185, 0.6)"
        : "rgba(80, 75, 65, 0.6)";
      const metrics = getPanelMetrics();

      // 判断面板是否靠近右侧
      const rect = panel.getBoundingClientRect();
      const isNearRight =
        savedPosition.isRight !== null
          ? savedPosition.isRight
          : rect.left > window.innerWidth / 2;

      // 使用保存的位置或当前位置
      let currentLeft, currentRight;
      if (isNearRight) {
        currentRight =
          savedPosition.right !== null
            ? savedPosition.right
            : window.innerWidth - rect.right;
      } else {
        currentLeft =
          savedPosition.left !== null ? savedPosition.left : rect.left;
      }
      const currentTop =
        savedPosition.top !== null ? savedPosition.top : rect.top;

      if (isHovered) {
        const expandedWidth = metrics.expandedWidth;

        panel.style.top = currentTop + "px";
        panel.style.bottom = "auto";
        panel.style.padding = metrics.padding;
        panel.style.borderRadius = metrics.borderRadius;

        if (isNearRight) {
          // 靠右时向左展开，保持右边缘不变
          panel.style.right = Math.max(0, currentRight) + "px";
          panel.style.left = "auto";
        } else {
          // 靠左时向右展开，保持左边缘不变
          const maxLeft = Math.max(0, window.innerWidth - expandedWidth);
          panel.style.left = Math.max(0, Math.min(currentLeft, maxLeft)) + "px";
          panel.style.right = "auto";
        }

        panel.style.width = expandedWidth + "px";
        panel.style.minWidth = expandedWidth + "px";

        panel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="font-size:11px;font-weight:600;opacity:0.8;text-align:center;border-bottom:1px solid ${textMuted};padding-bottom:6px;">Claude 用量监控</div>

          <div>
            <div style="font-size:9px;color:${textMuted};margin-bottom:3px;">⚡ 5小时窗口</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">
              <span style="font-size:11px;opacity:0.7;">剩余</span>
              <span style="font-size:16px;font-weight:600;color:${fhColor};">${fhRemain}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:8px;opacity:0.6;">
              <span>已用 ${fhPct}%</span>
              <span>${fmtTime(fh.resets_at)}</span>
            </div>
            <div id="fhcd" style="font-size:8px;color:${fhColor};margin-top:2px;text-align:right;">${cdText(fh.resets_at)}</div>
          </div>

          <div>
            <div style="font-size:9px;color:${textMuted};margin-bottom:3px;">📅 7天配额</div>
            <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px;">
              <span style="font-size:11px;opacity:0.7;">剩余</span>
              <span style="font-size:16px;font-weight:600;color:${sdColor};">${sdRemain}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:8px;opacity:0.6;">
              <span>已用 ${sdPct}%</span>
              <span>${fmtTime(sd.resets_at)}</span>
            </div>
            <div id="sdcd" style="font-size:8px;color:${sdColor};margin-top:2px;text-align:right;">${cdText(sd.resets_at)}</div>
          </div>
        </div>
      `;
      } else {
        const collapsedWidth = metrics.collapsedWidth;
        panel.style.padding = metrics.padding;
        panel.style.borderRadius = metrics.borderRadius;
        panel.style.top = currentTop + "px";
        panel.style.bottom = "auto";

        if (isNearRight) {
          // 靠右时保持右对齐收起
          panel.style.right = Math.max(0, currentRight) + "px";
          panel.style.left = "auto";
        } else {
          // 靠左时保持左对齐收起
          const maxLeft = Math.max(0, window.innerWidth - collapsedWidth);
          panel.style.left = Math.max(0, Math.min(currentLeft, maxLeft)) + "px";
          panel.style.right = "auto";
        }

        panel.style.width = collapsedWidth + "px";
        panel.style.minWidth = collapsedWidth + "px";

        panel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:${isMobile ? 2 : 8}px;align-items:center;">
          <div style="text-align:center;">
            ${isMobile ? "" : `<div style="font-size:8px;color:${textMuted};margin-bottom:2px;">5小时</div>`}
            <div style="font-size:${isMobile ? 11 : 16}px;font-weight:600;color:${fhColor};line-height:1.05;">${fhRemain}%</div>
            ${isMobile ? "" : `<div id="fhcd" style="font-size:8px;color:${textMuted};margin-top:2px;">${cdText(fh.resets_at)}</div>`}
          </div>

          <div style="width:${isMobile ? 14 : 30}px;height:1px;background:${textMuted};opacity:0.3;"></div>

          <div style="text-align:center;">
            ${isMobile ? "" : `<div style="font-size:8px;color:${textMuted};margin-bottom:2px;">7天</div>`}
            <div style="font-size:${isMobile ? 11 : 16}px;font-weight:600;color:${sdColor};line-height:1.05;">${sdRemain}%</div>
            ${isMobile ? "" : `<div id="sdcd" style="font-size:8px;color:${textMuted};margin-top:2px;">${cdText(sd.resets_at)}</div>`}
          </div>
        </div>
      `;
      }

      startCountdown();
    }

    function startCountdown() {
      if (countdownTimer) clearInterval(countdownTimer);
      countdownTimer = setInterval(() => {
        const fhEl = document.getElementById("fhcd");
        const sdEl = document.getElementById("sdcd");
        if (fhEl) fhEl.textContent = cdText(usageData.fiveHour.resets_at);
        if (sdEl) sdEl.textContent = cdText(usageData.sevenDay.resets_at);
      }, 30000);
    }

    async function fetchUsage() {
      if (!orgId) {
        await discoverOrgId();
        if (!orgId) return;
      }
      usageData.fetchError = null;
      const endpoints = [
        `https://claude.ai/api/organizations/${orgId}/usage`,
        `https://claude.ai/api/organizations/${orgId}/rate_limit_status`,
        `https://claude.ai/api/organizations/${orgId}/limits`,
      ];
      for (const url of endpoints) {
        try {
          const res = await _origFetch(url, {
            credentials: "include",
            headers: { Accept: "application/json" },
          });
          if (res.status === 404) continue;
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (parseUsageData(data)) {
            usageData.lastFetch = Date.now();
            renderPanel();
            return;
          }
        } catch (e) {
          console.warn("[Claude用量] 接口失败:", url, e.message);
        }
      }
      usageData.fetchError = "无法获取数据";
      renderPanel();
    }

    function parseUsageData(data) {
      if (!data || typeof data !== "object") return false;
      let hit = false;
      if (data.five_hour) {
        usageData.fiveHour = {
          utilization: data.five_hour.utilization ?? 0,
          resets_at: data.five_hour.resets_at ?? null,
        };
        hit = true;
      }
      if (data.seven_day) {
        usageData.sevenDay = {
          utilization: data.seven_day.utilization ?? 0,
          resets_at: data.seven_day.resets_at ?? null,
        };
        hit = true;
      }
      if (Array.isArray(data.rate_limits)) {
        for (const item of data.rate_limits) {
          const w = String(
            item.window_duration || item.type || "",
          ).toLowerCase();
          const p = item.used_percentage ?? item.utilization ?? 0;
          const r = item.resets_at ?? item.reset_at;
          if (/5h|five.?hour|session/.test(w)) {
            usageData.fiveHour = { utilization: p, resets_at: r };
            hit = true;
          } else if (/7d|seven.?day|week/.test(w)) {
            usageData.sevenDay = { utilization: p, resets_at: r };
            hit = true;
          }
        }
      }
      if (data.subscription_type || data.plan_name || data.plan) {
        usageData.planName =
          data.subscription_type || data.plan_name || data.plan || "";
      }
      return hit;
    }

    function enableDrag() {
      if (!panel) return;

      let startX, startY, startLeft, startTop, pointerMoved;

      panel.addEventListener("pointerdown", (e) => {
        if (e.button !== undefined && e.button !== 0) return;
        isDragging = true;
        pointerMoved = false;
        startX = e.clientX;
        startY = e.clientY;

        // 获取当前位置
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        panel.style.transition = "none";
        panel.style.cursor = "grabbing";
        panel.setPointerCapture?.(e.pointerId);
      });

      document.addEventListener("pointermove", (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
          pointerMoved = true;
          isHovered = false;
        }

        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;

        // 边界限制 - 使用当前布局的收起宽度作为基准
        const collapsedWidth = getPanelMetrics().collapsedWidth;
        const maxLeft = window.innerWidth - collapsedWidth;
        const maxTop = window.innerHeight - panel.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        panel.style.left = newLeft + "px";
        panel.style.top = newTop + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      });

      document.addEventListener("pointerup", (e) => {
        if (isDragging) {
          isDragging = false;
          panel.style.transition = "all 0.2s ease";
          panel.style.cursor = "move";
          panel.releasePointerCapture?.(e.pointerId);

          // 保存实际位置坐标和对齐方式
          const rect = panel.getBoundingClientRect();
          const isRight = rect.left > window.innerWidth / 2;

          if (isRight) {
            // 在右边时保存距右边的距离
            savedPosition.right = window.innerWidth - rect.right;
            savedPosition.left = null;
          } else {
            // 在左边时保存距左边的距离
            savedPosition.left = rect.left;
            savedPosition.right = null;
          }

          savedPosition.top = rect.top;
          savedPosition.isRight = isRight;

          // 保存到 localStorage
          localStorage.setItem(
            "claude-usage-position",
            JSON.stringify({
              left: savedPosition.left,
              right: savedPosition.right,
              top: rect.top,
              isRight: isRight,
            }),
          );

          if (!pointerMoved && e.pointerType !== "mouse") {
            isHovered = !isHovered;
          }

          // 重新渲染以调整展开方向
          renderPanel();
        }
      });

      document.addEventListener("pointercancel", (e) => {
        if (!isDragging) return;
        isDragging = false;
        panel.style.transition = "all 0.2s ease";
        panel.style.cursor = "move";
        panel.releasePointerCapture?.(e.pointerId);
        renderPanel();
      });
    }

    function init(options = {}) {
      if (document.getElementById("claude-usage-panel-bottom")) {
        console.warn("[Claude用量] 小部件已存在");
        return;
      }

      hookFetch();
      panel = createPanel();

      // 支持自定义位置覆盖
      if (options.position) {
        const position = options.position;
        if (position.bottom) panel.style.bottom = position.bottom;
        if (position.left) panel.style.left = position.left;
        if (position.top) panel.style.top = position.top;
        if (position.right) panel.style.right = position.right;
      }

      const initWhenReady = () => {
        if (!document.body) {
          setTimeout(initWhenReady, 100);
          return;
        }

        document.body.appendChild(panel);

        if (isMobileLayout() && !options.position) {
          const mobilePos = getMobileAnchorPosition();
          savedPosition.left = mobilePos.left;
          savedPosition.right = null;
          savedPosition.top = mobilePos.top;
          savedPosition.isRight = false;
          panel.style.left = mobilePos.left + "px";
          panel.style.top = mobilePos.top + "px";
          panel.style.right = "auto";
          panel.style.bottom = "auto";
        }

        // 恢复保存的位置（在添加到DOM后）
        const savedPos = localStorage.getItem("claude-usage-position");
        if (savedPos && !options.position) {
          try {
            const pos = JSON.parse(savedPos);
            let top = parseFloat(pos.top);
            let isRight = pos.isRight !== undefined ? pos.isRight : false;

            // 边界检查和修正
            const maxTop = window.innerHeight - 100;
            if (top > maxTop) top = maxTop;
            if (top < 0) top = 0;

            savedPosition.top = top;
            savedPosition.isRight = isRight;

            if (isRight && pos.right !== null && pos.right !== undefined) {
              // 恢复右对齐位置
              let right = parseFloat(pos.right);
              const maxRight = window.innerWidth - getPanelMetrics().collapsedWidth;
              if (right > maxRight) right = maxRight;
              if (right < 0) right = 0;

              savedPosition.right = right;
              savedPosition.left = null;

              panel.style.right = right + "px";
              panel.style.left = "auto";
            } else if (pos.left !== null && pos.left !== undefined) {
              // 恢复左对齐位置
              let left = parseFloat(pos.left);
              const maxLeft = window.innerWidth - getPanelMetrics().collapsedWidth;
              if (left > maxLeft) left = maxLeft;
              if (left < 0) left = 0;

              savedPosition.left = left;
              savedPosition.right = null;

              panel.style.left = left + "px";
              panel.style.right = "auto";
            }

            panel.style.top = top + "px";
            panel.style.bottom = "auto";
          } catch (e) {
            console.warn("[Claude用量] 恢复位置失败", e);
          }
        }

        renderPanel();
        enableDrag();

        panel.addEventListener("mouseenter", () => {
          if (!isDragging) {
            isHovered = true;
            renderPanel();
          }
        });

        panel.addEventListener("mouseleave", () => {
          if (!isDragging) {
            isHovered = false;
            renderPanel();
          }
        });

        discoverOrgId().then(() => {
          if (orgId) fetchUsage();
        });

        setInterval(() => {
          if (orgId) fetchUsage();
        }, 65000);

        const themeObserver = new MutationObserver(applyTheme);
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["class", "data-theme"],
        });
        window
          .matchMedia("(prefers-color-scheme: dark)")
          .addEventListener("change", applyTheme);

        console.log(
          "%c✅ Claude 用量监控小部件已启动",
          "color:#10b981;font-weight:600;font-size:13px",
        );
      };

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initWhenReady);
      } else {
        initWhenReady();
      }
    }

    function destroy() {
      if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
      if (countdownTimer) clearInterval(countdownTimer);
      if (autoRefreshTimer) clearTimeout(autoRefreshTimer);
      panel = null;
      orgId = null;
      console.log("[Claude用量] 小部件已销毁");
    }

    return {
      init,
      destroy,
      getUsageData: () => usageData,
    };
  })();

  ClaudeUsageWidget.init();

  // Design 页面 DOM 翻译（/design 路径字符串打包在 JS bundle 中，无 i18n fetch 可拦截）
  // Observer 无条件启动以支持 SPA 内导航；路径检查移到回调内部
  function translateAttrs(el) {
    for (const attr of ["title", "placeholder", "aria-label"]) {
      const val = el.getAttribute(attr);
      if (val && DESIGN_TRANSLATIONS[val]) {
        el.setAttribute(attr, DESIGN_TRANSLATIONS[val]);
      }
    }
  }

  function translateNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.nodeValue && node.nodeValue.trim();
      if (t && DESIGN_TRANSLATIONS[t]) {
        node.nodeValue = node.nodeValue.replace(t, DESIGN_TRANSLATIONS[t]);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateAttrs(node);
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.nodeValue && n.nodeValue.trim();
        if (t && DESIGN_TRANSLATIONS[t]) {
          n.nodeValue = n.nodeValue.replace(t, DESIGN_TRANSLATIONS[t]);
        }
      }
      node.querySelectorAll("[title],[placeholder],[aria-label]").forEach(translateAttrs);
    }
  }

  const designObserver = new MutationObserver((mutations) => {
    if (!location.pathname.startsWith("/design")) return;
    for (const m of mutations) {
      if (m.type === "attributes" && m.target.nodeType === Node.ELEMENT_NODE) {
        translateAttrs(m.target);
      } else {
        for (const node of m.addedNodes) {
          translateNode(node);
        }
      }
    }
  });

  function initDesignTranslator() {
    if (location.pathname.startsWith("/design")) {
      translateNode(document.body);
    }
    designObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title", "placeholder", "aria-label"],
    });
  }

  if (document.body) {
    initDesignTranslator();
  } else {
    document.addEventListener("DOMContentLoaded", initDesignTranslator);
  }

  // 通用 DOM 翻译兜底：fetch hook 拦截 i18n 受时序/缓存影响，部分文案会漏。
  // 这里在文本进入 DOM 后再用主词表查一次，不依赖 fetch 时序。
  // /design 路径已由 designObserver 负责，此处跳过避免重复处理。
  const UI_SKIP_TAG = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1 };
  const UI_MAX_LEN = 200; // 覆盖 UI 段落文案（最长约 150+ 字符）；超长对话内容靠精确匹配稀有性自然跳过
  function uiDictLookup(t) {
    if (typeof TRANSLATIONS !== "undefined" && TRANSLATIONS[t]) return TRANSLATIONS[t];
    if (typeof DESIGN_TRANSLATIONS !== "undefined" && DESIGN_TRANSLATIONS[t]) return DESIGN_TRANSLATIONS[t];
    return undefined;
  }
  function uiSkipEl(el) {
    return !el || UI_SKIP_TAG[el.tagName] || el.isContentEditable === true;
  }
  function translateUiAttrs(el) {
    for (const a of ["title", "placeholder", "aria-label"]) {
      const v = el.getAttribute(a);
      const t = v && v.trim();
      if (t && t.length <= UI_MAX_LEN && uiDictLookup(t)) {
        el.setAttribute(a, uiDictLookup(t));
      }
    }
  }
  function translateUiNode(node) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.nodeValue;
      const t = raw && raw.trim();
      if (t && t.length <= UI_MAX_LEN && uiDictLookup(t)) {
        node.nodeValue = raw.replace(t, uiDictLookup(t));
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || uiSkipEl(node)) return;
    translateUiAttrs(node);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (uiSkipEl(p)) return NodeFilter.FILTER_REJECT;
        const raw = n.nodeValue;
        const t = raw && raw.trim();
        if (t && t.length <= UI_MAX_LEN && uiDictLookup(t)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    let n;
    while ((n = walker.nextNode())) {
      const raw = n.nodeValue;
      const t = raw.trim();
      if (uiDictLookup(t)) n.nodeValue = raw.replace(t, uiDictLookup(t));
    }
  }
  const uiObserver = new MutationObserver((mutations) => {
    if (location.pathname.startsWith("/design")) return;
    for (const m of mutations) {
      if (m.type === "attributes") {
        if (m.target.nodeType === Node.ELEMENT_NODE && !uiSkipEl(m.target)) {
          translateUiAttrs(m.target);
        }
      } else {
        for (const node of m.addedNodes) {
          if (
            node.nodeType === Node.TEXT_NODE ||
            (node.nodeType === Node.ELEMENT_NODE && !uiSkipEl(node))
          ) {
            translateUiNode(node);
          }
        }
      }
    }
  });
  function initUiTranslator() {
    if (!location.pathname.startsWith("/design")) {
      translateUiNode(document.body);
    }
    uiObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title", "placeholder", "aria-label"],
    });
  }
  if (document.body) {
    initUiTranslator();
  } else {
    document.addEventListener("DOMContentLoaded", initUiTranslator);
  }

})();
