// ==UserScript==
// @name         Claude 中文汉化 用量显示 Claude.ai
// @namespace    https://github.com/jyking/claude2cn/
// @homepageURL  https://github.com/jyking/claude2cn/
// @author       jyking
// @version      1.6.4
// @description  Claude 中文汉化 ai翻译 10000行翻译, 剩余用量显示
// @icon         https://assets-proxy.anthropic.com/claude-ai/v2/assets/v1/cd02a42d9-Vq_H3mgS.svg
// @match        https://claude.ai/*
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
  document.head.appendChild(style);

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0].url;

    if (
      !url.includes("/i18n/en-US.json") &&
      !url.includes("/i18n/statsig/en-US.json")
    ) {
      return originalFetch(...args);
    }

    const response = await originalFetch(...args);
    const json = await response.json();

    for (const key of Object.keys(json)) {
      const val = json[key];
      if (typeof val === "string" && TRANSLATIONS[val]) {
        json[key] = TRANSLATIONS[val];
      }
    }

    return new Response(JSON.stringify(json), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };

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
  const DESIGN_TRANSLATIONS = {};

  if (location.pathname.startsWith("/design")) {
    function translateNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.nodeValue && node.nodeValue.trim();
        if (t && DESIGN_TRANSLATIONS[t]) {
          node.nodeValue = node.nodeValue.replace(t, DESIGN_TRANSLATIONS[t]);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          const t = n.nodeValue && n.nodeValue.trim();
          if (t && DESIGN_TRANSLATIONS[t]) {
            n.nodeValue = n.nodeValue.replace(t, DESIGN_TRANSLATIONS[t]);
          }
        }
      }
    }

    const designObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          translateNode(node);
        }
      }
    });

    function initDesignTranslator() {
      translateNode(document.body);
      designObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (document.body) {
      initDesignTranslator();
    } else {
      document.addEventListener("DOMContentLoaded", initDesignTranslator);
    }
  }

  const TRANSLATIONS = {};
})();
