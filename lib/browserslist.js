const fs = require('fs-extra');
const path = require('path');
const DEFAULTS = require('../configs/browserslist.json');
const browserslist = require('browserslist');

module.exports = {
    load(json) {
        if (json) {
            if (typeof json === 'string') {
                let jsonDir = json;
                while (jsonDir && jsonDir !== '/') {
                    let jsonPath = path.join(jsonDir, 'package.json');
                    if (fs.existsSync(jsonPath)) {
                        json = require(jsonPath);
                        break;
                    }
                    jsonDir = path.dirname(jsonDir);
                }
            }
            if (json.browserslist) {
                return this.elaborate(json.browserslist);
            }
        }
        return this.elaborate(DEFAULTS);
    },

    elaborate(...args) {
        return browserslist(...args);
    },
};
