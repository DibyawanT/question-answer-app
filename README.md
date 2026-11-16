# XAT Prep

Personal XAT practice app: a 20-question daily drill, sectional tests with real timing and marking, short study notes, stats, and push reminders at 1 pm and 9 pm IST until the day's drill is done.

React 19 front end · Hono on Node 24 · SQLite · Docker + Caddy.

## Run on your PC

```bash
npm install
npm run server   # API on :3000 (restarts on change)
npm run web      # app on http://localhost:5173
npm test
```

Then open Settings → Add questions and upload `data/seed-dm.json` and `data/seed-mixed.json`.

## Question files

```json
{ "passages": [{ "id": "dm-c01", "section": "DM", "text": "..." }],
  "questions": [{ "id": "dm-001", "section": "DM", "topic": "ethics", "type": "caselet", "setId": "dm-c01",
                  "stem": "...", "options": ["A", "B", "C", "D", "E"], "answer": 2, "explanation": "..." }],
  "notes": [{ "topic": "ethics", "text": "..." }] }
```

`section` is `DM`, `VALR`, `QADI` or `GK`. `answer` is the 0-based index into `options`. Every `setId` must match a passage (in the same file or already uploaded). Uploading a question with an existing id updates it. Bad items are rejected with the reason; the rest still go in.

## Deploy to AWS (about 45 minutes, once)

After this setup, every `git push` to `main` runs the tests and, if they pass, deploys to the server automatically.

### 1. Server
1. **Lightsail** → Create instance → Mumbai region → Linux/Unix → OS Only → Ubuntu 24.04 LTS → **Dual-stack** plan with **1 GB RAM** or more → name `xat-prep`.
2. **Networking** → create a **static IP** and attach it. In the instance's IPv4 firewall, add **HTTPS (443)**.
3. **Account → SSH keys** → download the default Mumbai key to `C:\Users\dibya\.ssh\lightsail.pem`, then in PowerShell:
   ```bash
   icacls C:\Users\dibya\.ssh\lightsail.pem /inheritance:r /grant:r "$($env:USERNAME):R"
   ssh -i C:\Users\dibya\.ssh\lightsail.pem ubuntu@<static-ip>
   ```
4. On the server, install Docker (it logs you out; connect again afterwards):
   ```bash
   curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker ubuntu && exit
   ```

### 2. Let the server read the GitHub repo
On the server:
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github_read -C xat-server
printf 'Host github.com\n  IdentityFile ~/.ssh/github_read\n' >> ~/.ssh/config
cat ~/.ssh/github_read.pub
```
GitHub → repo **Settings → Deploy keys → Add deploy key** → paste it, leave "Allow write access" **off**. Then on the server:
```bash
git clone git@github.com:DibyawanT/question-answer-app.git ~/xat-prep
cd ~/xat-prep
echo "APP_KEY=$(openssl rand -hex 16)" > .env
echo "DOMAIN=<static-ip-with-dashes>.sslip.io" >> .env
cat .env        # save the APP_KEY
sh deploy.sh    # first build takes a few minutes; ends with "Deployed <commit>"
```

### 3. Let GitHub Actions deploy
On the server, make a key that can only run `deploy.sh`:
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/actions -C github-actions
echo "command=\"sh ~/xat-prep/deploy.sh\",no-port-forwarding,no-agent-forwarding,no-pty $(cat ~/.ssh/actions.pub)" >> ~/.ssh/authorized_keys
cat ~/.ssh/actions   # copy everything, including the BEGIN/END lines
rm ~/.ssh/actions
```
On your PC, get the server's fingerprint line:
```bash
ssh-keyscan -t ed25519 <static-ip>
```
GitHub → repo **Settings → Secrets and variables → Actions → New repository secret**, three times:

| Name | Value |
|---|---|
| `LIGHTSAIL_HOST` | the static IP |
| `LIGHTSAIL_SSH_KEY` | the private key printed by `cat ~/.ssh/actions` |
| `LIGHTSAIL_KNOWN_HOSTS` | the line from `ssh-keyscan` |

Then **Actions → Test and deploy → Run workflow**. Both jobs go green and the deploy log ends with `Deployed <commit>`.

### 4. Devices
1. Laptop: open `https://<DOMAIN>` → Settings → paste the APP_KEY → upload every file in `data/`.
2. Android: open the same address in Chrome → ⋮ → **Add to Home screen** → open it → Settings → APP_KEY → Reminders → Turn on → Send a test. If nothing arrives: Android Settings → Apps → Chrome → Battery → Unrestricted.

### Day to day
- **Deploy:** `git push`. Watch it under the repo's **Actions** tab.
- **Logs:** on the server, `cd ~/xat-prep && docker compose logs --tail 50 app`.
- **Backups:** Settings → Download backup. The database lives in the `xat-prep_data` Docker volume and survives every deploy.
- **Stop paying:** delete the instance **and** the static IP in Lightsail.

## Notes

- Marking (+1, −0.25 wrong, −0.10 per skip beyond 8, no negatives in GK) and section sizes come from coaching sites, not the official bulletin. They live in `shared/scoring.ts`.
- `sslip.io` gives a free HTTPS hostname for an IP. If Let's Encrypt ever refuses it, buy a cheap domain, point it at the static IP and change `DOMAIN`.
- The bank questions were written by Claude: expect a few errors. Use "Report a problem"; reports are in the backup file.
