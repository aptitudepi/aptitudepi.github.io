import { setMode, setV86InputHandler, getTerm } from './terminal.js';
import { writePrompt } from './shell.js';

let v86Emulator = null;
let v86Ready = false;
let v86Loading = false;

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function bootVM(term) {
  if (v86Loading) {
    term.writeln('\x1b[38;2;180;180;100mVM is already loading...\x1b[0m');
    return;
  }
  if (v86Ready && v86Emulator) {
    term.writeln('\x1b[38;2;100;200;100mVM already running.\x1b[0m');
    return;
  }

  v86Loading = true;
  term.writeln('\x1b[38;2;100;140;200mLoading v86 emulator...\x1b[0m');

  try {
    await loadScript('assets/v86/v86_all.js');
    term.writeln('\x1b[38;2;100;200;100mv86 loaded.\x1b[0m');
    term.writeln('\x1b[38;2;100;140;200mBooting Buildroot Linux...\x1b[0m');
    term.writeln('\x1b[38;2;80;80;90m(This may take 5-15 seconds)\x1b[0m');
    term.writeln('\x1b[38;2;80;80;90m(Type exit + Enter or press Ctrl+Z to return to shell)\x1b[0m');

    const container = document.getElementById('terminal-container');

    v86Emulator = new V86({
      Mj: 'assets/v86/v86.wasm',
      K: 64 * 1024 * 1024,
      La: 2 * 1024 * 1024,
      ak: true,
      gd: {
        type: 'ne2k',
        nd: 'fetch',
        // Replace with your Cloudflare Worker URL after deploying
        Hd: 'https://0.supernovadkb.workers.dev/?url=',
      },
      filesystem: {
        bk: 'assets/v86/9p-rootfs/out/fs.json',
        Fg: 'assets/v86/9p-rootfs/out/',
      },
      Rb: { url: 'assets/v86/seabios.bin' },
      ye: { url: 'assets/v86/vgabios.bin' },
      hc: { url: 'assets/v86/buildroot-bzimage.bin' },
    });

    v86Emulator.s.register('serial0-output-byte', function(byte) {
      term.write(String.fromCharCode(byte));
    });

    setV86InputHandler(function(data) {
      if (!v86Emulator) return;
      for (const ch of data) {
        v86Emulator.s.send('serial0-input', ch.charCodeAt(0));
      }
    });

    setMode('v86');
    v86Ready = true;
    v86Loading = false;
    term.writeln('\r');
  } catch (err) {
    term.writeln(`\x1b[38;2;220;80;80mError: ${err.message}\x1b[0m`);
    v86Loading = false;
  }
}

function exitVM() {
  if (!v86Emulator) return;
  const term = getTerm();
  if (!term) return;
  v86Emulator.stop().then(() => {
    term.writeln('\r\n\x1b[38;2;100;200;100mVM stopped.\x1b[0m');
    v86Ready = false;
    v86Emulator = null;
    setV86InputHandler(null);
    setMode('local');
    writePrompt(term);
  });
}

window.bootVM = bootVM;
window.exitVM = exitVM;

export { bootVM };
