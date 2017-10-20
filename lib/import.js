const fs = require('fs');
const path = require('path');
const rollup = require('rollup');

module.exports = (mod) => {
    mod = fs.realpathSync(mod);
    return rollup.rollup({
        input: mod,
        external: (id) => (id[0] !== '.' && !path.isAbsolute(id)) || id.slice(-5,id.length) === '.json',
    }).then((bundle) =>
        bundle.generate({
            format: 'cjs',
        })
    ).then((res) => {
        const defaultLoader = require.extensions['.js'];
        require.extensions['.js'] = (m, filename) => {
            if (filename === mod) {
                m._compile(res.code, filename);
            } else {
                defaultLoader(m, filename);
            }
        };
        return global.Promise.resolve(require(mod));
    });
};