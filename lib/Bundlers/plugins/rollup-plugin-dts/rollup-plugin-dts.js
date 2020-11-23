const path = require('path');
const { promises: { writeFile } } = require('fs');
const { generateDtsBundle } = require('dts-bundle-generator');

function dts({ root = process.cwd() }) {
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
                let [dtsCode] = generateDtsBundle(
                    [{
                        filePath: id,
                        outFile: out,
                        noCheck: true,
                        output: {
                            noBanner: true,
                            followSymlinks: false,
                        },
                    }],
                    {
                        preferredConfigPath: path.join(root, 'tsconfig.json'),
                    }
                );

                await writeFile(out, dtsCode);
            }
        },
    };
}

module.exports = dts;
