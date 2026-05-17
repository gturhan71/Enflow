const { spawn, execSync } = require('child_process');
const os = require('os');
const path = require('path');

const FRONTEND_PORT = 3000;
const BACKEND_PORT = 3002;

// ANSI Terminal Colors
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

console.log(`${MAGENTA}[System] Starting Enflow cross-platform runner...${RESET}`);

// Kill existing processes on target ports to allow robust "restart"
killPort(FRONTEND_PORT);
killPort(BACKEND_PORT);

function killPort(port) {
  try {
    if (os.platform() === 'win32') {
      const output = execSync(`netstat -ano | findstr LISTENING | findstr :${port}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const lines = output.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const pid = parts[parts.length - 1];
          if (pid && pid !== '0' && !isNaN(pid)) {
            console.log(`${MAGENTA}[System] Port ${port} is occupied. Killing process ${pid}...${RESET}`);
            try {
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            } catch (e) {}
          }
        }
      }
    } else {
      try {
        const pids = execSync(`lsof -t -i:${port}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim().split('\n');
        for (const pid of pids) {
          if (pid && !isNaN(pid)) {
            console.log(`${MAGENTA}[System] Port ${port} is occupied. Killing process ${pid}...${RESET}`);
            try {
              execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            } catch (e) {}
          }
        }
      } catch (e) {}
    }
  } catch (err) {}
}

// Helper to spawn process
function startProcess(name, cmd, args, cwd, color) {
  console.log(`${color}[${name}] Spawning: ${cmd} ${args.join(' ')}${RESET}`);
  
  const isWin = os.platform() === 'win32';
  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    detached: !isWin, // Detach on Unix to allow killing process tree
    env: { ...process.env, FORCE_COLOR: 'true' }
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\r\n');
    lines.forEach(rawLine => {
      rawLine.split('\n').forEach(line => {
        if (line.trim()) {
          console.log(`${color}[${name}]${RESET} ${line}`);
        }
      });
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\r\n');
    lines.forEach(rawLine => {
      rawLine.split('\n').forEach(line => {
        if (line.trim()) {
          console.error(`${RED}[${name} Error]${RESET} ${line}`);
        }
      });
    });
  });

  proc.on('close', (code) => {
    console.log(`${color}[${name}] Process exited with code ${code}${RESET}`);
  });

  return proc;
}

// Start both Frontend and Backend
const backendDir = path.join(__dirname, 'backend');
const restarterProc = startProcess('Restarter', 'node', ['restarter.cjs'], __dirname, MAGENTA);
const backendProc = startProcess('Backend', 'pnpm', ['run', 'dev'], backendDir, CYAN);
const frontendProc = startProcess('Frontend', 'pnpm', ['run', 'dev'], __dirname, GREEN);

// Clean exit on Ctrl+C
function shutdown() {
  console.log(`\n${MAGENTA}[System] Shutting down Enflow processes...${RESET}`);
  
  if (os.platform() === 'win32') {
    // Windows process tree kill
    try {
      if (restarterProc.pid) execSync(`taskkill /F /T /PID ${restarterProc.pid}`, { stdio: 'ignore' });
    } catch (e) {}
    try {
      if (backendProc.pid) execSync(`taskkill /F /T /PID ${backendProc.pid}`, { stdio: 'ignore' });
    } catch (e) {}
    try {
      if (frontendProc.pid) execSync(`taskkill /F /T /PID ${frontendProc.pid}`, { stdio: 'ignore' });
    } catch (e) {}
  } else {
    // Unix process group kill
    try {
      if (restarterProc.pid) process.kill(-restarterProc.pid, 'SIGKILL');
    } catch (e) {}
    try {
      if (backendProc.pid) process.kill(-backendProc.pid, 'SIGKILL');
    } catch (e) {
      try { if (backendProc.pid) process.kill(backendProc.pid, 'SIGKILL'); } catch (e) {}
    }
    try {
      if (frontendProc.pid) process.kill(-frontendProc.pid, 'SIGKILL');
    } catch (e) {
      try { if (frontendProc.pid) process.kill(frontendProc.pid, 'SIGKILL'); } catch (e) {}
    }
  }

  // Ensure ports are freed
  killPort(FRONTEND_PORT);
  killPort(BACKEND_PORT);
  
  console.log(`${MAGENTA}[System] All processes successfully terminated.${RESET}`);
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGHUP', shutdown);
