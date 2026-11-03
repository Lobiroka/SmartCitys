"""Execute uma suíte preservando seu exit code, log e duração (sem dependências)."""
import argparse
import json
import subprocess
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("suite", choices=["mobile", "api"])
    parser.add_argument("--cwd", default=".")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    output = root / "test-results" / args.suite
    output.mkdir(parents=True, exist_ok=True)
    if args.suite == "mobile":
        command = ["npm", "run", "test", "--workspace", "@smart-city/mobile", "--", "--json",
                   f"--outputFile={output / 'results.json'}", "--coverage",
                   f"--coverageDirectory={output / 'coverage'}",
                   "--coverageReporters=json-summary", "--coverageReporters=lcov",
                   "--coverageReporters=text"]
    else:
        command = ["npm", "test", "--", "--reporter=default", "--reporter=json",
                   "--reporter=junit", f"--outputFile.json={output / 'results.json'}",
                   f"--outputFile.junit={output / 'results.xml'}"]
    start = time.monotonic()
    code = 1
    with (output / "tests.log").open("w", encoding="utf-8") as log:
        try:
            process = subprocess.Popen(command, cwd=args.cwd, stdout=subprocess.PIPE,
                                       stderr=subprocess.STDOUT, text=True,
                                       encoding="utf-8", errors="replace")
            for line in process.stdout:
                print(line, end="", flush=True)
                log.write(line)
            code = process.wait()
        except OSError as error:
            log.write(str(error))
            print(error, flush=True)
    (output / "execution.json").write_text(json.dumps({
        "exit_code": code, "duration_seconds": round(time.monotonic() - start, 3)
    }), encoding="utf-8")
    return code


if __name__ == "__main__":
    raise SystemExit(main())
