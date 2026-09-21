# GT GridStats (gt-gridstats.com) — API & Scraping Reconnaissance

All findings below were produced by executing live requests on **2026-09-21 (UTC)** with
`curl` + `python3`. Every claim is paired with the exact command and the real observed
response. Nothing here is inferred from docs alone without being labelled as such.

---

## 1. Complete endpoint inventory (from `GET /api-docs`, full page read)

The docs page is 132,758 bytes and contains **exactly 10 endpoint cards** (verified by
extracting every method badge + `<code>` path pair from the raw HTML — the strip-tag
approach alone is enough here because all cards are present in the SSR HTML, hidden only
by Alpine `x-show`).

```
$ curl -sS -o apidocs.html https://gt-gridstats.com/api-docs
status=200 size=132758 type=text/html; charset=utf-8
```

Card count extracted from raw HTML:
```
GET /api/assets/manufacturers
GET /api/assets/manufacturers/{code}
GET /api/assets/cars
GET /api/assets/cars/{identifier}/{locale?}
GET /api/assets/manufacturer/{manufacturer_id}/cars/{locale?}
GET /api/assets/manufacturer/{manufacturer_id}/{car_class}/{locale?}
GET /api/assets/regions
POST /api/racers
GET /api/racers/{identifiers}
GET /api/series-{series}/drivers/{psn_list}
total cards: 10
```

**Auth for all of them: `Authorization: Bearer YOUR_TOKEN_SECRET` + `Accept: application/json`.**
Every one of the 10 was proven protected (HTTP 401) — see §3.

| # | Method | Path | Params | Docs billing label | Response shape (per docs) |
|---|--------|------|--------|--------------------|---------------------------|
| 1 | GET | `/api/assets/manufacturers` | none | Metered (10 req/min) | `[{id,name,logo}]` |
| 2 | GET | `/api/assets/manufacturers/{code}` | `code` path, **required**, strict 2-letter locale (`cn`,`jp`,`gb`,`us`) | Metered (10 req/min) | `[{id,name,logo}]` localized |
| 3 | GET | `/api/assets/cars` | `page` query (default 1) | Metered (10 req/min) | `{current_page,data:[{id,car_code,gt7_code,name,class,image,manufacturer:{id,name}}],next_page_url,total}` |
| 4 | GET | `/api/assets/cars/{identifier}/{locale?}` | `identifier` path required (`1544` \| `613` \| `car1544`); `locale?` optional | Metered (10 req/min) | single car object (same as #3 item) |
| 5 | GET | `/api/assets/manufacturer/{manufacturer_id}/cars/{locale?}` | `manufacturer_id` path required (int); `locale?` optional | Metered (10 req/min) | `{manufacturer,count,cars:[car]}` |
| 6 | GET | `/api/assets/manufacturer/{manufacturer_id}/{car_class}/{locale?}` | `manufacturer_id` required; `car_class` required (`gr3`,`gr.3`,`grn`,`gr.b`,`gr1`,`gr4`); `locale?` optional | Metered (10 req/min) | `{manufacturer,class,count,cars:[car]}` |
| 7 | GET | `/api/assets/regions` | none | **⚡ QUOTA FREE (30 requests/min limit)** — "does not consume daily tracking caps" | `[{id,code,name,is_active}]` |
| 8 | POST | `/api/racers` | JSON body `{"identifiers": <array\|comma-string>}`, **max 16**; new drivers staggered 3 s each, up to ~48 s | Metered (10 req/min) | `{status,count,not_found:[],drivers:[{PSN_ID,Nickname,GUID,DR,SR,last_sync,country_code,stats:{dr_points,dr_ratio,total_races,victories,poles,fastest_laps,clean_races,collector_level,license,garage_count,collection_progress,total_credits,play_time_readable,distance_km}}]}` |
| 9 | GET | `/api/racers/{identifiers}` | `identifiers` path = comma-separated, **max 16**, missing → `not_found[]` | Metered (10 req/min) | same as #8 |
| 10 | GET | `/api/series-{series}/drivers/{psn_list}` | `series` path = official championship id (`gt7_championship_id`, doc example `1564`); `psn_list` = comma-separated PSNs | Metered (10 req/min) | `{series_id,type,driver_count,drivers:[{psn,season_rank,total_points,rounds:[{no,points,is_counted}]}]}` |

### The "Championship Analytics = 3" badge is WRONG
The docs sidebar shows a `3` badge for **🏆 Championship Analytics**, but only **one**
championship card is rendered in the page (confirmed by scanning the whole
`activeGroup === 'series'` block: 1 method badge, 1 path, 1 schema). I also probed
candidate sibling routes live — only the documented one resolves:

```
$ for p in series-1564 series-1564/standings series-1564/drivers series-1564/rounds \
           series-1564/results series championships series/1564 championships/1564 \
           series-1564/drivers/skino2024; do ...
/api/series-1564               -> 404
/api/series-1564/standings     -> 404
/api/series-1564/drivers       -> 404
/api/series-1564/rounds        -> 404
/api/series-1564/results       -> 404
/api/series                      -> 404
/api/championships               -> 404
/api/series/1564                 -> 404
/api/championships/1564          -> 404
/api/series-1564/drivers/skino2024 -> 401   <-- exists, protected
```
Conclusion: `/api/series-{series}/drivers/{psn_list}` is the **only** Championship
endpoint that exists. It returns **championship round points per driver** (season rank,
total points, per-round points + `is_counted`), **not** lap times or race positions.

---

## 2. How to get a token — there is NO open registration

**Human steps (the only currently available path):**
1. There is no self-serve signup. `/register` and `/signup` both 404; the GSTA download
   page ships a dead link literally labelled **"Create an account | Coming soon"**:
   ```
   $ curl -sS -o /dev/null -w "%{http_code}" https://gt-gridstats.com/register   -> 404
   $ curl -sS -o /dev/null -w "%{http_code}" https://gt-gridstats.com/signup     -> 404
   $ grep -o 'Create an account[^<]*' download.html
   Create an account | Coming soon      (href="#")
   ```
2. The official instruction is on `/contact` (FAQ "Can I use this data for my own website?"):
   > "Yes! We are opening up an API for developers. **Contact us via the form above to
   > request an early access API key.**"
3. So a human must send a message through the Livewire contact form at
   <https://gt-gridstats.com/contact> (`<form wire:submit.prevent="submit">`, UI says
   "Sending to Discord..."), or email `gtgridstats@gmail.com`, or ask in the Discord
   <https://discord.gg/CKSK9Y2MPS> — and wait for a manually issued key.
