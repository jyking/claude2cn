// ==UserScript==
// @name         Claude.ai-中文汉化
// @namespace    https://github.com/jyking/claude2cn/
// @homepageURL  https://github.com/jyking/claude2cn/
// @author       jyking
// @version      1.5.4
// @description  Claude.ai-中文汉化 ai翻译 10000行翻译
// @match        https://claude.ai/*
// @grant        none
// @license      MIT
// @run-at       document-start
// @downloadURL  https://update.greasyfork.org/scripts/570390/Claudeai-%E4%B8%AD%E6%96%87%E6%B1%89%E5%8C%96.user.js
// @updateURL    https://update.greasyfork.org/scripts/570390/Claudeai-%E4%B8%AD%E6%96%87%E6%B1%89%E5%8C%96.meta.js
// ==/UserScript==

(function () {
  'use strict';

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;

    if (!url.includes('/i18n/en-US.json') && !url.includes('/i18n/statsig/en-US.json')) {
      return originalFetch(...args);
    }

    const response = await originalFetch(...args);
    const json = await response.json();

    for (const key of Object.keys(json)) {
      const val = json[key];
      if (typeof val === 'string' && TRANSLATIONS[val]) {
        json[key] = TRANSLATIONS[val];
      }
    }

    return new Response(JSON.stringify(json), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };

  const TRANSLATIONS = {};
})();