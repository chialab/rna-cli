/**
 * Persist configuration to file doing nasty things.
 *
 * @param {NavigationFile} file The file entry.
 * @param {string} content New content to be persisted.
 * @param {string} delimiter Delimiter.
 * @returns {void}
 */
module.exports = (file, content, delimiter) => {
    let prevContent = '';
    if (file.exists()) {
        prevContent = file.read();
    }
    let splitted = prevContent.split(delimiter);
    splitted[1] = `${delimiter}\n${content}\n${delimiter}`; // Why arbitrarily at index 1? ~~fquffio
    prevContent = splitted.join('\n');
    file.write(prevContent.trim());
};
