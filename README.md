# Echo Relay

**Your past is part of the team.**

A Twitch time-loop puzzle in which a community cooperates with recordings of its own earlier decisions. Chat controls a small robot. Rewinding turns its route into an independent echo that repeats those footsteps, then holds its final position. The present can only reach the exit by leaving its past selves on switches.

Time capsules carry those recorded selves between streams: one community can leave a favor for the next. This handoff is a downloadable/importable JSON file, not an automatic Twitch raid integration.

Built with OpenAI Codex for the Codex × TwitchCon Hackathon, November 2, 2026.

## Play immediately

Requires Python 3. No package installation, API key, build, or paid service is needed for local play.

```sh
python3 -m http.server 4319 --directory dist --bind 127.0.0.1
```

Open **http://localhost:4319/**. Alternatively, `npm start` runs the same server.

Use the movement buttons or arrow keys, **Space** to wait, and **R** to rewind. The board is isometric: the compass in its lower left explains how the map directions project onto the screen. Click **Watch the paradox** for a clearly labeled simulated-chat demonstration that solves the actual puzzle. No live Twitch activity is fabricated.

Three chambers are included:

1. **First contact:** record one echo to hold a door for your present self.
2. **Second opinion:** coordinate two recorded timelines and the present.
3. **The long way home:** route three selves through a longer chamber with two relays.

## Connect a real Twitch channel

The game uses Twitch's recommended **EventSub WebSocket** transport and the Helix API. It reads commands and moderation events. It never posts in chat.

1. Open the [Twitch developer console](https://dev.twitch.tv/console/apps/create) and register a **Public** application. A client ID is public configuration; do not provide a client secret.
2. Add the exact OAuth redirect URI displayed inside the game's **Connect Twitch → First time?** instructions. For the local URL above, it is `http://localhost:4319/`. On a hosted version, register its exact HTTPS URL, including the trailing slash.
3. Enter your channel and public client ID in **Connect Twitch**, then click **Sign in with Twitch**. The only permission requested is `user:read:chat`.
4. After authorization, the game validates the token, resolves the channel, and subscribes to chat plus message-deletion and chat-clear events.
5. Tell viewers the commands, then click **Start the clock**. The default beat lasts **8 seconds**, allowing time for stream delay. Host tools offer 3, 5, 8, 12, and 20 seconds. Use Twitch low latency for the shorter settings.

An existing user access token with `user:read:chat` can also be pasted into the advanced connection section. Its app must match the entered client ID; leave the client ID blank to use the one returned by Twitch's token validation endpoint. IRC's `chat:read` scope is a different permission and is not sufficient.

Tokens remain in tab memory and are transmitted only to Twitch. They are removed from the OAuth URL fragment immediately and are never written to browser storage, source files, or time capsules. Refreshing the page requires reconnecting. OAuth uses a cryptographically random state value and fails closed when it does not match. Tokens are revalidated hourly during an active connection.

Official references: [browser OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#implicit-grant-flow), [EventSub WebSockets](https://dev.twitch.tv/docs/eventsub/handling-websocket-events/), [chat event authorization](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage).

## Crowd rules

| Command | Effect |
| --- | --- |
| `!up`, `!right`, `!down`, `!left` | Vote to move one map tile |
| `!wait` | Hold the present still while echoes advance |
| `!rewind` | Record this loop and restart alongside its echo |

Each Twitch user ID has one vote per beat. A later command replaces that viewer's earlier vote. A unique majority wins. Ties and empty ballots become a wait, avoiding directional bias. Commands must be the first word of the message and match exactly; `!upgrade` does nothing. The host's local button is also only one vote in live mode.

Switches **A** and **B** open their matching doors while occupied by the present or an echo. Echoes replay recorded positions, one per beat, and then hold the final position. They do not get resimulated against changed doors. A blocked move still consumes a beat. Reaching the beat limit automatically records an echo and rewinds. There are three echo slots; the fourth recording replaces the oldest.

The clock pauses when the connection is interrupted or reconnected. The host explicitly resumes it after the network recovers. Duplicate Twitch deliveries are ignored. Moderator deletions remove the corresponding pending ballot entry; clearing chat clears the ballot. Previously executed game actions are not rolled back by moderation.

## Stream and OBS

Use **Host tools → Stream view**, then capture this running browser window in OBS with **Window Capture** or screen sharing. Press **Escape** to restore the page. The expand control also supports fullscreen.

A separate OBS Browser Source is a separate browser session; it does not automatically inherit this tab's authorization or game state. Connect that session separately if using one. There is no server-side session synchronization in this version.

## Time capsules

After recording at least one echo, click **Bottle this timeline** to download a small JSON file. Another streamer can use **Host tools → Import** to bring those echoes into the matching chamber. The imported present starts at the origin. Capsules include recorded coordinates and contributor display names, but no access tokens or Twitch app credentials. Review the file before sharing it.

Imports are bounded to 128 KB, three echoes, and the chamber's beat limit. Invalid formats, walls, fractional coordinates, and teleporting paths are rejected before changing the current game. Capsules are a collaborative handoff format, not a cryptographic proof of a legitimate playthrough.

The last recorded echoes are saved locally on the current browser and restored on refresh. An unfinished present route starts again at the origin. Changing chambers clears that chamber's current route and echoes after an in-app confirmation. There is no global account, database, or cross-device save service.

## Validate

Node.js **24+** is used for the test runner and its mock APIs. The browser app itself is dependency-free.

```sh
npm run check
npm test
```

The tests cover real solutions for all three chambers, unreachable exits without switch support, echo replay and holding, automatic rewinds, bounded recording replacement, portable capsule completion, invalid imports, per-viewer voting and ties, exact command parsing, token validation, moderation events, delivery deduplication, reconnect transfers, revocation, and subscription failures. Twitch tests use a controlled mock transport. A real-channel acceptance check still requires the streamer's authorization.

## Source map

| File | Responsibility |
| --- | --- |
| `dist/engine.js` | Deterministic puzzle engine, chamber data, ballots, capsule validation |
| `dist/scene.js` | Original isometric Canvas artwork, robots, ghosts, routes, and effects |
| `dist/twitch.js` | Twitch authorization validation, Helix subscriptions, EventSub lifecycle |
| `dist/app.js` | UI, local play, timed live votes, demo, sound, storage, import/export |
| `dist/style.css` | Responsive visual design and reduced-motion support |
| `tests/` | Simulation and Twitch-transport tests |
| `docs/SUBMISSION.md` | Ready-to-edit Devpost project copy and remaining submission fields |
| `docs/DEMO-SCRIPT.md` | A recording plan under three minutes |

All chamber art is generated from original Canvas geometry. Sound is synthesized with Web Audio. Fonts are DM Sans and IBM Plex Mono, loaded from Google Fonts with system fallbacks; gameplay works if the font request is unavailable. The project contains no third-party game assets, copyrighted music, runtime model calls, or secrets.

## Built with Codex

Codex helped research the challenge and Twitch API requirements, develop the time-loop concept, implement the deterministic simulation and original renderer, build the browser UI, write and run the checks, exercise the game through browser controls, and prepare the submission material. The concept evolved from a conventional shared garden into a game where a crowd's previous choices become functional teammates.

Codex desktop build thread ID: `01a19bce-8df8-75e0-8011-aef9a670b13e`. Confirm the required session ID using `/status` when entering the Devpost form.

## License

MIT. See [LICENSE](LICENSE).
