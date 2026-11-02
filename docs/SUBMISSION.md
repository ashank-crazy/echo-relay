# Echo Relay

## Tagline

Chat's past becomes its next teammate. A Twitch time-loop puzzle that turns collective memory into a mechanic.

## Inspiration

A live audience is usually asked a single question: what should happen next?

We wanted to ask something stranger. What if chat could leave itself a favor? What if a crowd's earlier decisions could become a second player, and then a third? And what if a raid could carry a piece of one community's history into another stream?

That became Echo Relay: a cooperative puzzle played by one chat across several timelines.

## What it does

Viewers control a small robot through Twitch chat. Each beat, the crowd votes on a direction, a wait, or a rewind. One viewer gets one vote; changing your mind replaces your previous vote. Ties become a wait.

A rewind creates an echo that replays the crowd's exact recorded footsteps, then holds its final position. Those echoes are functional teammates. They stand on switches, hold doors, and make otherwise unreachable exits possible. The present has to coordinate with the choices the community made a few seconds earlier.

Three chambers build from one recorded helper to two intertwined timelines and a longer, winding escape. A visible move history and recorded paths let viewers reason about time together.

The relay goes beyond a single session. A streamer can export their community's echoes as a time capsule. Another streamer imports that file and solves the chamber with the first community's ghosts. It is a manual handoff that gives a raid something tangible to carry.

## How we built it

Echo Relay is a small, dependency-free browser application. Its deterministic simulation is separate from the renderer, the UI, and the Twitch transport. That separation lets us verify the puzzles against the same engine the audience actually plays.

The game connects through Twitch EventSub WebSockets and Helix with the `user:read:chat` scope. It validates authorization, handles duplicated notifications, transfers Twitch-directed reconnects, and removes moderated messages from pending ballots. Connection interruptions pause the game rather than advancing a live crowd's timeline without them.

The isometric chamber, robot, ghost routes, doors, portal, and ambient effects are original Canvas artwork. The optional sound is synthesized in the browser. The page includes keyboard controls, reduced-motion support, host timing controls, and a stream view for window capture in OBS.

Time capsules contain a bounded, validated set of recorded coordinates and contributor display names. Tokens stay in tab memory and never enter capsules or browser storage.

## How we used Codex

Codex was the build collaborator throughout: researching the challenge and current Twitch documentation, pushing the idea past a familiar audience-interaction concept, designing the puzzle mechanics, implementing the engine and procedural artwork, building the Twitch transport, and preparing tests and submission materials.

We used Codex to verify that each chamber has a working solution and that no exit is reachable while the required doors remain closed. It also built automated checks for echo timing, fair ballots, portable recordings, moderation, reconnects, and invalid inputs. Browser testing exercised the real movement controls and the first completed escape.

## Challenges

The central design challenge was keeping a time paradox understandable on a livestream. An echo therefore replays exact recorded positions and holds its last one. A visible timeline, labeled selves, and switch states make the rule readable without requiring every viewer to open another page.

The implementation challenge was keeping Twitch's asynchronous connection lifecycle separate from deterministic game time. The host owns the clock, votes are grouped into beats, repeated deliveries are deduplicated, and interruptions require an explicit resume.

## Accomplishments

We built a small game where the audience's shared history has a concrete role in solving the puzzle. A first-time viewer can understand the basic rule in one short chamber, while a returning community can recognize its earlier selves in a future run.

The game includes three solvable chambers, functional ghost teammates, a portable community-memory format, original procedural art, and a tested Twitch transport without requiring a server or runtime AI bill.

## What we learned

A useful way to design for a crowd is to give its decisions consequences that remain legible after the moment has passed. Recording the path, rather than just showing a vote total, gives a community something it can recognize as its own.

## What's next

Community-authored chambers, an authenticated capsule library, and an optional automatic handoff when a streamer raids another participating channel. Those are future directions; the current handoff uses exported JSON capsules.

## Submission fields still to complete

- **Repository URL:** https://github.com/ashank-crazy/echo-relay. If private, share it with the judging account specified in the official rules.
- **Demo video URL:** record real footage on Twitch, include how Codex was used, keep it below three minutes, and upload it to YouTube with a watchable public or unlisted link.
- **Codex session ID:** confirm using `/status` in the main build chat. The desktop build thread ID returned in this session is `01a19bce-8df8-75e0-8011-aef9a670b13e`.
- **Working demo:** the hosted Site starts private. Local play works from the repository without sign-in. Decide whether to share the hosted Site for judging.
- **Final acceptance check:** connect an authorized Twitch channel and have a second account submit commands on stream. Automated Twitch checks use a mock transport and do not substitute for this recording.
- **Entrant details and submission:** confirm eligibility, teammates, ownership, and the exact form fields yourself before submitting. The project has not been entered on Devpost.

Deadline listed by the organizer: November 2, 2026 at 2:00 PM PST, equivalent to **November 3, 2026 at 3:30 AM IST**. [Challenge](https://twitchcon-codex.devpost.com/), [rules](https://twitchcon-codex.devpost.com/rules), [final-weekend checklist](https://twitchcon-codex.devpost.com/updates/47341-final-weekend-make-your-project-come-alive).
