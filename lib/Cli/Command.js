const fs = require('fs-extra');

/**
 * Command object.
 */
class Command {
    /**
     * Create a Command instance.
     *
     * @param {string} name Command name.
     */
    constructor(name) {
        this.name = name;
        this.options = [];
    }

    /**
     * Setter for callback.
     *
     * @param {function} callback Callback.
     * @returns {this}
     */
    action(callback) {
        this.callback = callback;
        return this;
    }

    /**
     * Setter for description.
     *
     * @param {string} d Description.
     * @returns {this}
     */
    description(d) {
        this.desc = d;
        return this;
    }

    /**
     * Add an option.
     *
     * @param {string} name Option name.
     * @param {string} description Option description.
     * @param {boolean} required Is this option required?
     * @returns {this}
     */
    option(name, description, required = false) {
        this.options.push({
            name,
            description,
            required,
        });
        return this;
    }

    /**
     * Mark a command as deprecated.
     *
     * @param {String} version Since version.
     * @returns {this}
     */
    deprecate(version) {
        this.deprecated = version;
        return this;
    }

    /**
     * Set a README content for command --help.
     * @param {string} file The README file path.
     */
    readme(file) {
        this.helpContent = fs.readFileSync(file, 'utf8');
        return this;
    }
}

module.exports = Command;
