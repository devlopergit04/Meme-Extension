const vscode = require('vscode');
const path = require('path');

const WINS = ['🎉 It works! Ship it!', '😎 First try. Totally planned.', '🚀 To the moon!', '🏆 Achievement unlocked: Code that runs!', '🥳 No errors?! Screenshot this!', '🐐 You are the GOAT.', '✨ Works on my machine™ — and yours!'];
const FAILS = ['💀 Bruh.', '🎺 Sad trombone noises...', '🔥 This is fine.', '🤡 Have you tried turning it off and on again?', '😭 It compiled in my dreams.'];
const WIN_SOUNDS = ['tada', 'airhorn', 'levelup', 'coin', 'fanfare'];
const FAIL_SOUNDS = ['trombone', 'bruh', 'buzzer'];
const pick = a => a[Math.floor(Math.random() * a.length)];

let panel, ctx, status;

function cfg(k) { return vscode.workspace.getConfiguration('memeExtension').get(k); }

function ensurePanel() {
  if (panel) return panel;
  panel = vscode.window.createWebviewPanel('memeSound', '🎵 Meme Player', { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.file(path.join(ctx.extensionPath, 'media'))] });
  panel.webview.html = html(panel.webview);
  panel.onDidDispose(() => { panel = undefined; });
  return panel;
}

function html(wv) {
  const base = wv.asWebviewUri(vscode.Uri.file(path.join(ctx.extensionPath, 'media', 'sounds'))).toString();
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center">
<h2 id="t">🎵 Meme Player ready</h2><div id="e" style="font-size:80px">😎</div>
<p style="opacity:.6">Keep this tab open (you can move it to the background) so sounds can play.</p>
<script>
const base=${JSON.stringify(base)};
window.addEventListener('message',ev=>{const m=ev.data;
 document.getElementById('t').textContent=m.text;document.getElementById('e').textContent=m.ok?'🎉':'💀';
 const a=new Audio(base+'/'+m.sound+'.wav');a.volume=m.volume;a.play().catch(()=>{});});
</script></body></html>`;
}

function play(ok, manual) {
  if (!cfg('enabled') && !manual) return;
  if (!ok && !cfg('playOnFailure') && !manual) return;
  const text = ok ? pick(WINS) : pick(FAILS);
  const p = ensurePanel();
  setTimeout(() => p.webview.postMessage({ ok, text, sound: ok ? pick(WIN_SOUNDS) : pick(FAIL_SOUNDS), volume: cfg('volume') }), panel.visible ? 0 : 400);
  if (cfg('showMessages')) (ok ? vscode.window.showInformationMessage : vscode.window.showWarningMessage)(text);
}

function activate(context) {
  ctx = context;
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.command = 'memeExtension.toggle';
  const upd = () => { status.text = cfg('enabled') ? '$(unmute) Meme' : '$(mute) Meme'; };
  upd(); status.show();
  context.subscriptions.push(status,
    vscode.commands.registerCommand('memeExtension.playSuccess', () => play(true, true)),
    vscode.commands.registerCommand('memeExtension.playFail', () => play(false, true)),
    vscode.commands.registerCommand('memeExtension.toggle', async () => {
      await vscode.workspace.getConfiguration('memeExtension').update('enabled', !cfg('enabled'), vscode.ConfigurationTarget.Global); upd();
    }),
    vscode.workspace.onDidChangeConfiguration(e => e.affectsConfiguration('memeExtension') && upd()),
    // Debug sessions & tasks
    vscode.tasks.onDidEndTaskProcess(e => typeof e.exitCode === 'number' && play(e.exitCode === 0)),
  );
  // Terminal commands (shell integration)
  if (vscode.window.onDidEndTerminalShellExecution) {
    context.subscriptions.push(vscode.window.onDidEndTerminalShellExecution(e => {
      if (typeof e.exitCode === 'number') play(e.exitCode === 0);
    }));
  }
  // Debug/run (F5 / Ctrl+F5)
  context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('*', {
    createDebugAdapterTracker() {
      let code;
      return {
        onDidSendMessage(m) { if (m.type === 'event' && m.event === 'exited') code = m.body && m.body.exitCode; },
        onExit(c) { const x = typeof code === 'number' ? code : c; if (typeof x === 'number') play(x === 0); }
      };
    }
  }));
}
function deactivate() {}
module.exports = { activate, deactivate };
