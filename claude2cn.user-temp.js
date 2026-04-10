// ==UserScript==
// @name         Claude.ai-中文汉化-用量显示
// @namespace    https://github.com/jyking/claude2cn/
// @homepageURL  https://github.com/jyking/claude2cn/
// @author       jyking
// @version      1.5.7
// @description  Claude.ai-中文汉化 ai翻译 10000行翻译, 剩余用量显示
// @match        https://claude.ai/*
// @grant        none
// @license      MIT
// @run-at       document-start
// @downloadURL  https://update.greasyfork.org/scripts/570390/Claudeai-%E4%B8%AD%E6%96%87%E6%B1%89%E5%8C%96.user.js
// @updateURL    https://update.greasyfork.org/scripts/570390/Claudeai-%E4%B8%AD%E6%96%87%E6%B1%89%E5%8C%96.meta.js
// ==/UserScript==

(function () {
  "use strict";

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
    let savedPosition = { left: null, top: null, isRight: false }; // 保存实际位置和对齐方式

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
        "https://claude.ai/api/auth/me",
        "https://claude.ai/api/organizations",
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
      panel = document.createElement("div");
      panel.id = "claude-usage-panel-bottom";
      Object.assign(panel.style, {
        position: "fixed",
        top: "8px",
        right: "8px",
        zIndex: "1000",
        background: "rgb(254, 252, 245)",
        border: "1px solid rgb(240, 235, 225)",
        borderRadius: "6px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "rgb(80, 75, 65)",
        padding: "8px 10px",
        width: "auto",
        minWidth: "56px",
        userSelect: "none",
        boxShadow: "none",
        cursor: "move",
        transition: "all 0.2s ease",
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

      const textMuted = isDark
        ? "rgba(200, 195, 185, 0.6)"
        : "rgba(80, 75, 65, 0.6)";

      // 判断面板是否靠近右侧
      const rect = panel.getBoundingClientRect();
      const isNearRight = savedPosition.isRight !== null ? savedPosition.isRight : (rect.left > window.innerWidth / 2);

      // 使用保存的位置或当前位置
      const currentLeft = savedPosition.left !== null ? savedPosition.left : rect.left;
      const currentTop = savedPosition.top !== null ? savedPosition.top : rect.top;

      if (isHovered) {
        const expandedWidth = 180;
        const collapsedWidth = 56;

        panel.style.top = currentTop + "px";
        panel.style.bottom = "auto";

        if (isNearRight) {
          // 靠右时向左展开，保持右边缘不变
          // currentLeft 是左边缘，右边缘 = currentLeft + collapsedWidth
          const rightEdge = currentLeft + collapsedWidth;
          const rightPos = window.innerWidth - rightEdge;
          panel.style.right = rightPos + "px";
          panel.style.left = "auto";
        } else {
          // 靠左时向右展开，保持左边缘不变
          panel.style.left = currentLeft + "px";
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
        const collapsedWidth = 56;

        panel.style.top = currentTop + "px";
        panel.style.bottom = "auto";

        if (isNearRight) {
          // 靠右时保持右对齐收起
          // currentLeft 是左边缘，右边缘 = currentLeft + collapsedWidth
          const rightEdge = currentLeft + collapsedWidth;
          const rightPos = window.innerWidth - rightEdge;
          panel.style.right = rightPos + "px";
          panel.style.left = "auto";
        } else {
          // 靠左时保持左对齐收起
          panel.style.left = currentLeft + "px";
          panel.style.right = "auto";
        }

        panel.style.width = collapsedWidth + "px";
        panel.style.minWidth = collapsedWidth + "px";

        panel.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
          <div style="text-align:center;">
            <div style="font-size:8px;color:${textMuted};margin-bottom:2px;">5小时</div>
            <div style="font-size:16px;font-weight:600;color:${fhColor};line-height:1.1;">${fhRemain}%</div>
            <div id="fhcd" style="font-size:8px;color:${textMuted};margin-top:2px;">${cdText(fh.resets_at)}</div>
          </div>

          <div style="width:30px;height:1px;background:${textMuted};opacity:0.3;"></div>

          <div style="text-align:center;">
            <div style="font-size:8px;color:${textMuted};margin-bottom:2px;">7天</div>
            <div style="font-size:16px;font-weight:600;color:${sdColor};line-height:1.1;">${sdRemain}%</div>
            <div id="sdcd" style="font-size:8px;color:${textMuted};margin-top:2px;">${cdText(sd.resets_at)}</div>
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

      let startX, startY, startLeft, startTop;

      panel.addEventListener("mousedown", (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // 获取当前位置
        const rect = panel.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;

        panel.style.transition = "none";
        panel.style.cursor = "grabbing";
      });

      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        let newLeft = startLeft + deltaX;
        let newTop = startTop + deltaY;

        // 边界限制 - 使用收起时的宽度（56px）作为基准
        const collapsedWidth = 56;
        const maxLeft = window.innerWidth - collapsedWidth;
        const maxTop = window.innerHeight - panel.offsetHeight;

        newLeft = Math.max(0, Math.min(newLeft, maxLeft));
        newTop = Math.max(0, Math.min(newTop, maxTop));

        panel.style.left = newLeft + "px";
        panel.style.top = newTop + "px";
        panel.style.right = "auto";
        panel.style.bottom = "auto";
      });

      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          panel.style.transition = "all 0.2s ease";
          panel.style.cursor = "move";

          // 保存实际位置坐标和对齐方式
          const rect = panel.getBoundingClientRect();
          const isRight = rect.left > window.innerWidth / 2;

          // 统一保存为收起状态（56px）时的左边缘位置
          const collapsedWidth = 56;
          let leftPos;

          if (isRight) {
            // 如果在右边，计算收起时的左边缘位置（保持右边缘不变）
            const rightEdge = rect.right;
            leftPos = rightEdge - collapsedWidth;
          } else {
            // 如果在左边，直接使用当前左边缘
            leftPos = rect.left;
          }

          savedPosition.left = leftPos;
          savedPosition.top = rect.top;
          savedPosition.isRight = isRight;

          // 保存到 localStorage
          localStorage.setItem("claude-usage-position", JSON.stringify({
            left: leftPos,
            top: rect.top,
            isRight: isRight
          }));

          // 重新渲染以调整展开方向
          renderPanel();
        }
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

        // 恢复保存的位置（在添加到DOM后）
        const savedPos = localStorage.getItem("claude-usage-position");
        if (savedPos && !options.position) {
          try {
            const pos = JSON.parse(savedPos);
            let left = parseFloat(pos.left);
            let top = parseFloat(pos.top);
            let isRight = pos.isRight !== undefined ? pos.isRight : false;

            // 边界检查和修正
            const maxLeft = window.innerWidth - 56; // 最小宽度
            const maxTop = window.innerHeight - 100; // 最小高度

            if (left > maxLeft) left = maxLeft;
            if (top > maxTop) top = maxTop;
            if (left < 0) left = 0;
            if (top < 0) top = 0;

            // 保存到内存变量
            savedPosition.left = left;
            savedPosition.top = top;
            savedPosition.isRight = isRight;

            panel.style.left = left + "px";
            panel.style.top = top + "px";
            panel.style.right = "auto";
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

  const TRANSLATIONS = {};
})();
