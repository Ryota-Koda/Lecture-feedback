"use strict";

// The Lambda Function URL is part of the browser-side configuration.
// Change API_URL here only when the backend endpoint changes.
window.APP_CONFIG = Object.freeze({
  API_URL: "https://iwob7ic2gdtpa3nlrzkligg2xa0gmafn.lambda-url.ap-northeast-1.on.aws/",
  MAX_PDF_BYTES: 5 * 1024 * 1024,
  REQUEST_TIMEOUT_MS: 330000
});
