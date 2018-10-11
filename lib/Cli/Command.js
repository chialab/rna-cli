/**
 * Command object.
 */
class Command {
    /**
     * Create a Command instance.
     *
     * @param {CLI} scope Command scope (the CLI it will be run from).
     * @param {string} name Command name.
     */
    constructor(scope, name) {
        this.scope = scope;
        this.name = name;
        this.options = [];
        this.help('');
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
     * Setter for help text.
     *
     * @param {function|string} callback Help text, or callable that will take care of writing help text.
     * @returns {this}
     */
    help(callback) {
        if (typeof callback === 'string') {
            // Wrap help text in a callable.
            let str = callback;
            callback = () => {
                this.scope.logger.newline();
                this.scope.exec('help', { // Show only relevant portion of help.
                    lite: true,
                    commands: [this.name],
                });
                if (str) {
                    this.scope.logger.log(str);
                    this.scope.logger.newline();
                }
            };
        }
        this.h = callback;
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
}

module.exports = Command;
