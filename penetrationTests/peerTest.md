# Penetration Testing Report

Zack Sorensen and Alex Evans

## Self-Attack

### Zack

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Brute Force |
| Severity | 0 |
| Description | Log into admin, guess passwords, try likely passwords |
| Images |  |
| Corrections | I don't have an easy admin password, but it would be good to add rate limit to auth attempts |

 

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Authentication Failure |
| Severity | 2 |
| Description | Log into a user with no password |
| Images |     ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/z1.png) ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/z2.png) |
| Corrections | Add check to make sure password is not empty/null |

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Insecure Design |
| Severity | 3 |
| Description | Send modified price to cause loss of revenue |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/z3.png) |
| Corrections | Use prices from the database and not from request body |

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Broken Access Control |
| Severity | 2 |
| Description | Delete franchises without authorization via endpoint |
| Images |   ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/z4.png) |
| Corrections | Add authorization to the delete franchise endpoint |

 

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Injection |
| Severity | 2 |
| Description | Corrupt user data via malicious username update (set all emails to a junk email) |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/z5.png) Data corrupted in database  ^^ |
| Correctis | Sanitize SQL inputs |

### Alex

| Item | Result |
| :---- | :---- |
| Date | April 9, 2026 |
| Target | pizza.alexevans.click |
| Classification | Injection |
| Severity | 0 |
| Description | SQL injection through updating a user, to try and delete the database. Failed. |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a1.png) |
| Corrections | Still, it would be good to go and sanitize my user inputs. |

| Item | Result |
| :---- | :---- |
| Date | April 9, 2026 |
| Target | pizza.alexevans.click |
| Classification | Broken Access Control |
| Severity | 0 |
| Description | Attempted to change the name of a different user or role of self when you send it to the backend via the `PUT /api/user/:userId` endpoint. Failed. |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a2.png) |
| Corrections | None needed. Endpoint already verifies authorization |

| Item | Result |
| :---- | :---- |
| Date | April 13, 2026 |
| Target | pizza.alexevans.click |
| Classification | Broken Access Control |
| Severity | 1 |
| Description | Any other user can successfully delete another user via the `DELETE /api/user/:id` endpoint. |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a3.png) |
| Corrections | Add authorization check for deletion of users. |

| Item | Result |
| :---- | :---- |
| Date | April 13, 2026 |
| Target | pizza.alexevans.click |
| Classification | Identification and Authentication Failures |
| Severity | 2 |
| Description | Brute force of passwords to log into a user account. Succeeded with a blank password |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a4.png) |
| Corrections | Prevent login with no password in the payload. |

| Item | Result |
| :---- | :---- |
| Date | April 13, 2026 |
| Target | pizza.alexevans.click |
| Classification | Broken Access Control |
| Severity | 2 |
| Description | Access the list of all users without admin authentication. Successful\! |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a5.png) |
| Corrections | Require admin authorization for viewing list of users. |

## Peer Attacks

### Zack attacking Alex 

 

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target |  pizza.alexevans.click |
| Classification |  Broken Access Control |
| Severity | 0 |
| Description | Log into admin with no password |
| Images |   |
| Corrections | not needed |

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target |  pizza.alexevans.click |
| Classification | Brute Force (Identification and Authentication Failures) |
| Severity | 0 |
| Description | Brute force email and password for admin user with Intruder tool |
| Images |   |
| Corrections |  Not needed |

   
 

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target |  pizza.alexevans.click |
| Classification |  Insecure Design |
| Severity | 0 |
| Description | Send negative pizza price in order request |
| Images |   |
| Corrections |  Not needed |

   
 

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target |  pizza.alexevans.click |
| Classification |  Broken Access Control |
| Severity | 0 |
| Description | Delete franchise via endpoint without authorization |
| Images |   |
| Corrections |  Not needed |

   
 

| Item | Result |
| :---- | :---- |
| Date | 4/13/2026 |
| Target |  pizza.alexevans.click |
| Classification | SQL Injection Attack |
| Severity | 2 |
| Description | Replace all user emails with a junk email |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/z_attack_1.png)  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/z_attack_2.png) |
| Corrections | Sanitize SQL inputs, restore database with a backup |

### Alex attacking Zack

| Item | Result |
| ----- | ----- |
| Date | April 13, 2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Identification and Authentication Failures |
| Severity | 0 |
| Description | Brute force passwords to log into admin account. Failed, because I got hit by the rate limit for authentication attempts. |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a_attack_1.png) ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a_attack_2.png)|
| Corrections | Not needed |

| Item | Result |
| ----- | ----- |
| Date | April 13, 2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Broken Access Control |
| Severity | 0 |
| Description | Delete an account as a non-admin user. Would have succeeded, but the endpoint was not implemented. |
| Images |  ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a_attack_3.png) |
| Corrections | Implement the delete user endpoint. |

| Item | Result |
| ----- | ----- |
| Date | April 13, 2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Insecure Design |
| Severity | 0 |
| Description | Order a custom pizza by changing the description, but not the price. Failed attempt. |
| Images | ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a_attack_4.png)|
| Corrections | Not needed |

| Item | Result |
| ----- | ----- |
| Date | April 13, 2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Broken Access Control |
| Severity | 2 |
| Description | As a non-admin user, get a list of all users. Would have succeeded with more time, but got this nice error stack. |
| Images | ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a_attack_5.png) |
| Corrections | Remove the error stack, secure user list endpoint. |

| Item | Result |
| ----- | ----- |
| Date | April 13, 2026 |
| Target | pizza.jwt-pizza-z.click |
| Classification | Software Logging and Monitoring Failures, Insecure Design |
| Severity | 2 |
| Description | Repeatedly send an order that is too big. The result was a really large latency on the dashboard that was not accurate (lots of requests starting but not finishing). This would be a good way to hide a different attack\! |
| Images | ![](https://github.com/zackjsorensen/jwt-pizza-service/blob/main/penetrationTests/PenTest/a_attack_6.png) |
| Corrections | Rate limiting for ordering pizza. |

 

## What we learned

* Having another person attacking your system is a good way to find vulnerabilities you didn’t know about.  
* Hacker tip: one minor attack could be the disguise for a bigger attack\!  
* It is important to protect your system so that valuable user information doesn’t get leaked. It was fun to try to protect it here, but imagine doing it full-scale on a real app.  
* Things that seem like minor oversights can be treasure troves for hackers (i.e. accidentally sending your stack trace as an error message\!)  
* Even though you probably can’t completely prevent all types of attacks, you can make it expensive and slow, both to deter attackers and give yourself time to detect and respond.