4. `/download` claims the key is **free** once accounts open: *"The GridStats widgets need
   a free API key. Register, generate a key on your account page, and paste it into the app
   once."* `/donate` says *"keeping the API free or low-cost for independent developers"*.
   No pricing page, no free-tier table, no quota tiers are published anywhere.
5. `/login` (200) and `/dashboard` (302 → `/login`) exist for **site accounts**, which are
   not creatable right now.

**Quotas:** docs only show example values `X-Quota-Limit: 1000`, `X-Quota-Remaining: 942`
and `HTTP 429 Quota Exceeded`, plus per-endpoint `10 requests/min` (regions `30/min`).
No quota headers were ever returned to an anonymous caller.

**Token-free endpoints: NONE.** Even the endpoint the docs explicitly label
`⚡ QUOTA FREE` requires a Bearer token (see §3, proof 1). "QUOTA FREE" means *no daily
cap*, not *no auth*.

---

## 3. Anonymous access test results (exact status + body)

Every documented route, called with no `Authorization` header. Note the **`Accept`
header is load-bearing**: without `Accept: application/json` Laravel redirects to the
login page instead of returning JSON.

All 10 documented routes, `curl -X <M> -H 'Accept: application/json'`:
```
GET /api/assets/manufacturers                        -> 401
GET /api/assets/manufacturers/jp                     -> 401
GET /api/assets/cars                                 -> 401
GET /api/assets/cars/1544                            -> 401
GET /api/assets/manufacturer/78/cars                 -> 401
GET /api/assets/manufacturer/78/gr3                  -> 401
GET /api/assets/regions                              -> 401
POST /api/racers                                     -> 401
GET /api/racers/skino2024                            -> 401
GET /api/series-1564/drivers/skino2024               -> 401
```

Proof 1 — the "QUOTA FREE" endpoint is still authenticated:
```
$ curl -sS -i -H 'Accept: application/json' https://gt-gridstats.com/api/assets/regions
HTTP/2 401
access-control-allow-origin: *
cache-control: no-cache, private
content-type: application/json
x-powered-by: PHP/8.4.20

{"message":"Unauthenticated."}
```

Proof 2 — the exact three calls requested in the brief:
```
$ curl -sS -i -H 'Accept: application/json' https://gt-gridstats.com/api/assets/manufacturers
HTTP/2 401 ... {"message":"Unauthenticated."}

$ curl -sS -i -X POST -H 'Content-Type: application/json' -H 'Accept: application/json' \
       -d '{"identifiers":["skino2024"]}' https://gt-gridstats.com/api/racers
HTTP/2 401 ... {"message":"Unauthenticated."}

$ curl -sS -i -H 'Accept: application/json' https://gt-gridstats.com/api/racers/skino2024
HTTP/2 401 ... {"message":"Unauthenticated."}
```

