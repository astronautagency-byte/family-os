#!/usr/bin/env python3
# .freebuff/keep-alive.py — auto-restart the Vite dev server if it dies.
#
# Usage:
#   .freebuff/keep-alive.py start    # start the watcher in the background
#   .freebuff/keep-alive.py stop     # stop the watcher (and Vite)
#   .freebuff/keep-alive.py status   # show watcher + Vite state
#   .freebuff/keep-alive.py restart  # stop + start
#   .freebuff/keep-alive.py run      # run in the foreground (debugging)
#
# Polls http://127.0.0.1:5173/ every 30s. If the server is down (no listener
# on the port OR the HTTP index doesn't respond within 2s), it relaunches
# Vite via the same subshell-detach trick documented in .freebuff/run.md,
# logs the event with a timestamp, and keeps watching.
#
# Design note: this is a Python script, not a bash script, because the
# equivalent bash version hit a reproducible function-scoping failure on
# this macOS build — the function table was silently dropped when the
# script was exec'd via nohup/setsid, producing "is_vite_up: command not
# found" and "sleep: invalid time interval" errors in a tight loop. Python
# sidesteps the issue entirely: no functions are exported, no subshells
# to worry about, and the detach-via-double-fork pattern is bulletproof.

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

WORKTREE = Path("/Users/alexvorobiev/Project Vibe/FamOS/famOS")
FREEBuff = WORKTREE / ".freebuff"
WATCHER_PID_FILE = FREEBuff / "keep-alive.pid"
VITE_PID_FILE = FREEBuff / "preview-thmrvfzhw0gbyl.pid"
VITE_LOG = FREEBuff / "preview-thmrvfzhw0gbyl.log"
WATCHER_LOG = FREEBuff / "keep-alive.log"
URL = "http://127.0.0.1:5173/"
PORT = 5173
POLL_INTERVAL = 30
START_TIMEOUT = 15


def ts() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S")


def log(message: str) -> None:
    line = f"[{ts()}] {message}\n"
    # Write to both the log file and stdout (so `run` mode shows progress).
    try:
        with WATCHER_LOG.open("a") as f:
            f.write(line)
    except OSError:
        pass
    print(line, end="", flush=True)


def is_vite_up() -> bool:
    # Two-step check:
    #   1) nothing listening on the port → definitely down
    #   2) port has a listener but is the HTTP server actually responding? —
    #      we hit the index with a strict 2s timeout so a hung listener
    #      doesn't make us think the server is healthy.
    # The bare `except Exception` at the bottom is intentional: we never
    # want an uncaught exception here to kill the watcher, so we
    # conservatively treat any unexpected error as "Vite is down" and
    # let the next poll cycle retry.
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{PORT}"],
            capture_output=True, timeout=2,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return False
    except Exception:
        return False
    try:
        urllib.request.urlopen(URL, timeout=2).read()
        return True
    except Exception:
        return False


def find_vite_pid() -> int | None:
    """Return the PID of the actual node-vite process, or None.

    We use pgrep -f to find the node process that owns the vite CLI. The
    `head -1` keeps us deterministic if there's a race with a previous
    Vite that hasn't fully died yet.
    """
    try:
        result = subprocess.run(
            ["pgrep", "-f", f"node.*vite.*--port {PORT}"],
            capture_output=True, text=True, timeout=2,
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(result.stdout.strip().splitlines()[0])
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError):
        pass
    return None


