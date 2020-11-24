const path = require('path');
const { promises: { writeFile } } = require('fs');
const { createPrinter } = require('typescript');
const { bundle: bundleDts } = require('dts-apigen');

function dts() {
    return {
        name: 'dts',

        async writeBundle(options, bundle) {
            let outputDir = options.dir ? options.dir : path.dirname(options.file);
            for (let output in bundle) {
                if (!output.match(/\.js$/i)) {
                    continue;
                }

                let id = bundle[output].facadeModuleId;
                let out = path.join(outputDir, bundle[output].fileName.replace(/\.js$/i, '.d.ts'));
                let sourceFile = bundleDts(id);
                let dtsCode = createPrinter().printFile(sourceFile);

                await writeFile(out, dtsCode);
            }
        },
    };
}

module.exports = dts;
