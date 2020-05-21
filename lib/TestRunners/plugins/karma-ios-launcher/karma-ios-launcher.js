const { spawnSync, spawn } = require('child_process');

function getSimulators() {
    const data = spawnSync('xcrun', ['simctl', 'list']).stdout.toString();
    const captureName = /^[A-Za-z0-9_ ]+/;
    const captureUUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const foundDevices = data
        .split('\n')
        .filter((line) => line.startsWith('    '))
        .map((line) => line.trim())
        .map((device) => ({
            name: device.match(captureName)[0].trim(),
            uuid: device.match(captureUUID)[0],
            booted: device.endsWith('(Booted)'),
        }));

    return foundDevices;
}

function waitSimulator(timeout = 60 * 1000) {
    let start = Date.now();
    return new Promise((resolve, reject) => {
        let interval = setInterval(() => {
            let tick = Date.now();
            let booted = getSimulators().find((device) => device.booted);
            if (booted) {
                resolve(booted);
                clearInterval(interval);
            } else if (tick - start > timeout) {
                reject('Timeout');
                clearInterval(interval);
            }
        }, 1000);
    });
}

function IOS(baseBrowserDecorator) {
    baseBrowserDecorator(this);

    let simulator, child;
    this._start = async function(url) {
        simulator = getSimulators().find((device) => device.booted);
        if (!simulator) {
            child = spawn('/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app/Contents/MacOS/Simulator', {
                detached: true,
            });
        }
        simulator = await waitSimulator();
        spawnSync('xcrun', ['simctl', 'openurl', 'booted', url]);
    };

    function kill() {
        if (child) {
            child.stdin.pause();
            child.kill();
            process.kill(child.pid, 'SIGKILL');
            child = null;
            if (simulator) {
                spawnSync('xcrun', ['simctl', 'shutdown', simulator.uuid]);
                simulator = null;
            }
        }
    }

    this._onProcessExit = kill;

    this.kill = async function() {
        this.state = this.STATE_BEING_KILLED;
        kill();
        this.state = this.STATE_FINISHED;
    };

    this.forceKill = async function() {
        kill();
        this.state = this.STATE_BEING_FORCE_KILLED;
    };

    process.on('exit', () => kill());
}

IOS.prototype = {
    name: 'iOS',
};

IOS.$inject = ['baseBrowserDecorator'];

module.exports = {
    'launcher:iOS': ['type', IOS],
};