def start_vite() -> None:
    log(f"Vite is down — relaunching on port {PORT}")
    # Kill any stale listeners on the port (orphans from previous crashes).
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{PORT}"],
            capture_output=True, text=True, timeout=2,
        )
        for pid in result.stdout.strip().splitlines():
            try:
                os.kill(int(pid), signal.SIGKILL)
            except (ProcessLookupError, ValueError):
                pass
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    time.sleep(1)

    # Subshell-detach trick: a `( ... ) &` in bash fully orphans the child
    # from the parent shell. We replicate that here by spawning Vite via
    # subprocess.Popen with start_new_session=True (which calls setsid on
    # POSIX), so it survives our exit. stdin is closed (DEVNULL) so the
    # child never blocks on a TTY read. stdout/stderr append to the
    # existing Vite log so we keep a single chronological record.
    try:
        with VITE_LOG.open("a") as vite_log:
            subprocess.Popen(
                ["npx", "vite", "--host", "127.0.0.1", "--port", str(PORT), "--strictPort"],
                cwd=str(WORKTREE),
                stdin=subprocess.DEVNULL,
                stdout=vite_log,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
    except OSError as exc:
        log(f"failed to spawn Vite: {exc}")
        return

    # Wait up to START_TIMEOUT for the new Vite to come up. The wait
    # loop is wrapped in a try/except so an unexpected error (e.g., a
    # transient OSError from find_vite_pid) doesn't kill the watcher
    # silently — we log it and continue to the next poll cycle.
    try:
        waited = 0
        while waited < START_TIMEOUT:
            time.sleep(1)
            waited += 1
            if is_vite_up():
                vite_pid = find_vite_pid()
                if vite_pid is not None:
                    VITE_PID_FILE.write_text(str(vite_pid))
                    log(f"Vite back up (pid {vite_pid}) after {waited}s")
                else:
                    log(f"Vite back up after {waited}s (pid not recorded)")
                return
        log(f"Vite failed to start within {START_TIMEOUT}s — will retry on next poll")
    except Exception as exc:
        log(f"start_vite wait loop raised {type(exc).__name__}: {exc} — will retry on next poll")


def run_loop() -> None:
    """The main watcher loop. Runs until killed by SIGINT/SIGTERM."""
    # Ignore SIGPIPE so a removed/rotated log file doesn't kill the
    # watcher with a BrokenPipeError on the next log() call. The
    # default SIGPIPE action is termination, which would leave the
    # watcher dead at the worst possible time.
    signal.signal(signal.SIGPIPE, signal.SIG_IGN)
    # Clean shutdown: remove the PID file so a future `start` doesn't
    # think we're still alive.
    def shutdown(signum, frame):
        WATCHER_PID_FILE.unlink(missing_ok=True)
        log(f"watcher exiting (signal {signum})")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    WATCHER_PID_FILE.write_text(str(os.getpid()))
    log(f"watcher started (pid {os.getpid()}) — polling {URL} every {POLL_INTERVAL}s")

    # If Vite is already down when the watcher starts, recover immediately
    # so the user doesn't have to wait POLL_INTERVAL seconds for the first
    # recovery cycle.
    if not is_vite_up():
        start_vite()

    while True:
        time.sleep(POLL_INTERVAL)
        if not is_vite_up():
            start_vite()


def detach_to_background() -> bool:
    """Double-fork to fully detach the watcher from the parent shell.

    The standard Unix double-fork pattern: the first fork creates a child
    that calls setsid (to become a session leader, detached from the
    controlling terminal), then forks again so the grandchild is no
    longer a session leader and can't reacquire a controlling terminal.
    The intermediate parent exits, so the grandchild is reparented to
    init (PID 1) and survives the original parent's exit.
    """
    # Resolve the script path to an absolute path so the grandchild's
    # os.execv can find it even if the user invoked us via a relative
    # path ("./.freebuff/keep-alive.py start") — without this, execv
    # would look for the script in the grandchild's CWD, which is /.
    script_path = os.path.realpath(sys.argv[0])
    try:
        # First fork
        pid = os.fork()
        if pid > 0:
            # Parent: wait for the intermediate to exit, then return so
            # the caller's shell can finish without us.
            os.waitpid(pid, 0)
            return True
        # First child: become session leader
        os.setsid()
        # Second fork
        pid = os.fork()
        if pid > 0:
            # Intermediate child exits immediately, leaving the grandchild
            # orphaned to init.
            os._exit(0)
        # Grandchild: redirect stdio to the log file and exec the run loop.
        with WATCHER_LOG.open("a") as log_file:
            os.dup2(log_file.fileno(), sys.stdout.fileno())
            os.dup2(log_file.fileno(), sys.stderr.fileno())
        with open(os.devnull) as devnull:
            os.dup2(devnull.fileno(), sys.stdin.fileno())
        os.execv(script_path, [script_path, "run"])
    except OSError as exc:
        print(f"failed to detach: {exc}", file=sys.stderr)
        return False
    return True  # unreachable in grandchild (execv replaces the process)


def cmd_start() -> int:
    if WATCHER_PID_FILE.exists():
        try:
            existing = int(WATCHER_PID_FILE.read_text().strip())
            os.kill(existing, 0)  # raises if not alive
            print(f"watcher already running (pid {existing})")
            return 0
        except (ProcessLookupError, ValueError, OSError):
            WATCHER_PID_FILE.unlink(missing_ok=True)
    if not detach_to_background():
        print("watcher failed to start")
        return 1
    # Wait up to 5s for the detached watcher to write its PID file.
    for _ in range(5):
        time.sleep(1)
        if WATCHER_PID_FILE.exists():
            try:
                pid = int(WATCHER_PID_FILE.read_text().strip())
                os.kill(pid, 0)
                print(f"watcher started (pid {pid})")
                return 0
            except (ProcessLookupError, ValueError, OSError):
                pass
    print(f"watcher failed to start — check {WATCHER_LOG}")
    return 1


def cmd_stop() -> int:
    if WATCHER_PID_FILE.exists():
        try:
            pid = int(WATCHER_PID_FILE.read_text().strip())
            os.kill(pid, signal.SIGTERM)
            log(f"watcher stopped (pid {pid})")
        except (ProcessLookupError, ValueError, OSError):
            pass
        WATCHER_PID_FILE.unlink(missing_ok=True)
    else:
        print("watcher not running")
    # Also stop Vite so a fresh `start` from a different shell gets a
    # clean port. Without this, the previous Vite would still be holding
    # :5173 and a newly-spawned Vite would fail with EADDRINUSE.
    if VITE_PID_FILE.exists():
        try:
            vpid = int(VITE_PID_FILE.read_text().strip())
            os.kill(vpid, signal.SIGTERM)
            log(f"Vite stopped (pid {vpid})")
        except (ProcessLookupError, ValueError, OSError):
            pass
        VITE_PID_FILE.unlink(missing_ok=True)
    return 0


def cmd_status() -> int:
    if WATCHER_PID_FILE.exists():
        try:
            pid = int(WATCHER_PID_FILE.read_text().strip())
            os.kill(pid, 0)
            print(f"watcher : running (pid {pid})")
        except (ProcessLookupError, ValueError, OSError):
            print("watcher : stopped")
    else:
        print("watcher : stopped")
    if is_vite_up():
        vpid = VITE_PID_FILE.read_text().strip() if VITE_PID_FILE.exists() else "?"
        print(f"Vite    : up     (pid {vpid})")
    else:
        print("Vite    : down")
    print(f"log     : {WATCHER_LOG}")
    return 0


def cmd_restart() -> int:
    cmd_stop()
    time.sleep(1)
    return cmd_start()


def cmd_run() -> None:
    run_loop()


COMMANDS = {
    "start": cmd_start,
    "stop": cmd_stop,
    "status": cmd_status,
    "restart": cmd_restart,
    "run": cmd_run,
}


def main() -> int:
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    handler = COMMANDS.get(cmd)
    if handler is None:
        print(f"Usage: {sys.argv[0]} {{start|stop|status|restart|run}}")
        return 1
    return handler() or 0


if __name__ == "__main__":
    sys.exit(main())
