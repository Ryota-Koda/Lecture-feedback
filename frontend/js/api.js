"use strict";

(function initializeApi(global) {
  const config = global.APP_CONFIG || {};

  async function call(payload) {
    if (!config.API_URL) {
      throw new Error("API URLが設定されていません。js/config.jsを確認してください。");
    }

    const controller = new AbortController();
    const timeoutId = global.setTimeout(
      () => controller.abort(),
      config.REQUEST_TIMEOUT_MS || 330000
    );

    let response;
    try {
      response = await fetch(config.API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error("処理がタイムアウトしました。しばらく待ってから再実行してください。");
      }
      throw new Error("APIに接続できませんでした。ネットワークまたはCORS設定を確認してください。");
    } finally {
      global.clearTimeout(timeoutId);
    }

    const text = await response.text();
    let body;

    try {
      body = JSON.parse(text);
    } catch (_error) {
      throw new Error("APIからJSONではない応答が返されました。");
    }

    if (!response.ok) {
      throw new Error(body.error || `APIリクエストに失敗しました（${response.status}）。`);
    }

    return body;
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        const separatorIndex = dataUrl.indexOf(",");
        resolve(separatorIndex >= 0 ? dataUrl.slice(separatorIndex + 1) : dataUrl);
      };

      reader.onerror = () => reject(new Error("PDFファイルを読み込めませんでした。"));
      reader.readAsDataURL(file);
    });
  }

  function setButtonBusy(button, busy, busyLabel) {
    if (!button) {
      return;
    }

    if (busy) {
      button.dataset.originalLabel = button.textContent.trim();
      button.textContent = busyLabel;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      return;
    }

    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }

  function showStatus(element, message, type = "info") {
    if (!element) {
      return;
    }

    element.textContent = message;
    element.className = `status-message status-${type}`;
    element.hidden = false;
  }

  function clearStatus(element) {
    if (!element) {
      return;
    }
    element.hidden = true;
    element.textContent = "";
  }

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }
    return element;
  }

  function choiceLetter(index) {
    return String.fromCharCode(65 + Number(index));
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  global.LectureFeedbackApi = Object.freeze({
    call,
    readFileAsBase64,
    setButtonBusy,
    showStatus,
    clearStatus,
    createElement,
    choiceLetter,
    formatDate,
    config
  });
})(window);
