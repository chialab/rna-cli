function NullReporter(baseReporterDecorator) {
    baseReporterDecorator(this);

    let self = this;

    self.adapters = [];

    self.write = function() {
        //
    };

    self.writeCommonMsg = function() {
        //
    };

    self.onBrowserLog = function() {
        //
    };

    self.onSpecComplete = function() {
        //
    };
}

NullReporter.$inject = [
    'baseReporterDecorator',
    'config',
];

module.exports = {
    'reporter:null': ['type', NullReporter],
};
