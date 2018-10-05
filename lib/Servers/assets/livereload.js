/* eslint-disable */

(function(self) {
    if (!self.WebSocket || !window.Promise || !window.URL) {
        return;
    }

    var LOG_PREFIX = 'livereload';
    var CACHE_VERSION = 1;
    var ASSETS_SELECTOR = 'link[href], img[src], video[src], audio[src], source[src], iframe[href], object[data]';
    var CSS_PROPERTIES = ['backgroundImage', 'borderImage', 'webkitBorderImage', 'MozBorderImage'];

    function logFile(message) {
        console.log('%c ' + LOG_PREFIX + ' %c ' + message,
            'background: red; color: white; padding: 2px 0; border-radius: 0.5em;',
            'color: black; background: transparent; padding: 0; border-radius: 0; font-weight: bold;'
        );
    }

    function startSockect() {
        return new Promise(function(resolve, reject) {
            try {
                var protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
                var url = protocol + '//' + location.hostname + ':' + location.port + '/livereload';
                var socket = new WebSocket(url, ['protocolOne', 'protocolTwo']);

                socket.onopen = function() {
                    resolve(socket);
                };

                socket.onerror = function(event) {
                    reject(event);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    function uncache(file) {
        if (!self.caches) {
            return Promise.resolve();
        }
        return self.caches.keys()
            .then(function(keyList) {
                return Promise.all(
                    keyList.map(function(cacheName) {
                        return self.caches.open(cacheName)
                            .then(function(cache) {
                                return cache.delete(file, {
                                    ignoreSearch: true,
                                });
                            });
                    })
                )
            });
    }

    function uniqueUrl(url) {
        if (url.indexOf('?') !== -1) {
            url = url + '&livereload=' + (CACHE_VERSION++);
        } else {
            url = url + '?livereload=' + (CACHE_VERSION++);
        }
        return url;
    }

    function reloadNodeAttr(node, file, attr) {
        var href;
        if (node.originalAttribute) {
            href = node.originalAttribute;
        } else {
            node.originalUrl = node[attr];
            href = node.originalAttribute = node.getAttribute(attr);
        }
        node.setAttribute(attr, uniqueUrl(href));
    }

    function injectJS(file) {
        if (!navigator.serviceWorker) {
            return reload();
        }
        if (!navigator.serviceWorker.controller) {
            return reload();
        }
        if (navigator.serviceWorker.controller.scriptURL !== file) {
            return reload();
        }

        return navigator.serviceWorker.ready()
            .then(function(registration) {
                registration.update();
                logFile('Updated Service Worker: ' + file);
            });
    }

    function injectCSS(styleSheet, file) {
        try {
            var rules = styleSheet.cssRules;
            var base = styleSheet.href || document.baseUri || location.href;
            if (rules) {
                for (var i = 0; i < rules.length; i++) {
                    try {
                        var rule = rules[i];
                        switch (rule.type) {
                            case CSSRule.IMPORT_RULE: {
                                var path;
                                if (rule.originalUrl) {
                                    path = rule.originalUrl;
                                } else {
                                    path = rule.href;
                                }
                                var url = new URL(path, base).href;
                                if (url === file) {
                                    styleSheet.deleteRule(i);
                                    styleSheet.insertRule('@import url("' + uniqueUrl(path) + '");', i);
                                    rules[i].originalUrl = path;
                                } else {
                                    injectCSS(rule.styleSheet, file);
                                }
                                break;
                            }
                            case CSSRule.STYLE_RULE: {
                                CSS_PROPERTIES
                                    .forEach(function(selector) {
                                        var value = rule.style[selector];
                                        if (!value) {
                                            return;
                                        }
                                        var match = value.match(/url\(['"]?([^'")]*)['"]?\)/);
                                        if (!match) {
                                            return;
                                        }
                                        var path;
                                        if (rule.originalUrl) {
                                            path = rule.originalUrl;
                                        } else {
                                            path = rule.originalUrl = match[1];
                                        }
                                        var url = new URL(path, base).href;
                                        if (url === file) {
                                            rule.style[selector] = 'url("' + uniqueUrl(path) + '")';
                                        }
                                    });
                                break;
                            }
                            case CSSRule.MEDIA_RULE: {
                                injectCSS(rule.styleSheet, file);
                                break;
                            }
                        }
                    } catch (error) {}
                }
            }
        } catch (error) {}
    }

    function injectAssets(file) {
        var nodes = [].filter.call(document.querySelectorAll(ASSETS_SELECTOR), function(node) {
            if (node.src) {
                return (node.originalUrl || node.src) === file;
            }
            if (node.href) {
                return (node.originalUrl || node.href) === file;
            }
            if (node.data) {
                return (node.originalUrl || node.data) === file;
            }
        });

        nodes.forEach(function(node) {
            if (node.src) {
                reloadNodeAttr(node, file, 'src');
            } else if (node.href) {
                reloadNodeAttr(node, file, 'href');
            } else if (node.data) {
                reloadNodeAttr(node, file, 'data');
            }
        });

        [].forEach.call(document.styleSheets, function(styleSheet) {
            injectCSS(styleSheet, file);
        });

        logFile('Injected: ' + file);
    }

    function reload() {
        location.reload();
    }

    function livereload(file) {
        var extension = file.split('.').pop().toLowerCase();

        uncache(file)
            .then(function() {
                switch (extension) {
                    case 'js':
                        injectJS(file);
                        break;
                    case 'html':
                        reload();
                        break;
                    default:
                        injectAssets(file);
                        break;
                }
            });
    }

    function run() {
        startSockect()
            .then(function(socket) {
                socket.onmessage = function(event) {
                    try {
                        var data = JSON.parse(event.data);
                        if (data.file) {
                            var file = data.file;
                            if (file[0] !== '/') {
                                file = '/' + file;
                            }
                            livereload(location.origin + file);
                        }
                    } catch (error) { }
                }
            });
    }

    if (document.readyState == 'complete') {
        run();
    } else {
        window.addEventListener('load', function() {
            run();
        });
    }
}(window));
