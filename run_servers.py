import os
import socket
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path


def find_free_port(start_port: int = 8001, attempts: int = 20) -> int:
    """Return the first available loopback TCP port for the local backend."""
    for port in range(start_port, start_port + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                continue
        return port
    raise RuntimeError(f"No free local backend port found in {start_port}-{start_port + attempts - 1}.")


def is_port_available(port: int) -> bool:
    """Return whether a loopback port is available for a local development service."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            probe.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def log_stream(proc, prefix):
    try:
        for line in iter(proc.stdout.readline, ""):
            if not line:
                break
            print(f"{prefix} {line.strip()}")
    except Exception:
        pass

def run():
    repo_root = Path(__file__).resolve().parent
    frontend_dir = repo_root / "frontend"
    print("=" * 60)
    print("  AI Healthcare System - Concurrent Services Runner")
    print("=" * 60)
    print("[INFO] Starting all services concurrently...")

    frontend_port = 3000
    if not is_port_available(frontend_port):
        print("[FATAL] Port 3000 is already in use. Stop the process using 127.0.0.1:3000, then run start_dev.ps1 again.")
        return 1

    backend_port = int(os.getenv("BACKEND_PORT", find_free_port()))
    backend_url = f"http://127.0.0.1:{backend_port}"

    # Start the backend on a user-level loopback port. Docker and WSL are not required.
    print(f"[INFO] Starting Backend (FastAPI) on {backend_url} ...")
    backend_cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--reload", "--host", "127.0.0.1", "--port", str(backend_port)]
    backend_proc = subprocess.Popen(
        backend_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        errors="ignore"
    )

    # Start Frontend
    print(f"[INFO] Starting Frontend (Vite) on http://127.0.0.1:{frontend_port} ...")
    local_bun = Path.home() / ".bun" / "bin" / ("bun.exe" if os.name == "nt" else "bun")
    package_manager = (
        shutil.which("bun")
        or (str(local_bun) if local_bun.is_file() else None)
        or shutil.which("npm.cmd" if os.name == "nt" else "npm")
    )
    if not package_manager:
        print("[FATAL] Install Node.js (npm) or Bun before starting the frontend.")
        backend_proc.terminate()
        return 1
    frontend_env = os.environ.copy()
    frontend_env["VITE_PUBLIC_API_URL"] = backend_url
    frontend_cmd = [package_manager, "run", "dev", "--", "--host", "127.0.0.1", "--port", str(frontend_port)]
    frontend_proc = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        errors="ignore",
        env=frontend_env,
    )

    # Spawn threads to read output streams in real-time
    t1 = threading.Thread(target=log_stream, args=(backend_proc, "\033[96m[Backend]\033[0m"))
    t2 = threading.Thread(target=log_stream, args=(frontend_proc, "\033[92m[Frontend]\033[0m"))
    t1.daemon = True
    t2.daemon = True
    t1.start()
    t2.start()

    print("[OK] Services initiated. Press Ctrl+C to terminate both servers.")
    print("-" * 60)

    try:
        while True:
            # Check if either process died unexpectedly
            if backend_proc.poll() is not None:
                print(f"\n[FATAL] Backend exited unexpectedly with code {backend_proc.returncode}")
                break
            if frontend_proc.poll() is not None:
                print(f"\n[FATAL] Frontend exited unexpectedly with code {frontend_proc.returncode}")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[INFO] Termination requested. Stopping services...")
    finally:
        # Graceful shutdown
        backend_proc.terminate()
        frontend_proc.terminate()
        try:
            backend_proc.wait(timeout=3)
            frontend_proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            print("[WARN] Force killing processes that did not exit in time...")
            backend_proc.kill()
            frontend_proc.kill()
        print("[OK] Both services stopped successfully.")

if __name__ == "__main__":
    raise SystemExit(run())
