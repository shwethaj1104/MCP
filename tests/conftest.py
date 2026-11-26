"""Isolate every test module and MCP subprocess from the user's local application data."""

import os
import tempfile
import sys

_test_directory = tempfile.TemporaryDirectory(prefix="blueledger-tests-")
os.environ["DATABASE_URL"] = "sqlite:///" + _test_directory.name + "/banking.db"
os.environ["CHECKPOINT_DB_PATH"] = _test_directory.name + "/checkpoints.db"
os.environ["OPENAI_API_KEY"] = ""
os.environ["OPENROUTER_API_KEY"] = ""


# Dispose test connections and remove only the temporary directory created for this test session.
def pytest_sessionfinish(session, exitstatus):
    module = sys.modules.get("packages.db")
    if module is not None:
        module.engine.dispose()
    _test_directory.cleanup()
