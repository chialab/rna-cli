Setup a development server with JavaScript and CSS livereload, external tunnel through [localtunnel](https://github.com/localtunnel/localtunnel) and HTTPS support.

For example, you can setup a build step and livereload server for your application development.

In order to correctly use HTTPS you should place a valid SSL `https.pem` and `https.key` in the `~/.config/@chialab/rna-cli/https` folder.

### Options

* `--watch` Enable livereload of JavaScript and CSS files.
* `--port` The web server port to listen (default 3000).
* `--tunnel [subdomain]` Create a tunnel with localtunnel.
* `--directory` Enable directory mode for file system navigation.
* `--https` Should start the server using HTTPS.

### Usage
```sh
# Serve your application.
$ rna serve public/ --port 8080 --tunnel 'the-dark-knight'
server started at http://dev.local:8080 / https://the-dark-knight.serverless.social

# Start a development server with build
$ rna build --watch + serve public/ --watch

# Start a server with HTTPS support
$ rna serve public/ --https
```

### See also

* [`rna build`](../build/)
