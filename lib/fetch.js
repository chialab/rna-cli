const https = require('https');
const http = require('http');
const { merge } = require('@chialab/proteins');

async function fetchJSON(options, protocol = 'https') {
    const config = merge({
        port: 443,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    }, options);
    return new Promise((resolve, reject) => {
        const request = (protocol === 'https' ? https : http).request(config, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk.toString();
            });
            res.on('end', () => {
                resolve(JSON.parse(data));
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.end();
    });
}

module.exports.fetchJSON = fetchJSON;
