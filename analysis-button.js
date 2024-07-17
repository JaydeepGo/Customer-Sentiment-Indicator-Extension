let SESSION_ID;
let SF_HOST = "https://orgcs.my.salesforce.com";
let CONNECTION;
let SCORE_ARRAY;
console.log("CSI Session Initiated");

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  // listen for messages sent from background.js
  if (request.message === "URL_CHANGE") {
    clearIndicator().then(
      initIndicator()
    );
  }
});


chrome.runtime.sendMessage(
  { message: "getSession", url: SF_HOST },
  (sfSessionInfo) => {
    if (sfSessionInfo) {
      SESSION_ID = sfSessionInfo.key;
      setConnection();
      initIndicator();
    } else {
      updateButton(null, true, location.href);
      console.log("Session null");
    }
  }
);


async function updateButton(score, isError, analysisURL) {
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
  //indicatorElement.addEventListener("click", this.initIndicator.bind(this)); For JS Profiler Test

  if (isError) {
    indicatorElement.style.backgroundColor = "White";
    let errorImaagePath = chrome.runtime.getURL("images/error.png");
    indicatorElement.style.backgroundImage = "url('" + errorImaagePath + "')";
    indicatorElement.style.backgroundSize = "contain";
    indicatorElement.style.backgroundRepeat = "no-repeat";
    indicatorElement.title =
      "Customer Sentiment Indicator (Something went wrong)";
  } else {
    let indicatorElementLast = document.createElement("div");
    indicatorElementLast.className = "sentiment-btn-last";
    indicatorElementLast.tabIndex = 0;
    indicatorElement.appendChild(indicatorElementLast);
    fillColor(score.averageScore, indicatorElement, "Overall Customer Sentiment");
    fillColor(score.latestScore, indicatorElementLast, "Last Customer Sentiment");

    if (score.escalationInfo && score.escalationInfo.length) {
      let indicatorElementLast = document.createElement("div");
      indicatorElementLast.className = "sentiment-btn-escalation";
      indicatorElementLast.tabIndex = 0;
      indicatorElementLast.style.backgroundColor = "#ff7f00";
      indicatorElementLast.title = "Recent Escalation Detected";
      indicatorElement.appendChild(indicatorElementLast);
    }
  }
}

function fillColor(score, element, titleStringPrefix) {
  // Secret Machine learning code
  if (score == 5) {
    element.style.backgroundColor = "Green";
    element.title = titleStringPrefix + " - Very Satisfied";
  } else if (score > 3) {
    element.style.backgroundColor = "#FFCC00"; //Yellow
    element.title = titleStringPrefix + " - Satisfied";
  } else if (score > 0.01) {
    element.style.backgroundColor = "Red";
    element.title = titleStringPrefix + " - Not at All Satisfied";
  } else {
    element.style.backgroundColor = "Black";
    element.title = titleStringPrefix + " - Not Enough Historical Data";
  }
}

async function clearIndicator() {
  let button = document.getElementById("sentiment-indicator");
  if (button) {
    button.remove();
  }
  SCORE_ARRAY = null;
  clearPopUpScreen();
}

async function initIndicator() {
  let contactId = getCurrentContactId(location.href);
  let caseId = getCurrentCaseId(location.href);
  if (contactId) {
    getSurveyDetails(contactId, location.href);
  } else if (caseId) {
    getCaseContactId(caseId, location.href);
  }
}

function setConnection() {
  CONNECTION = new jsforce.Connection({
    serverUrl: SF_HOST,
    sessionId: SESSION_ID,
    loginUrl: SF_HOST
  });
}

async function getCaseContactId(caseId, analysisURL) {
  try {
    CONNECTION.query(
      "SELECT Id, CaseNumber, Subject, ContactId FROM case WHERE id='" +
      caseId +
      "' LIMIT 1",
      function (err, result) {
        if (err) {
          updateButton(null, true, analysisURL);
          return console.error("CSI Error>>>", err);
        }
        let contactId = result.records[0].ContactId;
        getSurveyDetails(contactId, analysisURL);
      }
    );
  } catch (err) {
    updateButton(null, true, analysisURL);
    console.log("CSI Error>>>", err);
  }
}

async function getSurveyDetails(contactId, analysisURL) {
  let surveyQuery = CONNECTION.query(
    "SELECT Id, Case__c, Case__r.CaseNumber, Customer_Effort_Score__c, Technical_Support_Satisfaction_Score__c, CreatedDate FROM Survey_Results__c WHERE Contact__c='" +
    contactId +
    "' ORDER BY CreatedDate desc LIMIT 5");
  let caseQuery = CONNECTION.query(
    "Select Id, CaseNumber, Management_Escalation_Count__c, Escalation_Comments__c, Age_days__c, CreatedDate from case where ContactId='" +
    contactId +
    "' ORDER BY CreatedDate desc LIMIT 10");
  Promise.all([surveyQuery, caseQuery]).then((values) => {
   // console.log("Data>>>", values);

    let surveyResult = values[0];
    let caseResult = values[1];

   // console.log("Survey result.records>>>", JSON.stringify(surveyResult));
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
    let totalAge = 0;
    let totalEscalations = 0;
    let escalationInfo = [];

    caseResult.records.forEach((element) => {
      totalAge = totalAge + element.Age_days__c;
      if (element.Management_Escalation_Count__c) {
        totalEscalations = totalEscalations + element.Management_Escalation_Count__c
        escalationInfo.push(element);
      }
    });
    let averageAge = totalAge / caseResult.records.length;
   // console.log("Customer Sentiment latest Score>>>", latestScore);
   // console.log("Customer Sentiment Avg Score>>>", averageScore);
    let score = {
      "averageScore": averageScore,
      "latestScore": latestScore,
      "scoreList": surveyResult.records,
      "averageAge": averageAge,
      "totalCases": caseResult.records.length,
      "totalEscalations": totalEscalations,
      "escalationInfo": escalationInfo
    }
    updateButton(score, false, analysisURL);
  })
    .catch((err) => {
      updateButton(null, true, analysisURL);
      console.log("CSI Error>>>", err);
    });
}

