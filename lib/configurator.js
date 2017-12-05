const fs = require('fs');

/**
 * Persist configuration to file doing nasty things.
 *
 * @param {string} source Source file where configuration is persisted.
 * @param {string} content New content to be persisted.
 * @param {string} delimiter Delimiter.
 * @returns {void}
 */
module.exports = (source, content, delimiter) => {
    let prevContent = '';
    if (fs.existsSync(source)) {
        prevContent = fs.readFileSync(source, 'utf8');
    }
    let splitted = prevContent.split(delimiter);
    splitted[1] = `${delimiter}\n${content}\n${delimiter}`; // Why arbitrarily at index 1? ~~fquffio
    prevContent = splitted.join('\n');
    fs.writeFileSync(source, prevContent.trim());
};
