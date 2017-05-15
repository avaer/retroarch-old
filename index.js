const path = require('path');
const child_process = require('child_process');

const _makeExitPromise = p => new Promise((accept, reject) => {
  p.on('exit', code => {
    accept(code);
  });
  p.on('error', err => {
    reject(err);
  });
});

const _requestVncServerProcess = () => new Promise((accept, reject) => {
  const vncServerProcess = child_process.spawn(
    path.join(path.dirname(require.resolve('tigervnc')), 'usr', 'bin', 'Xvnc'),
    [ ':2', '-geometry', '320x240', '-depth', '16', '-SecurityTypes', 'None', '-rfbport', '5902' ]
  );
  vncServerProcess.stdout.pipe(process.stdout);
  vncServerProcess.stderr.pipe(process.stderr);

  let b = '';
  const _stderr = s => {
    b += s;

    if (/listening/i.test(b)) {
      vncServerProcess.stderr.removeListener('data', _stderr);

      accept(vncServerProcess);
    }
  };
  vncServerProcess.stderr.setEncoding('utf8');
  vncServerProcess.stderr.on('data', _stderr);

  vncServerProcess.exitPromise = _makeExitPromise(vncServerProcess);
});
const _requestRetroarchProcess = () => new Promise((accept, reject) => {
  const retroarchProcess = child_process.spawn(
    'retroarch',
    [ '-c', path.join(__dirname, 'config', 'retroarch.cfg'), '--verbose', ],
    {
      env: Object.assign({
        DISPLAY: ':2',
      }, process.env),
      cwd: process.cwd(),
    }
  );
  retroarchProcess.stdout.pipe(process.stdout);
  retroarchProcess.stderr.pipe(process.stderr);

  retroarchProcess.exitPromise = _makeExitPromise(retroarchProcess);

  accept(retroarchProcess);
});
const _requestWebsockifyProcess = ({port}) => new Promise((accept, reject) => {
  const websockifyProcess = child_process.spawn(
    'node',
    [
      require.resolve('websockify-browser'),
      '--web', path.dirname(require.resolve('novnc-browser')), String(port), '127.0.0.1:5902'
    ]
  );
  websockifyProcess.stdout.pipe(process.stdout);
  websockifyProcess.stderr.pipe(process.stderr);

  let b = '';
  const _stdout = s => {
    b += s;

    if (/serving/i.test(b)) {
      websockifyProcess.stderr.removeListener('data', _stdout);

      accept(websockifyProcess);
    }
  };
  websockifyProcess.stdout.setEncoding('utf8');
  websockifyProcess.stdout.on('data', _stdout);

  websockifyProcess.exitPromise = _makeExitPromise(websockifyProcess);
});

const _listen = ({port = 8000} = {}) => _requestVncServerProcess()
  .then(vncServerProcess =>
    Promise.all([
      _requestRetroarchProcess(),
      _requestWebsockifyProcess({port}),
    ])
      .then(([
        retroarchProcess,
        websockifyProcess,
      ]) => {
        const _close = () => {
          retroarchProcess.kill();
          websockifyProcess.kill();
          vncServerProcess.kill();

          return Promise.all([
            retroarchProcess.exitPromise,
            websockifyProcess.exitPromise,
            vncServerProcess.exitPromise,
          ]).then(() => {});
        };

        return {
          close: _close,
        };
      })
  );
  
module.exports = {
  listen: _listen,
};

if (require.main === module) {
  _listen();
}