async function createPopUpScreen(error) {
  clearPopUpScreen(); // Remove old pop-up table. 
  let popUp = document.createElement("div");
  popUp.id = "sentiment-table-pop-up";

  let tableClose = document.createElement("div");
  tableClose.className = "table-close-btn";
  tableClose.insertAdjacentHTML('beforeend', '<span class="white-border">[X]</span>');

  popUp.appendChild(tableClose);
  tableClose.addEventListener("click", this.clearPopUpScreen.bind(this));

  let tableRoot = document.createElement("div");
  tableRoot.className = 'table-root';
  let customerInfoTableHtml = generateCustomerInfoTable(SCORE_ARRAY, error);
  tableRoot.insertAdjacentHTML('beforeend', customerInfoTableHtml);

  if (!error) {
    tableRoot.insertAdjacentHTML('beforeend', '<br>');
    let surveyTableHtml = generateSurveyTable(SCORE_ARRAY.scoreList);
    tableRoot.insertAdjacentHTML('beforeend', surveyTableHtml);
    tableRoot.insertAdjacentHTML('beforeend', '<br>');
    let escalationTableHtml = generateEscalationTable(SCORE_ARRAY.escalationInfo);
    tableRoot.insertAdjacentHTML('beforeend', escalationTableHtml);
  }
  popUp.appendChild(tableRoot);

  let button = document.getElementById("sentiment-indicator");
  button.appendChild(popUp);
  // These event listeners are only enabled when the popup is active to avoid interfering with Salesforce when not using the inspector
  addEventListener("click", outsidePopupClick);
}

function generateSurveyTable(tableRecordData) {
  let tableData = '';
  const dateOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  if (tableRecordData && tableRecordData.length) {
    tableRecordData.forEach((element) =>
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
  } else {
    tableData = `<tr>
                  <td class="sentiment-table-data" colspan="4" style="text-align: center;"><b>No Data Available for the customer.</b></td>
                </tr>`;
  }

  return `<div class="sentiment-table white-border">
                  <div class="sentiment-table-heading">Survey Info:</div> 
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
}

function generateCustomerInfoTable(tableRecordData, error) {
  let tableData = '';

  if (error) {
    tableData = `<tr>
                  <td class="sentiment-table-data" colspan="3" style="text-align: center;color:red;"><b>Connection Error, Please try again. For more info check console logs.</b></td>
                </tr>`;
  } else if (tableRecordData) {
    let avgCSAT = tableRecordData.averageScore;
    if (!tableRecordData.averageScore) {
      avgCSAT = 0;
    }
    tableData = `<tr>
    <td class="sentiment-table-data" title="Customer Avg CSAT based on last 5 CSAT">${avgCSAT.toFixed(2)}</td>
    <td class="sentiment-table-data" title="Customer Escalation in last 10 cases">${tableRecordData.totalEscalations}/${tableRecordData.totalCases}</td>
    <td class="sentiment-table-data" title="Customer TTR in last 10 cases">${tableRecordData.averageAge.toFixed(2)}</td>
    </tr>`;
  }

  return `<div class="sentiment-table white-border">
                  <div class="sentiment-table-heading" >CSI Summary:</div> 
                  <table class="sentiment-table-data"> 
                    <tr>
                      <th class="sentiment-table-data" title="Customer Avg CSAT based on last 5 CSAT">CSAT</th>
                      <th class="sentiment-table-data" title="Customer Escalations in last 10 cases">Escalation</th>
                      <th class="sentiment-table-data" title="Customer TTR in last 10 cases">TTR</th>
                    </tr>
                    ${tableData}
                  </table>
                  </div> `;
}

function generateEscalationTable(tableRecordData) {
  let tableData = '';

  if (tableRecordData && tableRecordData.length) {
    tableRecordData.forEach((element) =>
      tableData = tableData + `<tr>
    <td class="sentiment-table-data">
    <a href="/${element.Id}" target="_blank">
    ${element.CaseNumber}
    </a></td>
    <td class="sentiment-table-data">${element.Management_Escalation_Count__c}</td>
    </tr>`
    );
  } else {
    tableData = `<tr>
                  <td class="sentiment-table-data" colspan="2" style="text-align: center;"><b>No Escalations in last 10 cases</b></td>
                </tr>`;
  }

  return `<div class="sentiment-table white-border">
                  <div class="sentiment-table-heading">Escalation Info:</div> 
                  <table class="sentiment-table-data"> 
                    <tr>
                      <th class="sentiment-table-data">Case Number</th>
                      <th class="sentiment-table-data">Escalation Count</th>
                    </tr>
                    ${tableData}
                  </table>
                  </div> `;
}

function clearPopUpScreen(event) {
  let tablePopUp = document.getElementById("sentiment-table-pop-up");
  if (tablePopUp) {
    tablePopUp.remove();
    removeEventListener("click", outsidePopupClick);
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

function outsidePopupClick(e) {
  let button = document.getElementById("sentiment-indicator");
  // Close the popup when clicking outside it
  if (button && !button.contains(e.target)) {
    clearPopUpScreen();
  }
}