Proof 3 — invalid / malformed credentials are also 401 (no 403 distinction):
```
$ curl -sS -i -H 'Authorization: Bearer INVALID_TEST_TOKEN_123' \
       -H 'Accept: application/json' https://gt-gridstats.com/api/assets/regions
HTTP/2 401 ... {"message":"Unauthenticated."}
```

Proof 4 — `Accept` header decides 401 vs 302:
```
$ curl -sS -o /dev/null -D - https://gt-gridstats.com/api/assets/regions | grep -i 'HTTP/\|location'
HTTP/2 302   location: https://gt-gridstats.com/login

$ curl -sS -o /dev/null -D - -H 'Accept: application/json' https://gt-gridstats.com/api/assets/regions | grep -i 'HTTP/\|location'
HTTP/2 401
```

Rate limiting: **no 429 and no `X-Quota-*` header was ever observable anonymously** — the
auth middleware rejects first (401), so anonymous probing cannot establish the real
limits. Nothing to report there beyond the docs' claims.

---

## 4. Can the API provide (a)–(d)? (using only endpoints that work anonymously)

**No API endpoint works anonymously, so via the JSON API all four are UNKNOWN.**
The evidence below is from the *public HTML site*, which is the working alternative.

| Goal | Via JSON API (no token) | Via public HTML site | Verdict |
|------|------------------------|----------------------|---------|
| (a) Current Sport Mode **Time Trial** standings — lap time + global rank | No anonymous access; **no time-trial endpoint is even documented** | **YES** — `/explore-events` renders a live top-100 leaderboard (Pos/Driver/Time/Gap); `/player/<PSN>` Event History gives that driver's global rank + time | **CONFIRMED (HTML only)** |
| (b) Current **Daily Races** qualifying/race leaderboards | No anonymous access; **no daily-race endpoint documented at all** | **PARTIAL** — current-week schedule is public; the global Top-100 board is only in a Livewire modal (`wire:click="openModal(538)"`, no plain URL: `/dailies/538` → 404); per-driver daily rank + best lap IS public on `/player/<PSN>` | **PARTIAL / UNKNOWN via API** |
| (c) Per-driver Sport Mode race **history with finishing positions and times** | No anonymous access; no history endpoint documented | **NO finishing positions.** `/player/<PSN>` "Daily Race History" columns are `Track / Race \| Vehicle \| Date \| Rank \| Best Time` — "Rank" is a *leaderboard* rank (e.g. `#11,396`), not a finishing position; only best lap, no race time | **NOT AVAILABLE** (position data) |
| (d) Aggregate driver stats (DR, SR, races, wins, poles, fastest laps, distance) | Blocked anonymously; docs say `POST/GET /api/racers` returns all of these **with a token** | **MOSTLY YES** — `/player/<PSN>` gives DR, SR, DR points, Total Entries, Victories, Poles, Daily-Races entries/wins/Top5/avg start/avg finish, World Series entries/wins, Collector Level, License, Distance, Seat Time, Garage, Credits. **Fastest laps and clean races are absent from the HTML** (grep for `fastest` → 0 hits) | **CONFIRMED via HTML, except fastest laps** |

Exact proof snippets for the HTML capability:

```
$ curl -sS https://gt-gridstats.com/explore-events | grep -o \
    'MetalGear9493\|1:52.486\|Dragon Trail - Seaside Reverse' | sort -u
1:52.486
Dragon Trail - Seaside Reverse
MetalGear9493
```
The leaderboard block is plain SSR HTML, 100 rows, each driver linking to `/player/<PSN>`:
```
<a href="/player/MetalGear9493"> ... Pos 01 ... 1:52.486 ... Gap
<span>Driver</span> <span>Time</span> <span>Gap</span>
```

```
$ curl -sS https://gt-gridstats.com/player/skino2024     -> 200, 217,825 bytes
```
Rendered text (SSR, no JS needed):
```
Driver Rating  28%  B / S  15,608 pts   Next Rank: A
Total Entries 289   Victories 11   Poles 7
Daily Races  282 Entries  Wins 11  Top 5 99  Avg Start 8  Avg Finish 7
World Series  7 Entries  Wins 0  Top 5 1  Avg Start 12  Avg Finish 8
Collector Level 70   License Master B   Distance 128,488 KM   Seat Time 1,496 HR
Garage 678 CARS   Total Credits 816,478,948
Daily Race History: Deep Forest Raceway | Daily: A | Porsche 911 GT3 (996) '01 |
                    14 Sep 2026 | #11,396 | 1:40.776
Event History: Dragon Trail - Seaside Reverse | Lap Time Challenge | Lexus RC F |
               17 Sep 2026 - 01 Oct 2026 | #44,434 | 2:01.443
Competition History: World Series 2026 Online Qualifiers | SEASON 1560 | GT2 |
                     #4,593 | 162 pts | R1 Road Atlanta Completed 47 ...
```

