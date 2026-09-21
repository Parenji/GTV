# GT7 official web API — verified findings (no PSN login)

All results below were reproduced with `curl` on 2026-09-21 from this machine.
Nothing is inferred from third-party code; every endpoint was executed and the
raw response captured.

## VERDICT: **PARTIALLY**

The official GT7 web backend (`web-api.gt7.game.gran-turismo.com`) serves
**event metadata and Time Trial leaderboards with NO authentication**.
Everything player-specific (sport-mode history, DR/SR profile, paginated /
per-player ranking, friend ranking) sits behind a PSN-issued bearer token.

| Goal | Obtainable without login? |
|---|---|
| (a) current Time Trial: board id + top-100 lap times + rank + total entrants | **YES** (top 100 only; no per-PSN lookup) |
| (a) a *specific* PSN ID's rank if outside the top 100 | **NO** |
| (b) Daily Races qualifying/race leaderboards | **NO** — no such board exists in the API |
| (c) player sport-mode history / past races / DR-SR history | **NO** (401) |
| bonus: DR/SR letters for top-100 TT players | YES (embedded in the leaderboard) |
| bonus: championship (GTWS) season + user rankings | YES (public static JSON) |

## Host discovery

`https://www.gran-turismo.com/us/gt7/sportmode/` is an SPA shell (22675 bytes,
identical for `/event/`, `/championship/`, `/archives/`, `/season_all/`). Its boot
block contains:

```js
var __INIT__ = { IS_SIGNED_IN:false, LOCALE_URL:'us', COUNTRY:'US', LANGUAGE:'en',
                 API_STAGE:'gt7', BASE_DOMAIN:'game.gran-turismo.com', TOKEN:'', ... };
```

`data-base-domain="game.gran-turismo.com"` is only a *suffix*. The bundle
(`/common/dist/gt7/companion/app.js`, 1,565,666 bytes) builds:

| client | base |
|---|---|
| event | `https://web-api.{stage}.{base_domain}/event` |
| ranking | `https://web-api.{stage}.{base_domain}/ranking` |
| user | `https://web-api.{stage}.{base_domain}/user` |
| stats | `https://web-api.{stage}.{base_domain}/stats` |
| championship | `https://web-api.{stage}.{base_domain}/championship` and `https://static.{stage}.{base_domain}/championship` |

`{stage}=gt7`, `{base_domain}=game.gran-turismo.com`, i.e. the real host is
**`web-api.gt7.game.gran-turismo.com`**. (`game.gran-turismo.com` itself does not
resolve.) All methods are **POST with a raw JSON body** and
`Content-Type: application/json`.

## Confirmed auth wall

```bash
curl -sS "https://www.gran-turismo.com/us/gt7/info/api/token/" -H "User-Agent: curl/8"
```
→ `200`
```json
{"is_signed_in": false, "stage": "gt7", "base_domain": "game.gran-turismo.com", "access_token": ""}
```

No token is issued to an anonymous visitor → the `Authorization: Bearer` header the
generated client adds can never be populated without a PSN sign-in.
`POST https://www.gran-turismo.com/us/api/gt7/auth/token` → **403**.

Every protected call returns HTTP **401** with error code **-1358757886**:

```bash
curl -sS -X POST https://web-api.gt7.game.gran-turismo.com/stats/get_sport_race \
  -H "Content-Type: application/json" \
  --data '{"user_id":"22c57596-cc7c-42d7-bc7b-5b904380040e","type_list":[1,2]}'
# {"error":{"code":-1358757886}}   [status=401]
```

| endpoint | status |
|---|---|
| `POST /ranking/get_list_by_page` | 401 |
| `POST /ranking/get_list` | 401 |
| `POST /ranking/get_list_friend` | 401 |
| `POST /stats/get_sport_race` | 401 |
| `POST /stats/get_history` | 401 |
| `POST /stats/get` | 401 |
| `POST /user/get_sport_profile` | 401 |
| `POST /user/get_user_profile` | 401 |
| `POST /user/get_user_profile_by_user_id` | 401 |

Only `/ranking/get_top_list`, `/event/get_folder`, `/event/get_parameter` and the
static championship JSONs are anonymous.

## (a) Time Trial — WORKING, unauthenticated

