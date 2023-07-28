# Customer-Sentiment-Indicator-Extension
This extension shows customer sentiment based on recent survey scores.

### UI
The rectangle box on the right side is the indicator.
![image](https://github.com/JaydeepGo/Customer-Sentiment-Indicator-Extension/assets/29326238/e3027def-5124-4034-90ec-bf6ca003004b)


#### This utilises the following objects>
Case > Contact > Survey_Results__c

### UI Mock:
Color Coding Definition:
```
Green:
Score = 5
Highlight Text = "Customer Feedback - Happy Customer"

Tangerine Yellow:
5 > Score > 3
Highlight Text =  "Customer Feedback - Unsatisfied Customer"

Red:
Score < 3
Highlight Text = "Customer Feedback - Angry Customer"

Black:
In case of No Historical Data.
Highlight Text = "Customer Feedback - Not Enough Historical Data"

Exclamation Icon:
In case of error.
```

### Active on below places:
Case Details Page
Contact Details Page.
On other pages, it will be hidden.

### Future Enhancements:
Add the sentiment analysis on recent closed case comments.

### Credits:
- [jsforce](https://jsforce.github.io/) wrapper to connect with SF API.
- [Chrome-Salesforce-inspector](https://github.com/sorenkrabbe/Chrome-Salesforce-inspector) inspiration for base structure.
