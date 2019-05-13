const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const glob = require('glob');
const gzipSize = require('gzip-size');

/**
 * @typedef {Object} FileSize
 * @property {number} size The original size.
 * @property {number} zipped The gzipped size.
 */

/**
 * Prettify byte size.
 *
 * @param {number} size The file size in bytes.
 * @return {string} The size with the correct unit.
 */
function prettyBytes(size) {
    size = Math.abs(size);

    const KILO = 1024;
    const MEGA = KILO ** 2;
    const TERA = KILO ** 3;

    if (size > TERA) {
        return `${(size / TERA).toFixed(1)} TB`;
    } else if (size > MEGA) {
        return `${(size / MEGA).toFixed(1)} MB`;
    } else if (size > KILO) {
        return `${(size / KILO).toFixed(1)} KB`;
    }
    return `${size} B`;
}

/**
 * @class NavigatorEntry
 * A file reference with some utils methods.
 * @property {string} path The file path.
 */
class NavigatorEntry {
    /**
     * Create a NavigatorEntry.
     * @param {string} file The absolute file path.
     * @param {string} cwd The current project cwd for the NavigatorEntry.
     * @return {NavigatorEntry}
     */
    constructor(file, cwd) {
        this.path = file;
        this.cwd = cwd;
    }

    /**
     * The file basename.
     * @type {string}
     */
    get name() {
        return path.basename(this.path);
    }

    /**
     * The file name without extname.
     * @type {string}
     */
    get basename() {
        return path.basename(this.path, this.extname);
    }

    /**
     * The file basename.
     * @type {string}
     */
    get extname() {
        return path.extname(this.path);
    }

    /**
     * The file dirname.
     * @type {string}
     */
    get dirname() {
        return path.dirname(this.path);
    }

    /**
     * The file size.
     * @type {FileSize}
     */
    get size() {
        let sizes = {
            size: new Number(fs.statSync(this.path).size),
            zipped: new Number(gzipSize.fileSync(this.path)),
        };

        function bytesToString() {
            let value = parseInt(Number.prototype.toString.call(this));
            return prettyBytes(value);
        }

        sizes.size.toString = bytesToString;
        sizes.zipped.toString = bytesToString;

        return sizes;
    }

    /**
     * The file local path relative to cwd.
     * @type {string}
     */
    get localPath() {
        if (this.cwd) {
            return path.relative(this.cwd, this.path);
        }
        return this.path;
    }

    /**
     * The parent directory reference.
     * @type {NavigatorDirectory}
     */
    get parent() {
        return new NavigatorDirectory(this.dirname, this.cwd || this.path);
    }

    /**
     * Get a path relative to the file reference.
     * @param {string|NavigatorEntry} file The relative file.
     * @return {string} The relative file path.
     */
    relative(file) {
        if (file instanceof NavigatorEntry) {
            file = file.path;
        }
        return path.relative(this.path, file);
    }

    /**
     * Check if the reference is a file.
     * @return {boolean}
     */
    isFile() {
        return fs.statSync(this.path).isFile();
    }

    /**
     * Check if the reference is a directory.
     * @return {boolean}
     */
    isDirectory() {
        return fs.statSync(this.path).isDirectory();
    }

    /**
     * Check if the reference exists.
     * @return {boolean}
     */
    exists() {
        return fs.existsSync(this.path);
    }

    /**
     * Remove the file if exists.
     * @return {void}
     */
    unlink() {
        if (this.exists()) {
            fs.removeSync(this.path);
        }
    }

    /**
     * Change file extension.
     * @param {string} ext The new extension.
     * @return {void}
     */
    ext(ext) {
        return this.rename(`${this.basename}${ext}`, false);
    }

    /**
     * Rename the file.
     * @param {string} name The new name.
     * @return {void}
     */
    rename(name, move = true) {
        let dest = path.join(this.dirname, name);
        let clone = new this.constructor(dest, this.cwd);
        if (this.exists() && move) {
            this.move(clone);
        }
        return clone;
    }

    /**
     * Copy a file to a new position.
     */
    copy(to) {
        if (to instanceof NavigatorEntry) {
            to = to.path;
        }
        fs.copySync(this.path, to, {
            overwrite: true,
        });
        this.path = to;
    }

    /**
     * Move a file to a new position.
     */
    move(to) {
        if (to instanceof NavigatorEntry) {
            to = to.path;
        }
        fs.moveSync(this.path, to, {
            overwrite: true,
        });
        this.path = to;
    }
}

/**
 * @class NavigatorFile
 * @extends NavigatorEntry
 * A NavigatorEntry which represent a File.
 */
