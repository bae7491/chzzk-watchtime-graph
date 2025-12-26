const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
    app.use(
        '/service',
        createProxyMiddleware({
            target: 'https://api.chzzk.naver.com',
            changeOrigin: true,
            secure: true,
            logLevel: 'debug',
        })
    );
};