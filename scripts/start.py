#!/usr/bin/env python3
"""Start the complete local stack or only the Onboard API with its database."""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

ROOT = Path(__file__).resolve().parents[1]
APP_DIR = ROOT / "app"
COMPOSE_FILE = ROOT / "infra" / "docker-compose.yml"
ENV_FILE = ROOT / ".env"
MIN_PYTHON = (3, 12)
DEFAULT_ONBOARD_PORT = "8001"
DEFAULT_DATABASE_PORT = "5433"


class StartError(RuntimeError):
    """An actionable startup validation or command failure."""


def os_name() -> str:
    names = {"Windows": "Windows", "Darwin": "macOS", "Linux": "Linux"}
    name = names.get(platform.system())
    if name is None:
        raise StartError(f"Unsupported operating system: {platform.system()}")
    return name


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        values[key.strip()] = value
    return values


def run(command: list[str], *, cwd: Path, env: dict[str, str] | None = None) -> None:
    result = subprocess.run(command, cwd=cwd, env=env, check=False)
    if result.returncode:
        raise StartError(f"Command failed with exit code {result.returncode}: {command[0]}")


def require_command(name: str, install_hint: str) -> str:
    executable = shutil.which(name)
    if executable is None:
        raise StartError(f"'{name}' was not found. {install_hint}")
    return executable


def validate_local_port(value: str) -> str:
    try:
        port = int(value)
    except ValueError as error:
        raise StartError("ONBOARD_LOCAL_PORT must be a number between 1 and 65535.") from error
    if not 1 <= port <= 65535:
        raise StartError("ONBOARD_LOCAL_PORT must be a number between 1 and 65535.")
    with socket.socket() as listener:
        try:
            listener.bind(("127.0.0.1", port))
        except OSError as error:
            raise StartError(
                f"Port {port} is already in use. Stop the other service or set ONBOARD_LOCAL_PORT in .env."
            ) from error
    return str(port)


def prepare_environment(dotenv: dict[str, str]) -> dict[str, str]:
    env = os.environ.copy()
    for key, value in dotenv.items():
        env.setdefault(key, value)

    simulator_token = env.get("SIMULATOR_TOKEN", "").strip()
    if not simulator_token:
        raise StartError(
            "SIMULATOR_TOKEN is empty. Set it in .env to the token configured for the Vercel emulator."
        )

    defaults = {
        "ONBOARD_DATABASE_URL": (
            "postgresql+psycopg://onboard:"
            + quote_plus(env.get("ONBOARD_DB_PASSWORD", "onboard"))
            + "@127.0.0.1:"
            + env.get("ONBOARD_DB_PORT", DEFAULT_DATABASE_PORT)
            + "/onboard"
        ),
        "ONBOARD_SIMULATOR_URL": env.get(
            "SIMULATOR_URL", "https://emu-eight-umber.vercel.app"
        ),
        "ONBOARD_SIMULATOR_TOKEN": simulator_token,
        "ONBOARD_SIMULATOR_TIMEOUT_S": env.get("SIMULATOR_TIMEOUT_S", "10"),
        "ONBOARD_INGEST_WORKER_ENABLED": env.get("INGEST_WORKER_ENABLED", "true"),
        "ONBOARD_INGEST_INTERVAL_S": env.get("INGEST_INTERVAL_S", "60"),
        "ONBOARD_INGEST_SESSION_ID": env.get("INGEST_SESSION_ID", "mvp-session-1"),
        "ONBOARD_INGEST_BOOT_ID": env.get("INGEST_BOOT_ID", "mvp-boot-1"),
        "ONBOARD_INGEST_SCENARIO": env.get("INGEST_SCENARIO", "NORMAL"),
    }
    for key, value in defaults.items():
        if not env.get(key):
            env[key] = value
    # This local mode exercises the Vercel ingest path without requiring Earth to run.
    env["ONBOARD_SYNC_WORKER_ENABLED"] = "false"
    env.setdefault("ONBOARD_EARTH_URL", "http://127.0.0.1:8002")
    return env


def start_onboard() -> int:
    try:
        system = os_name()
        print(f"Detected platform: {system}")

        if sys.version_info < MIN_PYTHON:
            actual = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            raise StartError(f"Python 3.12 or newer is required; found {actual}.")
        print(f"Python OK: {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}")

        uv = require_command("uv", "Install uv, then run this script again.")
        docker = require_command(
            "docker",
            "Install Docker Desktop (Windows/macOS) or Docker Engine with the Compose plugin (Linux).",
        )
        dotenv = read_env_file(ENV_FILE)
        env = prepare_environment(dotenv)
        port = validate_local_port(env.get("ONBOARD_LOCAL_PORT", DEFAULT_ONBOARD_PORT))

        compose = [docker, "compose", "-f", str(COMPOSE_FILE)]
        run(compose + ["version"], cwd=ROOT)
        docker_info = subprocess.run(
            [docker, "info"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        if docker_info.returncode:
            raise StartError(
                "Docker is installed but its engine is not running. Start Docker and retry."
            )
        print("Docker Engine and Compose OK.")

        run([uv, "sync", "--all-packages"], cwd=APP_DIR, env=env)
        run(compose + ["up", "-d", "onboard-db"], cwd=ROOT, env=env)

        for attempt in range(30):
            ready = subprocess.run(
                compose
                + ["exec", "-T", "onboard-db", "pg_isready", "-U", "onboard", "-d", "onboard"],
                cwd=ROOT,
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            if ready.returncode == 0:
                break
            if attempt < 29:
                time.sleep(2)
        else:
            raise StartError("onboard-db did not become ready within 60 seconds.")
        print("Docker database ready.")

        onboard_dir = APP_DIR / "onboard"
        run(
            [uv, "run", "--package", "onboard", "alembic", "upgrade", "heads"],
            cwd=onboard_dir,
            env=env,
        )
        command = [
            uv,
            "run",
            "--package",
            "onboard",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            port,
            "--reload",
        ]
        print(f"Starting Onboard at http://127.0.0.1:{port} (Ctrl+C to stop).")
        return subprocess.run(command, cwd=onboard_dir, env=env, check=False).returncode
    except KeyboardInterrupt:
        print("\nOnboard stopped.")
        return 130
    except StartError as error:
        print(f"Startup error: {error}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"Startup error: {error}", file=sys.stderr)
        return 1


def start_stack() -> int:
    try:
        docker = require_command("docker", "Install Docker, then run this script again.")
        command = [docker, "compose", "-f", str(COMPOSE_FILE), "up", "--build"]
        if ENV_FILE.exists():
            command[2:2] = ["--env-file", str(ENV_FILE)]
        return subprocess.run(command, cwd=ROOT, env=os.environ.copy(), check=False).returncode
    except KeyboardInterrupt:
        print("\nStack stopped.")
        return 130
    except StartError as error:
        print(f"Startup error: {error}", file=sys.stderr)
        return 1
    except OSError as error:
        print(f"Startup error: {error}", file=sys.stderr)
        return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--onboard-only",
        action="store_true",
        help="run only Onboard locally with reload; Earth and Web are not started",
    )
    args = parser.parse_args()
    return start_onboard() if args.onboard_only else start_stack()


if __name__ == "__main__":
    raise SystemExit(main())
