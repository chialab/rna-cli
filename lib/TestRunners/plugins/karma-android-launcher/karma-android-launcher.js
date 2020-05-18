const path = require('path');
const { spawnSync, spawn } = require('child_process');

function getAvds(home) {
    const proc = spawnSync(path.resolve(home, 'tools/bin/avdmanager'), ['list']);
    const text = proc.stdout.toString().split('Android Virtual Devices:')[1].split('The following Android Virtual Devices could not be loaded:')[0];
    return text.trim().split(/\n-+\n/)
        .map((entry) => {
            const lines = entry.split('\n').map((line) => line.trim().split(': '));
            const data = {};
            lines.forEach(([key, value]) => data[key] = value);
            return data;
        });
}

function isEmulatorReady(home) {
    const proc = spawnSync(path.resolve(home, 'platform-tools/adb'), ['shell', 'getprop', 'dev.bootcomplete']);
    const output = proc.stdout.toString().trim();
    return output === '1';
}

function waitEmulator(home, timeout = 30 * 1000) {
    let start = Date.now();
    return new Promise((resolve, reject) => {
        let interval = setInterval(() => {
            let tick = Date.now();
            if (isEmulatorReady(home)) {
                resolve();
                clearInterval(interval);
            } else if (tick - start > timeout) {
                reject('Timeout');
                clearInterval(interval);
            }
        }, 1000);
    });
}

function Android(baseBrowserDecorator, args, config) {
    baseBrowserDecorator(this);

    this.name = 'Android';

    let child;

    this._start = async (url) => {
        try {
            url = url.replace('localhost', '10.0.2.2');

            const home = config.ANDROID_HOME || process.env.ANDROID_HOME;
            const avd = config.avd || process.env.ANDROID_EMULATOR_NAME || getAvds(home)[0].Name;
            child = spawn(path.resolve(home, 'tools/emulator'), ['-avd', avd, '-no-snapshot'], {
                detached: true,
            });

            await waitEmulator(home);

            spawnSync(path.resolve(home, 'platform-tools/adb'), [
                'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url,
            ]);

        } catch (err) {
            // eslint-disable-next-line
            console.error(err);
            return this._done('failure');
        }
        this._done();
    };

    function kill() {
        if (child) {
            child.stdin.pause();
            child.kill();
            process.kill(child.pid, 'SIGKILL');
            child = null;
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

Android.prototype = {
    name: 'Android',
};

Android.$inject = ['baseBrowserDecorator', 'args', 'config', 'logger'];

module.exports = {
    'launcher:Android': ['type', Android],
};
