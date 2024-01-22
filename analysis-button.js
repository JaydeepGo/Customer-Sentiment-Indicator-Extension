let SESSION_ID;
let SF_HOST;
let CONNECTION;
let SCORE_ARRAY;
console.log("CSI Session Initiated");

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // listen for messages sent from background.js
  if (request.message === "URL_CHANGE") {
    console.log(request.url);
    clearIndicator();
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
  SCORE_ARRAY = score;

  let rootEl = document.createElement("div");
  rootEl.id = "sentiment-indicator";
  let indicatorElement = document.createElement("div");
  indicatorElement.className = "sentiment-btn-avg";
  indicatorElement.tabIndex = 0;
  document.body.appendChild(rootEl);
  rootEl.appendChild(indicatorElement);
  indicatorElement.addEventListener("click", this.createPopUpScreen.bind(this, isError));

  if (isError) {
    indicatorElement.style.backgroundColor = "White";
    let errorImaagePath = chrome.runtime.getURL("images/error.png");
    indicatorElement.style.backgroundImage = "url('" + errorImaagePath + "')";
    indicatorElement.style.backgroundSize = "cover";
    indicatorElement.title =
      "Customer Sentiment Indicator (Something went wrong)";
  } else {
    let indicatorElementLast = document.createElement("div");
    indicatorElementLast.className = "sentiment-btn-last";
    indicatorElementLast.tabIndex = 0;
    indicatorElement.appendChild(indicatorElementLast);
    fillColor(score.averageScore, indicatorElement, "Overall Customer Sentiment");
    fillColor(score.latestScore, indicatorElementLast, "Last Customer Sentiment");
  }
}

function fillColor(score, element, titleStringPrefix) {
  // Secret Machine learning code
  if (score == 5) {
    element.style.backgroundColor = "Green";
    element.title = titleStringPrefix + " - Very Satisfied";
  } else if (score > 2.99) {
    element.style.backgroundColor = "#FFCC00"; //Yellow
    element.title = titleStringPrefix + " - Satisfied";
  } else if (score > 0.99) {
    element.style.backgroundColor = "Red";
    element.title = titleStringPrefix + " - Not at All Satisfied";
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
  clearPopUpScreen();
  SCORE_ARRAY = null;
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
      "SELECT Id, Case__c, Case__r.CaseNumber, Customer_Effort_Score__c, Technical_Support_Satisfaction_Score__c, CreatedDate FROM Survey_Results__c WHERE Contact__c='" +
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
          "averageScore": averageScore,
          "latestScore": latestScore,
          "scoreList": surveyResult.records
        }
        updateButton(score, false, analysisURL);
      }
    );
  } catch (err) {
    updateButton(null, true, analysisURL);
    console.log("Error>>>", err);
  }
}

function createPopUpScreen(error) {
  clearPopUpScreen(); // Remove old pop-up table. 
  let tableRoot = document.createElement("div");
  tableRoot.id = "sentiment-table-pop-up";

  let tableClose = document.createElement("div");
  tableClose.className = "table-close-btn";
  tableClose.insertAdjacentHTML('beforeend', '<span class="white-border">[X]</span>');

  tableRoot.appendChild(tableClose);
  tableClose.addEventListener("click", this.clearPopUpScreen.bind(this));

  let tableData = '';
  const dateOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  if (SCORE_ARRAY && SCORE_ARRAY.scoreList && SCORE_ARRAY.scoreList.length) {
    SCORE_ARRAY.scoreList.forEach((element) =>
      tableData = tableData + `<tr>
    <td class="sentiment-table-data">
    <a href="/${element.Id}" target="_blank">
    ${new Date(element.CreatedDate).toLocaleString("en-IN", dateOptions)}
    </a></td>
    <td class="sentiment-table-data">
    <a href="/${element.Case__c}" target="_blank">
    ${element.Case__r.CaseNumber}
    </a></td>
    <td class="sentiment-table-data">${element.Technical_Support_Satisfaction_Score__c}</td>
    <td class="sentiment-table-data">${element.Customer_Effort_Score__c}</td>
    </tr>`
    );
  } else if (error) {
    tableData = `<tr>
                  <td class="sentiment-table-data" colspan="4" style="text-align: center;color:red;"><b>Connection Error.</b></td>
                </tr>`;
  } else {
    tableData = `<tr>
                  <td class="sentiment-table-data" colspan="4" style="text-align: center;"><b>No Data Available for the Contact.</b></td>
                </tr>`;
  }

  let tableHtml = `<div class="sentiment-table white-border">
                  <div class="sentiment-table-heading" >Survey Summary:</div> 
                  <table class="sentiment-table-data"> 
                    <tr>
                      <th class="sentiment-table-data">Date</th>
                      <th class="sentiment-table-data">Case Number</th>
                      <th class="sentiment-table-data">Technical Score</th>
                      <th class="sentiment-table-data">Customer Effort Score</th>
                    </tr>
                    ${tableData}
                  </table>
                  </div> `;
  tableRoot.insertAdjacentHTML('beforeend', tableHtml);
  document.body.appendChild(tableRoot);
}

function clearPopUpScreen(event) {
  let tablePopUp = document.getElementById("sentiment-table-pop-up");
  if (tablePopUp) {
    tablePopUp.remove();
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
