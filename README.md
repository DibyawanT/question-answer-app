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

## Deploy to AWS (about 20 minutes)

1. **Lightsail** → Create instance → Mumbai region → Linux/Unix → OS Only → Ubuntu 24.04 LTS → a plan with **1 GB RAM** or more.
2. **Networking** tab → create and attach a **static IP**. In the IPv4 firewall, add **HTTPS (443)**; HTTP (80) is open already.
3. Connect with SSH (browser button), then install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh && sudo usermod -aG docker $USER && exit
   ```
4. Copy the project up. From this folder on your PC:
   ```bash
   tar -czf ../xat-prep.tgz --exclude=node_modules --exclude=dist --exclude=.git --exclude="app.db*" .
   scp -i <your-lightsail-key.pem> ../xat-prep.tgz ubuntu@<static-ip>:~
   ```
5. On the server:
   ```bash
   mkdir xat-prep && tar -xzf xat-prep.tgz -C xat-prep && cd xat-prep
   echo "APP_KEY=$(openssl rand -hex 16)" > .env
   echo "DOMAIN=<static-ip-with-dashes>.sslip.io" >> .env
   cat .env        # note the APP_KEY
   docker compose up -d --build
   ```
6. On your Android phone, open `https://<DOMAIN>` in Chrome → Settings → paste the APP_KEY → upload the question files → Chrome menu → **Add to home screen** → open it from the home screen → Settings → Reminders → Turn on → Send a test.

**Update after a change:** repeat step 4, then on the server `tar -xzf ~/xat-prep.tgz -C ~/xat-prep && cd ~/xat-prep && docker compose up -d --build`. The database lives in the `data` Docker volume and survives rebuilds.

**Backups:** Settings → Download backup gives one JSON file. Its questions part can be uploaded again as-is.

## Notes

- Marking (+1, −0.25 wrong, −0.10 per skip beyond 8, no negatives in GK) and section sizes come from coaching sites, not the official bulletin. They live in `shared/scoring.ts`.
- `sslip.io` gives a free HTTPS hostname for an IP. If Let's Encrypt ever refuses it, buy a cheap domain, point it at the static IP and change `DOMAIN`.
- The bank questions were written by Claude: expect a few errors. Use "Report a problem"; reports are in the backup file.
