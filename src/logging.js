const config = require('./config');

const loggingConfig = config.logging || {};

class Logger {
    httpLogger = (req, res, next) => {
      let send = res.send;
      res.send = (resBody) => {
        const logData = {
          authorized: !!req.headers.authorization,
          path: req.originalUrl,
          method: req.method,
          statusCode: res.statusCode,
          reqBody: JSON.stringify(req.body),
          resBody: JSON.stringify(resBody),
        };
        const level = this.statusToLogLevel(res.statusCode);
        this.log(level, 'http', logData);
        res.send = send;
        return res.send(resBody);
      };
      next();
    };

    dbLogger = (sql, params, results) => {
      const logData = {
        query: sql,
        params: JSON.stringify(params),
        results: JSON.stringify(results)
      };
      this.log('info', 'db', logData);
    };

    factoryLogger = (req, res, next) => {
        const send = res.send;
        res.send = (body) => {
          const logData = {
            request: req.body,
            response: body
          };
      
          this.log('info', 'factory', logData);
      
          res.send = send;
          return send.call(res, body); // call the original send function to send the response to the client
        };
        next();
      };

    errorLogger = (error) => {
      const logData = {
        error: error,
      };
      this.log('error', 'error', logData);
    }
  
    log(level, type, logData) {
      const labels = { component: loggingConfig.source, level: level, type: type };
      const values = [this.nowString(), this.sanitize(logData)];
      const logEvent = { streams: [{ stream: labels, values: [values] }] };
  
      this.sendLogToGrafana(logEvent);
    }
  
    statusToLogLevel(statusCode) {
      if (statusCode >= 500) return 'error';
      if (statusCode >= 400) return 'warn';
      return 'info';
    }
  
    nowString() {
      return (Math.floor(Date.now()) * 1000000).toString();
    }
  
    sanitize(logData) {
      logData = JSON.stringify(logData);
      logData = logData.replace(/\\"password\\":\s*\\"[^"]*\\"/g, '\\"password\\": \\"*****\\"');
      logData = logData.replace(/\\"token\\":\s*\\"[^"]*\\"/g, '\\"token\\": \\"*****\\"');
      logData = logData.replace(/\\"apiKey\\":\s*\\"[^"]*\\"/g, '\\"apiKey\\": \\"*****\\"');
      logData = logData.replace(/\\"apiSecret\\":\s*\\"[^"]*\\"/g, '\\"apiSecret\\": \\"*****\\"');
      logData = logData.replace(/\\"apiToken\\":\s*\\"[^"]*\\"/g, '\\"apiToken\\": \\"*****\\"');
      logData = logData.replace(/\\"account_id\\":\s*\\"[^"]*\\"/g, '\\"account_id\\": \\"*****\\"');
      return logData;
    }
  
    sendLogToGrafana(event) {
      if (!loggingConfig.endpoint_url) return;
      const body = JSON.stringify(event);
      fetch(loggingConfig.endpoint_url, {
        method: 'post',
        body: body,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggingConfig.account_id}:${loggingConfig.api_key}`,
        },
      }).then((res) => {
        if (!res.ok) console.log('Failed to send log to Grafana');
      });
    }
  }
  module.exports = new Logger();