const path = require('path');
const child_process = require('child_process');

const vncServerProcess = child_process.spawn(
  path.join(path.dirname(require.resolve('tigervnc')), 'usr', 'bin', 'Xvnc'),
  [ ':2', '-geometry', '320x240', '-depth', '16', '-SecurityTypes', 'None', '-rfbport', '5902' ]
);
vncServerProcess.stdout.pipe(process.stdout);
vncServerProcess.stderr.pipe(process.stderr);

const _startApp = () => {

  const emulatorProcess = child_process.spawn(
    'retroarch',
    [ '-c', path.join(__dirname, 'config', 'retroarch.cfg'), '--verbose', ],
    {
      env: Object.assign({
        DISPLAY: ':2',
      }, process.env),
      cwd: process.cwd(),
    }
  );
  emulatorProcess.stdout.pipe(process.stdout);
  emulatorProcess.stderr.pipe(process.stderr);

  const websockifyProcess = child_process.spawn(
    'node',
    [
      require.resolve('websockify-browser'),
      '--web', path.dirname(require.resolve('novnc-browser')), '8000', 'localhost:5902'
    ]
  );
  websockifyProcess.stdout.pipe(process.stdout);
  websockifyProcess.stderr.pipe(process.stderr);

  process.on('SIGINT', () => {
    emulatorProcess.kill();
    websockifyProcess.kill();
    vncServerProcess.kill();

    process.exit();
  });
}

let b = '';
const _listeningListener = d => {
  b += d.toString('utf8');

  if (/listening/i.test(b)) {
    _startApp();

    vncServerProcess.stderr.removeListener('data', _listeningListener);
  }
};
vncServerProcess.stderr.on('data', _listeningListener);