class NavigatorFile extends NavigatorEntry {
    /**
     * The map file reference for the current file.
     * @type {NavigatorFile}
     */
    get mapFile() {
        return new NavigatorFile(`${this.path}.map`, this.cwd || this.path);
    }

    /**
     * The md5 hash of the file.
     * @return {string}
     */
    hash() {
        const BUFFER_SIZE = 8192;
        const fd = fs.openSync(this.path, 'r');
        const hash = crypto.createHash('md5');
        const buffer = Buffer.alloc(BUFFER_SIZE);

        try {
            let bytesRead;
            do {
                bytesRead = fs.readSync(fd, buffer, 0, BUFFER_SIZE);
                hash.update(buffer.slice(0, bytesRead));
            } while (bytesRead === BUFFER_SIZE);
        } finally {
            fs.closeSync(fd);
        }

        return hash.digest('hex');
    }

    /**
     * Read file content.
     * @return {string}
     */
    read() {
        try {
            return fs.readFileSync(this.path, 'utf8');
        } catch (err) {
            return null;
        }
    }

    /**
     * Write file content.
     * @param {string} content The content to write.
     * @return {void}
     */
    write(content) {
        fs.ensureDirSync(path.dirname(this.path));
        fs.writeFileSync(this.path, content);
    }

    /**
     * Read file content as JSON.
     * @return {Object}
     */
    readJson() {
        let data = this.read();
        if (data) {
            data = JSON.parse(data);
        }
        return data;
    }

    /**
     * Write file content as JSON.
     * @param {Object} data The JSON to write.
     * @return {void}
     */
    writeJson(data) {
        this.write(JSON.stringify(data, null, 2));
    }
}

/**
 * @class NavigatorDirectory
 * @extends NavigatorEntry
 * A NavigatorEntry which represent a Directory.
 */
class NavigatorDirectory extends NavigatorEntry {
    /**
     * Ensure the directory to exists.
     * @return {void}
     */
    ensure() {
        fs.ensureDirSync(this.path);
    }

    /**
     * Empty the directory.
     * @return {void}
     */
    empty() {
        fs.emptyDirSync(this.path);
    }

    /**
     * Resolve glob patterns relative to the directory.
     * @param {Array<string>|string} patterns Glob patterns.
     * @return {Array<NavigatorFile|NavigatorDirectory>} A list of resolved entries.
     */
    resolve(patterns) {
        let files = [];
        if (!Array.isArray(patterns)) {
            patterns = [patterns];
        }

        patterns.forEach((pattern) => {
            glob.sync(pattern, {
                cwd: this.path,
                absolute: true,
            }).forEach((file) => {
                if (!files.includes(file)) {
                    files.push(file);
                }
            });
        });

        return files.map((file) => {
            let stats = fs.statSync(file);
            if (stats.isDirectory()) {
                return new NavigatorDirectory(file, this.cwd || this.path);
            } else if (stats.isFile()) {
                return new NavigatorFile(file, this.cwd || this.path);
            }
        }).filter(Boolean);
    }

    /**
     * Get a child entry for the directory.
     * @param {string} file The child reference path.
     * @return {NavigatorEntry}
     */
    entry(file) {
        return new NavigatorEntry(path.resolve(this.path, file), this.cwd || this.path);
    }

    /**
     * Get a child file for the directory.
     * @param {string} file The child file path.
     * @return {NavigatorFile}
     */
    file(file) {
        return new NavigatorFile(path.resolve(this.path, file), this.cwd || this.path);
    }

    /**
     * Get a child directory for the directory.
     * @param {string} directory The child directory path.
     * @return {NavigatorDirectory}
     */
    directory(directory) {
        return new NavigatorDirectory(path.resolve(this.path, directory), this.cwd || this.path);
    }

    /**
     * Get directory children entries list.
     * @return {Array<NavigatorFile|NavigatorDirectory>}
     */
    children() {
        if (!this.exists()) {
            return null;
        }

        let children = fs.readdirSync(this.path);
        return children.map((file) => {
            let entry = this.entry(file);
            if (entry.isDirectory()) {
                return this.directory(file);
            }
            return this.file(file);
        });
    }

    /**
     * Get directory children files list.
     * @return {Array<NavigatorFile>}
     */
    files() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isFile());
    }

    /**
     * Get directory children directories list.
     * @return {Array<NavigatorDirectory>}
     */
    directories() {
        if (!this.exists()) {
            return null;
        }

        return this.children().filter((entry) => entry.isDirectory());
    }
}

module.exports = {
    NavigatorEntry,
    NavigatorFile,
    NavigatorDirectory,
};
