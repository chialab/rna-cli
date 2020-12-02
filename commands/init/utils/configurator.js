/**
 * Persist configuration to file doing nasty things.
 *
 * @param {NavigationFile} file The file entry.
 * @param {string} content New content to be persisted.
 * @param {string} delimiter Delimiter.
 * @returns {void}
 */
module.exports = async (file, content, delimiter) => {
    let prevContent = '';
    if (await file.exists()) {
        prevContent = await file.read();
    }
    let splitted = prevContent.split(new RegExp(`\n?${delimiter}\n?`));
    splitted[1] = `${delimiter}\n${content}\n${delimiter}`; // Why arbitrarily at index 1? ~~fquffio
    prevContent = splitted.join('\n');
    await file.write(prevContent.trim());
};
