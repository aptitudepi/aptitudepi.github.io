import { setMode, setV86InputHandler, getTerm } from './terminal.js';
import { runForeground, isAbortError } from './foreground.js';

let v86Emulator = null;
let v86Ready = false;
let v86Loading = false;

function loadScript(url, runSignal) {
  return new Promise((resolveScript, rejectScript) => {
    if (runSignal?.aborted) {
      rejectScript(new DOMException('VM boot cancelled', 'AbortError'));
      return;
    }
    const scriptNode = document.createElement('script');
    scriptNode.src = url;
    const abortListener = () => {
      scriptNode.remove();
      rejectScript(new DOMException('VM boot cancelled', 'AbortError'));
    };
    runSignal?.addEventListener('abort', abortListener, { once: true });
    scriptNode.onload = () => {
      runSignal?.removeEventListener('abort', abortListener);
      resolveScript(undefined);
    };
    scriptNode.onerror = () => {
      runSignal?.removeEventListener('abort', abortListener);
      rejectScript(new Error(`failed to load ${url}`));
    };
    document.head.appendChild(scriptNode);
  });
}

// Boots the VM inside the foreground runner: resolves false when the VM takes
// over the terminal (runner skips its prompt), true when the shell prompt
// should render (already loading/running, or a failed boot).
async function bootVM(term, runSignal) {
  if (v86Loading) {
    term.writeln('\x1b[38;2;180;180;100mVM is already loading...\x1b[0m');
    return true;
  }
  if (v86Ready && v86Emulator) {
    term.writeln('\x1b[38;2;100;200;100mVM already running.\x1b[0m');
    return true;
  }

  v86Loading = true;
  term.writeln('\x1b[38;2;100;140;200mRun Linux in your browser — loading the emulator (5–15s to boot)...\x1b[0m');
  term.writeln('\x1b[38;2;80;80;90m(Ctrl+C cancels the boot and returns to the shell)\x1b[0m');

  try {
    await loadScript('assets/v86/v86_all.js', runSignal);
    runSignal?.throwIfAborted();
    term.writeln('\x1b[38;2;100;200;100mv86 loaded.\x1b[0m');
    term.writeln('\x1b[38;2;100;140;200mBooting Buildroot Linux...\x1b[0m');
    term.writeln('\x1b[38;2;80;80;90m(This may take 5-15 seconds)\x1b[0m');
    term.writeln('\x1b[38;2;80;80;90m(Type exit + Enter or press Ctrl+Z to return to shell)\x1b[0m');

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
      for (const inputChar of data) {
        v86Emulator.s.send('serial0-input', inputChar.charCodeAt(0));
      }
    });

    setMode('v86');
    v86Ready = true;
    v86Loading = false;
    term.writeln('\r');
    return false;
  } catch (bootError) {
    v86Loading = false;
    if (isAbortError(bootError)) throw bootError;
    term.writeln(`\x1b[38;2;220;80;80mError: ${bootError.message}\x1b[0m`);
    term.writeln(`\x1b[38;2;140;140;155mNext: retry \`vm\`, or reload the page and try again\x1b[0m`);
    return true;
  }
}

function exitVM() {
  if (!v86Emulator) return Promise.resolve(false);
  const term = getTerm();
  if (!term) return Promise.resolve(false);
  return runForeground('exit', term, async () => {
    await v86Emulator.stop();
    term.writeln('\r\n\x1b[38;2;100;200;100mVM stopped.\x1b[0m');
    v86Ready = false;
    v86Emulator = null;
    setV86InputHandler(null);
    setMode('local');
  });
}

window.bootVM = bootVM;
window.exitVM = exitVM;

export { bootVM };
