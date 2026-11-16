#!/bin/sh
# Runs on the server. Pulls the latest main, rebuilds, and waits until the app answers.
# GitHub Actions' deploy key is locked to this one command (see README).
set -e
cd ~/xat-prep
git pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null

for i in $(seq 1 30); do
  if docker compose exec -T app node -e "fetch('http://localhost:3000/').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"; then
    echo "Deployed $(git rev-parse --short HEAD)"
    exit 0
  fi
  sleep 2
done
echo "App did not come up. Last log lines:" >&2
docker compose logs --tail 50 app >&2
exit 1
