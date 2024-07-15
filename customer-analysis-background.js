// This code is modified version of https://github.com/sorenkrabbe/Chrome-Salesforce-inspector

"use strict";
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.message == "getSession") {
    chrome.cookies.get(
      {
        url: request.url,
        name: "sid",
        storeId: sender.tab.cookieStoreId
      },
      (sessionCookie) => {
        if (!sessionCookie) {
          sendResponse(null);
          return;
        }
        let session = {
          key: sessionCookie.value,
          hostname: sessionCookie.domain
        };
        sendResponse(session);
      }
    );
  }
  return true; // Tell Chrome that we want to call sendResponse asynchronously.
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // read changeInfo data and do something with it (like read the url)
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      message: "URL_CHANGE",
      url: changeInfo.url
    });
  }
});
