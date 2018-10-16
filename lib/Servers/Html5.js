module.exports = (SuperServerClass) => class extends SuperServerClass {
    constructor(options) {
        super(options);

        this.app.use((request, response, next) => {
            let headers = request.headers;

            if (request.method !== 'GET' && request.method !== 'HEAD') {
                return next();
            }

            if (headers.origin) {
                return next();
            }

            if (headers.accept && !headers.accept.includes('text/html')) {
                return next();
            }

            request.originalUrl = request.url = '/';
            this.app.handle(request, response, next);
        });
    }
};
