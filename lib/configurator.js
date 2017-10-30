const fs = require('fs');

module.exports = (source, content, delimiter) => {
    let prevContent = '';
    if (fs.existsSync(source)) {
        prevContent = fs.readFileSync(source, 'utf8');
    }
    let splitted = prevContent.split(delimiter);
    splitted[1] = `${delimiter}\n${content}\n${delimiter}`;
    prevContent = splitted.join('\n');
    fs.writeFileSync(source, prevContent);
};