### 1. Find the current Time Trial board id

```bash
curl -sS -X POST "https://web-api.gt7.game.gran-turismo.com/event/get_folder" \
  -H "User-Agent: curl/8" -H "Content-Type: application/json" \
  --data '{"region_id":6,"folder_id":249}'
```
→ `200`, 250,510 bytes, **212 events** (current + full archive back to 2023).
Raw head of response:
```json
{"result":[{"event_id":14848,"parameters":{...,"online":{"begin_date":"2026-09-17T07:00:00Z","end_date":"2026-10-01T06:59:59Z","ranking_id":"p_rt_1014848_001"},...
```
Current event (2026-09-21): **event_id 14848**, board **`p_rt_1014848_001`**,
2026-09-17 → 2026-10-01. The per-event detail is also public:

```bash
curl -sS -X POST .../event/get_parameter -H "Content-Type: application/json" --data '{"event_id":14848}'
# 200, 1160 bytes, same parameters object
```

Region ids (from `app.js`): `2`=Europe, `4`=Asia, `5`=Oceania, `6`=North America
(US/CA), `7`=South America. `us` → **6**. `folder_id` **249** is the only folder
that exists (I scanned 1–259; every other id returns `400`).

### 2. Read the leaderboard

```bash
curl -sS -X POST "https://web-api.gt7.game.gran-turismo.com/ranking/get_top_list" \
  -H "User-Agent: curl/8" -H "Content-Type: application/json" \
  --data '{"board_id":"p_rt_1014848_001"}'
```
→ `200`, 54,971 bytes. Raw head:
```json
{"result":{"list":[{"board_id":"p_rt_1014848_001","display_rank":1,"line_replay_id":"p_rt_1014848_001/22c57596-cc7c-42d7-bc7b-5b904380040e/112486","ranking_stats":{"car_code":2139,"color":4,"style_id":19422538594288451},"replay_id":23785613399216772,"score":112486,"update_time":"2026-09-18T12:13:57Z","user":{"country_code":"AU","is_hidden_nickname":false,"is_valid_user":true,"nick_name":"holl01","np_online_id":"MetalGear9493","user_id":"22c57596-cc7c-42d7-bc7b-5b904380040e","driver_rating":6,"is_star_player":false,"manufacturer_id":5,"sportsmanship_rating":6}},...
```

Shape: `result.total` = number of entrants (**85,865**, live), `result.list` = the
top **100** only. Per entry:

* `display_rank` — global rank (1…100)
* `score` — **lap time in milliseconds** (112486 → 1:52.486)
* `user.np_online_id` — **PSN ID**; `user.user_id` — internal UUID
* `user.nick_name`, `user.country_code`, `user.driver_rating`, `user.sportsmanship_rating`
* `ranking_stats.car_code`, `color`, `style_id`; `replay_id`, `update_time`

Archived boards work identically, e.g. `{"board_id":"p_rt_1014739_001"}` → `200`,
`total: 161703`, rank 1 `SFE_Damian` / 80044 ms.

**Limitation for "rank per player":** `get_top_list` ignores extra parameters
(`"page":1` and `"user_id":"…"` both returned the same top 100 from rank 1). There
is **no anonymous per-PSN lookup**; a player outside the top 100 cannot be located
without signing in (that path is `get_my_rank` / `get_list_by_page`, both 401).
An unknown `board_id` returns `200 {"result":{"list":[],"total":0}}`, not an error.

**Which archive boards exist:** `get_folder` returns `online.ranking_id` for all 212
Time Trials; prefixes observed in region 6: `p_rt` ×209, `p_rtt` ×2, `p_rto` ×1.
The `_NNN` suffix after the event id is the board sequence (e.g. `p_rt_1014848_001`);
for "registered" events the app appends an area code, e.g. `<ranking_id>_<area>`.

## (b) Daily Races — NOT AVAILABLE

Evidence gathered:

1. `get_folder` accepts exactly one `folder_id` in the whole product. Scanning
   ids 1–259 returned **200 only for 249** (Time Trial); all others `400`.
2. The 212 events in folder 249 are all time-attack events — title keys
   `OnlineTA_*`, ranking ids `p_rt*`. No daily-race events.
