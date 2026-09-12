# Deployment

Live at <https://knightfall.wiki>, served from a Vultr box at 64.177.41.91.

## How updates reach production

Push to `ai-finance-chatbot` on the `hackathon` remote. A systemd timer on the
server checks that branch every two minutes; when it moves, the server pulls,
installs, builds and swaps the new build into `/var/www/wayne`.

There is nothing to run by hand:

```bash
git push hackathon ai-finance-chatbot
```

The build happens **on the server**, not in CI, so the API keys live only in
`~/wayne/.env.local` there (mode 600). They are never committed and never sit in
a CI secret store. A key change needs that file edited on the server followed by
a rebuild — editing it locally is not enough, because Vite inlines the keys at
build time.

## Server layout

| Path | Purpose |
| --- | --- |
| `~/wayne` | Git checkout the server builds from |
| `~/wayne/.env.local` | API keys, mode 600, not in git |
| `~/wayne-deploy.sh` | Pull, build, swap |
| `/var/www/wayne` | What nginx serves |
| `/etc/nginx/sites-available/wayne` | nginx config |

## Operations

```bash
ssh -i ~/.ssh/wayne_deploy linuxuser@64.177.41.91

systemctl list-timers wayne-deploy.timer   # when it last ran
journalctl -u wayne-deploy.service -n 50   # deploy log
sudo systemctl start wayne-deploy.service  # deploy now, don't wait
~/wayne-deploy.sh                          # same, in the foreground
```

## Things that will bite

- **nginx must send `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp`.** The budget runs in a SQLite
  worker that needs `SharedArrayBuffer`, which browsers only give to
  cross-origin-isolated pages. Without these the app loads and then fails to
  open the file.
- **HTTPS is required, not cosmetic.** Microphone capture and
  `SharedArrayBuffer` both need a secure context, so voice and the budget file
  break over plain HTTP.
- **A failed build leaves the old site up.** The deploy checks for an
  `index.html` before swapping, so a broken commit does not blank the site.
- **Deploys are serialised with a lock file.** A build outlasts the two-minute
  timer; overlapping runs would corrupt the checkout.
