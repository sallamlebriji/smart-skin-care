"""Boot an available iPhone simulator, install and launch the built native app.

Requires macOS/Xcode. Used by GitHub Actions; produces a screenshot and run log.
This verifies startup only, not camera/TrueDepth hardware or account interactions.
"""
import argparse
import json
from pathlib import Path
import subprocess
import time


def run(*arguments):
    result = subprocess.run(arguments, check=True, capture_output=True, text=True, timeout=240)
    if result.stdout.strip(): print(result.stdout.strip(), flush=True)
    return result.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", default="build/ios/Build/Products/Debug-iphonesimulator/SmartSkinCare.app")
    parser.add_argument("--output", default="build/simulator-smoke")
    args = parser.parse_args()
    app = Path(args.app).resolve()
    if not app.is_dir(): raise SystemExit(f"Built simulator application is missing: {app}")
    output = Path(args.output); output.mkdir(parents=True, exist_ok=True)
    devices = json.loads(run("xcrun", "simctl", "list", "devices", "available", "--json"))["devices"]
    candidates = [(runtime, device) for runtime, values in devices.items() if "iOS" in runtime for device in values
                  if device.get("isAvailable") and device["name"].startswith("iPhone")]
    if not candidates: raise SystemExit("No available iPhone simulator runtime; install one in Xcode")
    runtime, device = sorted(candidates, key=lambda pair: (pair[0], pair[1]["name"]), reverse=True)[0]
    udid = device["udid"]
    (output / "device.json").write_text(json.dumps({"runtime": runtime, **device}, indent=2))
    if device["state"] != "Booted": run("xcrun", "simctl", "boot", udid)
    run("xcrun", "simctl", "bootstatus", udid, "-b")
    run("xcrun", "simctl", "ui", udid, "appearance", "light")
    run("xcrun", "simctl", "install", udid, str(app))
    launch = run("xcrun", "simctl", "launch", udid, "com.smartskincare.app")
    (output / "launch.txt").write_text(launch)
    time.sleep(8)  # Allow SwiftUI and the initial account restore request to complete.
    run("xcrun", "simctl", "io", udid, "screenshot", str(output / "account-screen.png"))
    (output / "result.json").write_text(json.dumps({"device": device["name"], "runtime": runtime,
        "install_and_launch": "passed", "scope": "startup screenshot; no UI interactions or hardware validation"}, indent=2))
    print("Simulator startup check completed. Inspect account-screen.png for the rendered app.")


if __name__ == "__main__": main()