---

## 5. Public HTML pages per driver — the real no-token alternative

Driver profile pages exist under **`/player/<PSN>`**, not `/drivers/<PSN>`:

```
$ curl -sS -o /dev/null -w "%{http_code}\n" https://gt-gridstats.com/drivers/skino2024
404
$ curl -sS -o /dev/null -w "%{http_code}\n" https://gt-gridstats.com/drivers/SparksTheory
404
$ curl -sS -o /dev/null -w "%{http_code}\n" https://gt-gridstats.com/player/skino2024
200
$ curl -sS -o /dev/null -w "%{http_code}\n" https://gt-gridstats.com/player/SparksTheory
200
$ curl -sS -o /dev/null -w "%{http_code}\n" https://gt-gridstats.com/player/notarealpsn_zzz999
404
```
Other probed patterns: `/driver/<PSN>` 404, `/profile/<PSN>` 404, `/sport-mode/<PSN>` 404,
`/sports-mode/<PSN>` 404, `/racers/<PSN>` 404, `/drivers/<PSN>/stats` 404.

Working public (no-token) HTML routes found:
| URL | Status | Content |
|-----|--------|---------|
| `/` | 200 | marketing/home |
| `/drivers` | 200 (256 KB) | driver index, 2,365,496 profiles, DR/SR filter, paginated (Livewire) |
| `/player/<PSN>` | 200 / 404 if unknown | full driver profile (§4) |
| `/explore-events` | 200 (340 KB) | **live time-trial leaderboard, top 100** |
| `/events/archive` | 200 (141 KB) | past events |
| `/dailies` | 200 | current daily-race schedule; leaderboards only in Livewire modal |
| `/championships` + `/championships/<id>` | 200 (`/championships/197` = 991 KB) | championship standings/rounds |
| `/cars` (936 KB), `/tracks`, `/download`, `/discord-bot`, `/streamers`, `/about`, `/contact`, `/donate`, `/api-docs` | 200 | — |
| `/system-status` | timeout (curl 28, 0 bytes after 20 s) | flaky |

The `/dailies` leaderboard is **not** a scrapeable URL — it is rendered by Livewire:
```
<button wire:key="prev-daily-538" wire:click="openModal(538)" ...> View Leaderboard
$ curl -sS -o /dev/null -w "%{http_code}" https://gt-gridstats.com/dailies/538   -> 404
```
Scraping it would require replaying a `POST /livewire/update` with a valid Livewire
snapshot — fragile, and not demonstrated here.

---

## 6. Rate limits, quotas, terms

- **Limits (docs only, not verifiable anonymously):** metered endpoints `10 req/min`,
  `/api/assets/regions` "QUOTA FREE (30 req/min)"; daily cap example `X-Quota-Limit: 1000`;
  exceeding → `HTTP 429` "Quota Exceeded"; `X-Quota-Remaining` header decrements.
  **None of these headers or a 429 were observable without a token.**
- `POST /api/racers` warns of **3 s stagger per unindexed driver, up to ~48 s** for a
  16-driver batch — a slow-call hazard for a dashboard backend.
- Batch ceiling **16 identifiers** per call (§1 #8/#9).
- **Terms/legal:** footer states *"This site is not affiliated with Polyphony Digital or
  Sony Interactive Entertainment."* Data is re-published from "official Sony GT7
  endpoints" with "snapshots every 30 minutes". No published ToS for the API, no
  attribution requirement, no explicit rate/redistribution clause — the only stated route
  is the personal, manually approved early-access key.
- `access-control-allow-origin: *` is set on API responses (browser-callable once a token
  exists — which also means a token in front-end code would be exposed).
- Practical implication for the dashboard: **a token cannot be obtained today** (accounts
  "Coming soon"); the only viable no-token data source is HTML scraping of
  `/player/<PSN>` and `/explore-events`, which is unofficial and could break or be
  blocked at any time.

---

## Bottom line

- **10 endpoints** are documented, all `Authorization: Bearer` protected; **0 work
  anonymously** (all `401 {"message":"Unauthenticated."}`), including the "QUOTA FREE"
  regions endpoint.
- **A token cannot be self-served.** Registration is "Coming soon"; the documented route
  is to request an **early-access API key** via the `/contact` form / Discord / email.
- **The "3 Championship Analytics endpoints" badge is inaccurate** — only
  `/api/series-{series}/drivers/{psn_list}` exists, and it returns championship round
  **points**, not lap times or positions.
- For "given a PSN ID", **time-trial standings (lap time + global rank), daily-race
  rank/best-lap, and aggregate driver stats are available today without a token by
  scraping `/player/<PSN>` and `/explore-events`** — but **per-race finishing positions,
  fastest-lap counts, and full daily-race global leaderboards are NOT available** without
  an approved API key.
