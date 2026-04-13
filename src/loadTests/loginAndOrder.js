const { setTimeout: sleep } = require('timers/promises');

/** Minimal stand-ins for k6 helpers when running under Node */
function check(response, checks) {
  const ok = Object.values(checks).every((fn) => fn(response));
  return ok;
}

function fail(message) {
  throw new Error(message);
}

function group(_name, fn) {
  return fn();
}

async function httpRequest(method, url, body, headers = {}) {
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? body : undefined,
  });
  const text = await res.text();
  return {
    status: res.status,
    body: text,
    json() {
      return JSON.parse(this.body);
    },
  };
}

async function scenario_1() {
  let response;
  const vars = {};

  await group('Login and Order Pizza - https://pizza.jwt-pizza-z.click/', async () => {
    // Load page
    response = await httpRequest('GET', 'https://pizza.jwt-pizza-z.click/', undefined, {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'max-age=0',
      'if-modified-since': 'Sun, 08 Mar 2026 00:39:09 GMT',
      'if-none-match': '"d7030231721ab8d97c3cd264d84b81e8"',
      priority: 'u=0, i',
      'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-user': '?1',
      'upgrade-insecure-requests': '1',
    });
    await sleep(12000);

    // Login
    response = await httpRequest(
      'PUT',
      'https://pizza-service.jwt-pizza-z.click/api/auth',
      '{"email":"z@jwt.com","password":"z"}',
      {
        accept: '*/*',
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        origin: 'https://pizza.jwt-pizza-z.click',
        priority: 'u=1, i',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      }
    );
    vars.authToken = response.json().token;
    console.log(vars.authToken);
    if (!check(response, { 'status equals 200': (r) => r.status.toString() === '200' })) {
      console.log(response.body);
      fail('Login was *not* 200');
    }
    await sleep(12100);

    // View Menu
    response = await httpRequest('GET', 'https://pizza-service.jwt-pizza-z.click/api/order/menu', undefined, {
      Authorization: `Bearer ${vars.authToken}`,
      accept: '*/*',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      origin: 'https://pizza.jwt-pizza-z.click',
      priority: 'u=1, i',
      'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
    });

    const menu = response.json();
    vars.title1 = menu[0].title;
    console.log(vars.title1);

    // View Franchises
    response = await httpRequest(
      'GET',
      'https://pizza-service.jwt-pizza-z.click/api/franchise?page=0&limit=20&name=*',
      undefined,
      {
        accept: '*/*',
        Authorization: `Bearer ${vars.authToken}`,
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        origin: 'https://pizza.jwt-pizza-z.click',
        priority: 'u=1, i',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      }
    );
    await sleep(9500);

    response = await httpRequest('GET', 'https://pizza-service.jwt-pizza-z.click/api/user/me', undefined, {
      Authorization: `Bearer ${vars.authToken}`,
      accept: '*/*',
      'accept-encoding': 'gzip, deflate, br, zstd',
      'accept-language': 'en-US,en;q=0.9',
      'content-type': 'application/json',
      origin: 'https://pizza.jwt-pizza-z.click',
      priority: 'u=1, i',
      'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
    });
    await sleep(3800);

    // Order Pizza
    response = await httpRequest(
      'POST',
      'https://pizza-service.jwt-pizza-z.click/api/order',
      JSON.stringify({
        items: [{ menuId: 1, description: vars.title1, price: 12.99 }],
        storeId: '2',
        franchiseId: 2,
      }),
      {
        accept: '*/*',
        Authorization: `Bearer ${vars.authToken}`,
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        origin: 'https://pizza.jwt-pizza-z.click',
        priority: 'u=1, i',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
      }
    );
    if (!check(response, { 'status equals 200': (r) => r.status.toString() === '200' })) {
      console.log(response.body);
      fail('Order was *not* 200');
    }

    vars.jwt = response.json().jwt;
    await sleep(2200);

    // Verify Pizza
    response = await httpRequest(
      'POST',
      'https://pizza-factory.cs329.click/api/order/verify',
      JSON.stringify({ jwt: vars.jwt }),
      {
        accept: '*/*',
        Authorization: `Bearer ${vars.authToken}`,
        'accept-encoding': 'gzip, deflate, br, zstd',
        'accept-language': 'en-US,en;q=0.9',
        'content-type': 'application/json',
        origin: 'https://pizza.jwt-pizza-z.click',
        priority: 'u=1, i',
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-storage-access': 'active',
      }
    );
  });
}

scenario_1().catch((err) => {
  console.error(err);
  process.exit(1);
});

module.exports = { scenario_1 };
