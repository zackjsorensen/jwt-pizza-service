# Incident Report

## Summary ##
At 1:14 PM on Tuesday, April 7, 2026, an implanted chaotic element of the jwt-pizza-service code was activated. For about 2 minutes, users were unable to recieve pizzas, as orders returned with a 500 request and no pizza.
A bug in the code caused incoming pizza order requests to be returned with 500 rather than being correctly handled. The event was detected by Zack Sorensen of the JWT Pizza DevOps team, who was already online investigating a false alarm. 



## Detection
The incident was detected by the JWT Pizza DevOps team. Zack received an alert via text prior to the event that unknown endpoints were being repeatedly triggered on the service. He examined the metrics and determined that the culprit was simply a web scraper that wouldn't do any harm. 
However, as he continued examining the metrics, he noticed a sudden halt in revenue despite continue orders. He noticed that all orders were receiving a 500 response.

## Impact 
For about 2 minutes (from 1:14 PM to 1:16 PM on April 7, 2026), customers were unable to recieve the pizza they ordered. Based on the logs during the event, we can determine that this impacted 17 customers. No complaints have been submitted. 

## Timeline
All times are in UTC
- 12:58 - Zack received an SMS message alerting him of suspicisous activity due to UNKNOWN ENDPOINTS
- 13:00 - Zack accessed the Grafana dashboard to examine the metrics and logs
- 13:05 - Zack determines the alert is a false alarm, but continues examining the logs
- 13:14 - Zack identifies a sudden halt to profit via metrics despite continued pizza orders
- 13:15 - Zack identifies the link to end chaos embedded in the 500 response returned to all orders. He follows it and disables the chaos.
- 13:16 - Zack confirms that orders are now being serviced and profit is climbing.

## Response
After observing a loss of profit at 13:14, Zack examined the logs of JWT Pizza Service. He found the disable chaos link in the error logs.

## Root Cause
A dormant bug in the code that intercepts incoming pizza orders and returns a 500 response was activated when the global condition chaos was set to true.

## Resolution
Zack resolved the issue by following the "disable chaos" link in the error logs, causing the chaos condition to be set to false and the service's functionality to return to normal

## Prevention
This bug is not related to any known past incidents

## Action Items
- The JWT Pizza DevOps team will examine the source code to remove the chaotic component and replace it with standard functionality as needed, branching and tracking all changes in GitHub.
- Zack will reinforce the alerts in Grafana so that the JWT Pizza DevOps team receives an alert any time profit remains zero for 5 minutes while pizza orders continue to come in.
- Zack will raise the threshold for "Unknown Endpoint" alerts so that false alarms will not be triggered beyond reason in the future. 