3. `app.js` contains **no** `p_rd` / `OnlineDR` / `DailyRace` string, and the
   `/sportmode/` HTML has **zero** occurrences of "daily".
4. The redux reducers `setDailyRace` / `setCalendarData` and the state field
   `dailyRaceList` appear **only in their own definitions** (2–3 occurrences each,
   never dispatched) — dead code inherited from GT Sport. Likewise
   `get_calendar_list` is unreachable: every body I tried
   (`{"region_id":6}`, `{…folder_id:249}`, date ranges) returns
   `400 {"error":{"code":-1358282496}}`.

So the official site exposes no Daily Races (Race A/B/C) leaderboard at all; the
GT7 Sport Mode web page renders only Time Trial + Championships. **Only the
in-game client has that data.**

## (c) Sport-mode history / DR-SR history — NOT AVAILABLE

`/stats/*` is the correct service (base
`https://web-api.gt7.game.gran-turismo.com/stats`), used by the profile page via
`getHistory({user_id, year, month})` and `getSportRace({user_id, type_list:[1,2]})`
plus `get_user_profile` / `get_sport_profile`. All return **401
`{"error":{"code":-1358757886}}`** anonymously, with a valid `user_id` taken from
the public leaderboard. The token is only obtainable after PSN OAuth
(`ca.account.sony.com/api/authz/v3/oauth/authorize?...redirect_uri=…/us/signin/`).
This matches the public GTPlanet thread on the same topic (DR/SR only visible on a
signed-in profile page).

## Bonus: championship (GTWS) — public

* `GET https://static.gt7.game.gran-turismo.com/championship/seasons/6/active.json` → `200`, JSON
* `GET https://static.gt7.game.gran-turismo.com/championship/seasons/6/all.json` → `200`, JSON
* `GET https://static.gt7.game.gran-turismo.com/championship/user_ranking/1720/1/w1.json`
  → `200 {"result":{"current_round_id":1,"total_user_count":138,…,"users":[{"rank":101,"total_point":116,"user":{"np_online_id":"LMRT_TEFO","driver_rating":5,"sportsmanship_rating":6,…}}]}}`
* `GET https://www.gran-turismo.com/us/gt7/json/championship_json/` → `200`, season/car/schedule JSON

(Paths `/championship/{season_id}/{league_id}/{manufacturer}/.../w{page}.json` and
`/manufacturer_ranking/{global_ranking_id}/{league_id}/w{region_id}.json` are in
`app.js`; only the `user_ranking` one was executed.)

## Rate limits / operational notes

* `POST /ranking/get_top_list` returns these headers:
  `X-RateLimit-Limit: 100`, `X-RateLimit-Remaining: 96`, `X-RateLimit-Reset: 4`.
* 8 rapid requests all returned `200` (no 429 seen).
* **A 259-request sweep of `/event/get_folder` tripped a WAF/IP block:** the whole
  `/event/*` service returned `403 Forbidden` (nginx/awselb HTML, 118 or 520 bytes)
  for **≈180 s**, while `/ranking/*` kept answering `200`. Recovery confirmed by
  polling: `03:30:36 403 … 03:33:10 200` (recovered after 180 s).
  → keep to well under ~100 calls per window, and back off on 403, not just 429.
* Headers actually required: only `Content-Type: application/json` and any
  `User-Agent` (no `Origin`/`Referer`/cookies needed). Omitting Content-Type →
  `400 {"error":{"code":-1357691648}}`. GET instead of POST → `404 {"message": "not found"}`.
* `Access-Control-Allow-Origin: *` on the API responses, so browser clients work.
* No cookies are required for the anonymous endpoints (only the `www.gran-turismo.com`
  HTML/token pages set `JSESSIONID`, which is irrelevant to the API host).

## Minimal working recipe (a)

```bash
# 1) current Time Trial board
curl -s -X POST https://web-api.gt7.game.gran-turismo.com/event/get_folder \
  -H 'Content-Type: application/json' --data '{"region_id":6,"folder_id":249}'
# 2) top-100 leaderboard for that ranking_id
curl -s -X POST https://web-api.gt7.game.gran-turismo.com/ranking/get_top_list \
  -H 'Content-Type: application/json' --data '{"board_id":"p_rt_1014848_001"}'
```
