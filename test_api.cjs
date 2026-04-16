const http = require('http');
const https = require('https');

async function testEndpoint(url) {
    console.log(`\n--- Testing ${url} ---`);
    return new Promise((resolve) => {
        const req = (url.startsWith('https') ? https : http).get(url, { rejectUnauthorized: false }, (res) => {
            console.log(`Status Code: ${res.statusCode}`);
            console.log(`Headers:`, JSON.stringify(res.headers, null, 2));
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Response Body (${data.length} bytes):`);
                console.log(data.substring(0, 500) + (data.length > 500 ? '...' : ''));
                resolve();
            });
        });
        
        req.on('error', (e) => {
            console.error(`Request Error: ${e.message}`);
            resolve();
        });
        
        req.setTimeout(5000, () => {
            console.error('Request Timeout');
            req.destroy();
            resolve();
        });
    });
}

async function main() {
    await testEndpoint('https://tendopos.cloud/api/config');
    await testEndpoint('https://tendopos.cloud/api/productos');
}

main();
