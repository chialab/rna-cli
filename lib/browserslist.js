const fs = require('fs-extra');
const path = require('path');
const DEFAULTS = require('../configs/browserslist.json');

module.exports = function(json) {
    if (typeof json === 'string') {
        let jsonPath = path.join(json, 'package.json');
        if (fs.existsSync(jsonPath)) {
            json = require(jsonPath);
        }
    }
    if (json.browserslist) {
        return json.browserslist;
    }
    return DEFAULTS;
};
