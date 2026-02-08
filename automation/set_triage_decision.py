#!/usr/bin/env python3
import json
import os
import sys

STATE_PATH = "/Users/guilhermesbot/clawd/automation/auto_triage_state.json"


def main():
    if len(sys.argv) < 2:
        print("Usage: set_triage_decision.py pedido|asana")
        sys.exit(1)
    decision = sys.argv[1].strip().lower()
    if decision not in ("pedido", "asana"):
        print("Decision must be 'pedido' or 'asana'")
        sys.exit(1)

    if not os.path.exists(STATE_PATH):
        print("No triage state found")
        sys.exit(1)

    with open(STATE_PATH, "r") as f:
        state = json.load(f)

    if not state.get("pending"):
        print("No pending item")
        sys.exit(1)

    state["pending"]["decision"] = decision
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, indent=2)

    print("OK")


if __name__ == "__main__":
    main()
