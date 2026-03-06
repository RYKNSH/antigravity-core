const { curlRequest } = require('./curl_client');

try {
    const res = curlRequest({
        hostname: 'jsonplaceholder.typicode.com',
        path: '/posts/1',
        method: 'GET'
    });
    console.log("Success:", res.title ? "YES" : "NO");
} catch (e) {
    console.error("Fail:", e);
}
