const fs = require('fs');
const path = require('path');
const rollup = require('rollup');

/**
 * Import a module into project.
 *
 * The imported module will be digested by rollup to ensured it is compiled.
 *
 * @param {string} mod Module name.
 * @returns {Promise}
 */
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
                // Project file: just compile it.
                m._compile(res.code, filename);
            } else {
                // External module: fallback to default loader.
                defaultLoader(m, filename);
            }
        };
        return global.Promise.resolve(require(mod));
    });
};
