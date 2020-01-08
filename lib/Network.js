const https = require('https');
const http = require('http');
const { URL } = require('url');

function handleOptions(url, options, protocol = 'https') {
    if (typeof url === 'string') {
        const uri = new URL(url);
        options = {
            ...options,
            host: uri.host,
            path: uri.pathname,
        };
    } else {
        protocol = options;
        options = url;
    }

    return { options, protocol };
}

async function get(inputUrl, inputOptions, inputProtocol) {
    const { options, protocol } = handleOptions(inputUrl, inputOptions, inputProtocol);
    return new Promise((resolve, reject) => {
        const adapter = protocol === 'https' ? https : http;
        const request = adapter.request({
            port: protocol === 'https' ? 443 : 80,
            method: 'GET',
            ...options,
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk.toString();
            });
            res.on('end', () => {
                resolve(data);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.end();
    });
}

async function getJSON(inputUrl, inputOptions, inputProtocol) {
    const { options, protocol } = handleOptions(inputUrl, inputOptions, inputProtocol);
    const response = await get({
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    }, protocol);
    return JSON.parse(response);
}

module.exports = {
    get,
    getJSON,
};
