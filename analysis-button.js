let SESSION_ID;
let SF_HOST;
let CONNECTION;
console.log("CSI Session Initiated");

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // listen for messages sent from background.js
  if (request.message === "URL_CHANGE") {
    console.log(request.url);
    initIndicator();
  }
});

chrome.runtime.sendMessage(
  { message: "getSfHost", url: location.href },
  (sfHost) => {
    if (sfHost) {
      chrome.runtime.sendMessage(
        { message: "getSession", sfHost },
        (sfSessionInfo) => {
          if (sfSessionInfo) {
            SF_HOST = "https://" + sfSessionInfo.hostname;
            SESSION_ID = sfSessionInfo.key;
            initIndicator();
          } else {
            updateButton(null, true, location.href);
            console.log("Session null");
          }
        }
      );
    }
  }
);

function updateButton(score, isError, analysisURL) {
  if (location.href != analysisURL) {
    return;
  }
  let indicatorElement;
  let indicatorElementLast;
  let button = document.getElementsByClassName("sentiment-btn-avg");
  if (button && button.length) {
    indicatorElement = button[0];
    indicatorElementLast = document.getElementsByClassName("sentiment-btn-last")[0];
  } else {
    let rootEl = document.createElement("div");
    rootEl.id = "sentiment-indicator";
    indicatorElement = document.createElement("div");
    indicatorElement.className = "sentiment-btn-avg";
    indicatorElement.tabIndex = 0;
    indicatorElementLast = document.createElement("div");
    indicatorElementLast.className = "sentiment-btn-last";
    indicatorElementLast.tabIndex = 0;
    indicatorElement.appendChild(indicatorElementLast);
    rootEl.appendChild(indicatorElement);
    document.body.appendChild(rootEl);
  }
  if (isError) {
    indicatorElement.style.backgroundColor = "White";
    let errorImaagePath = chrome.extension.getURL("images/error.png");
    indicatorElement.style.backgroundImage = "url('" + errorImaagePath + "')";
    indicatorElement.style.backgroundSize = "cover";
    indicatorElement.title =
      "Customer Sentiment Indicator (Something went wrong)";
  } else {
    fillColor(score.averageScore, indicatorElement, "Overall Customer Feedback");
    fillColor(score.latestScore, indicatorElementLast, "Last Customer Feedback");
  }
}

function fillColor(score, element, titleStringPrefix) {
  // Secret Machine learning code
  if (score == 5) {
    element.style.backgroundColor = "Green";
    element.title = titleStringPrefix + " - Happy Customer";
  } else if (score > 2.99) {
    element.style.backgroundColor = "#FFCC00"; //Yellow
    element.title =  titleStringPrefix + " - Unsatisfied Customer";
  } else if (score > 0.99) {
    element.style.backgroundColor = "Red";
    element.title = titleStringPrefix + " - Angry Customer";
  } else {
    element.style.backgroundColor = "Black";
    element.title = titleStringPrefix + " - Not Enough Historical Data";
  }
}

function clearIndicator() {
  let button = document.getElementsByClassName("sentiment-btn-avg");
  if (button && button.length) {
    button[0].remove();
  }
}

function initIndicator() {
  setConnection();
  let contactId = getCurrentContactId(location.href);
  console.log("contact Id>>>", contactId);
  let caseId = getCurrentCaseId(location.href);
  console.log("case ID>>>", caseId);
  if (contactId) {
    getSurveyDetails(contactId, location.href);
  } else if (caseId) {
    getCaseContactId(caseId, location.href);
  } else {
    clearIndicator();
    return null;
  }
}

function setConnection() {
  CONNECTION = new jsforce.Connection({
    serverUrl: SF_HOST,
    sessionId: SESSION_ID,
    loginUrl: SF_HOST
  });
}

function getCaseContactId(caseId, analysisURL) {
  try {
    CONNECTION.query(
      "SELECT Id, CaseNumber, Subject, ContactId  FROM case WHERE id='" +
        caseId +
        "' LIMIT 1",
      function (err, result) {
        if (err) {
          updateButton(null, true, analysisURL);
          return console.error(err);
        }
        console.log("result.records>>>", JSON.stringify(result));
        let contactId = result.records[0].ContactId;
        getSurveyDetails(contactId, analysisURL);
      }
    );
  } catch (err) {
    updateButton(null, true, analysisURL);
    console.log("Error>>>", err);
  }
}

function getSurveyDetails(contactId, analysisURL) {
  try {
    CONNECTION.query(
      "SELECT Id, Customer_Effort_Score__c, Technical_Support_Satisfaction_Score__c FROM Survey_Results__c WHERE Contact__c='" +
        contactId +
        "' ORDER BY CreatedDate desc LIMIT 5",
      function (err, surveyResult) {
        if (err) {
          updateButton(null, true, analysisURL);
          return console.error(err);
        }
        console.log("Survey result.records>>>", JSON.stringify(surveyResult));
        let latestScore;
        if (surveyResult.records && surveyResult.records[0]) {
          latestScore =
            surveyResult.records[0].Technical_Support_Satisfaction_Score__c;
        }
        let averageScore =
          surveyResult.records.reduce(
            (total, next) =>
              total + next.Technical_Support_Satisfaction_Score__c,
            0
          ) / surveyResult.records.length;
        console.log("Customer Sentiment latest Score>>>", latestScore);
        console.log("Customer Sentiment Avg Score>>>", averageScore);
        let score = {
          "averageScore" : averageScore,
          "latestScore" : latestScore
        }

        updateButton(score, false, analysisURL);
      }
    );
  } catch (err) {
    updateButton(null, true, analysisURL);
    console.log("Error>>>", err);
  }
}

function getCurrentContactId(currentURL) {
  let myRegexp = /Contact\/+(\w+)+\/view/gm;
  let ids = myRegexp.exec(currentURL);
  if (ids) {
    return ids[1];
  } else {
    return null;
  }
}

function getCurrentCaseId(currentURL) {
  let myRegexp = /Case\/+(\w+)+\/view/gm;
  let ids = myRegexp.exec(currentURL);
  if (ids) {
    return ids[1];
  } else {
    return null;
  }
}
