#!/usr/bin/env python3
"""Exercise the staged app with isolated homes and file-backed output streams."""
import json
import os
import pathlib
import subprocess
import tempfile
import time

base = pathlib.Path(__file__).resolve().parent.parent
app = base / "launcher/build/local-provider-6.1.18/mac-arm64/Codex Web GPT.app"
evidence = base / "repair-evidence"
evidence.mkdir(exist_ok=True)
started = time.monotonic()
with tempfile.TemporaryDirectory(prefix="codex-web-package-smoke-") as temporary:
    scratch = pathlib.Path(temporary)
    marker = scratch / "ready.json"
    environment = dict(
        os.environ,
        TMPDIR=temporary,
        CODEX_WEB_GPT_LAUNCHER_DATA_DIR=str(scratch / "launcher"),
        CODEX_CHATGPT_WEB_HOME=str(scratch / "web"),
        CODEX_HOME=str(scratch / "codex"),
        CODEX_WEB_GPT_SMOKE_FILE=str(marker),
    )
    # Captured pipes can outlive Electron's main process; wait on that process
    # directly and retain the logs as files instead of waiting for pipe EOF.
    with (evidence / "package-filelog.stdout").open("w") as stdout, \
            (evidence / "package-filelog.stderr").open("w") as stderr:
        process = subprocess.Popen(
            [str(app / "Contents/MacOS/Codex Web GPT"), "--launcher-smoke-test"],
            env=environment, stdout=stdout, stderr=stderr,
        )
        timed_out = False
        try:
            process.wait(timeout=45)
        except subprocess.TimeoutExpired:
            timed_out = True
            process.kill()  # Only this isolated smoke child, never the installed app.
            process.wait()
    readiness = json.loads(marker.read_text()) if marker.exists() else None
    result = {
        "readiness": readiness,
        "exitCode": process.returncode,
        "elapsedSeconds": round(time.monotonic() - started, 2),
        "processWaitTimedOut": timed_out,
    }
    (evidence / "package-filelog-result.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
    assert not timed_out and process.returncode == 0, "Packaged launcher did not exit cleanly"
    assert readiness == {
        "ok": True, "version": "6.1.18", "platform": "darwin",
        "packaged": True, "runtimeVerified": True,
    }, "Packaged launcher did not verify its runtime"
