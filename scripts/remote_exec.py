#!/usr/bin/env python3
"""Run a command on the remote server over SSH (deploy helper)."""
import sys
import paramiko

HOST = "151.241.228.215"
USER = "root"
PASS = "Darling@6599"


def main():
    cmd = sys.argv[1]
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PASS, timeout=30)
    _, stdout, stderr = client.exec_command(cmd, timeout=570)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print("STDERR:", err, file=sys.stderr)
    client.close()
    sys.exit(rc)


if __name__ == "__main__":
    main()
