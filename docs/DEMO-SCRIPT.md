# Echo Relay — demo recording plan

Target runtime: **2 minutes 45 seconds**. Record the actual Twitch-connected session and show real chat commands. The guided demo is useful for rehearsal, but it is labeled simulated chat and is not a replacement for the challenge's required Twitch footage.

## Before recording

1. Run the app, connect your authorized Twitch account and channel, and prepare a second viewer account to type commands.
2. Turn on Twitch low latency and choose an appropriate beat duration. Three-second beats are suitable only with sufficiently low delay; otherwise use five or eight seconds and trim idle portions in the edit.
3. Select **First contact**. Reset the chamber. Open stream view and use OBS Window Capture on the same running tab.
4. Keep the Twitch chat beside the captured game or include it as a visible OBS source. Ensure the connection status shows your actual channel.
5. Have the Codex build chat, engine tests, and repository setup instructions ready for the final segment. Do not show access tokens or account secrets.

## 0:00–0:18 — the hook

**Visual:** Start with one echo holding A while the present passes through the door. Show the real Twitch chat next to the game.

**Narration:** “What if Twitch chat could cooperate with itself from thirty seconds ago? In Echo Relay, every rewind turns the crowd's last decisions into a real teammate.”

## 0:18–0:38 — the rule

**Visual:** Reset or cut to a clean recording. Show viewers posting movement commands and the ballot count changing.

**Narration:** “Chat controls one robot. Each viewer gets one vote per beat. Most votes wins. We need to reach that portal, but there's a door between us and the exit.”

**First recording:** `!right`, `!down`, `!down` puts the robot on A.

## 0:38–1:08 — the reveal

**Visual:** Chat posts `!rewind`. The purple echo appears. In the next loop, show the echo walking back onto A while the lime present takes a different route.

**Narration:** “So we leave a favor for our future self. Rewind, and our old route becomes an echo. It repeats our footsteps and holds the switch. Our past opens the door. Our present gets to leave.”

**Present's solution:** `!down`, `!down`, `!right`, `!right`, `!right`, `!right`, `!up`, `!up`, `!right`, `!right`.

## 1:08–1:33 — the escalation

**Visual:** Cut to **Second opinion** with two real recorded echoes. Let both switches activate, then show the present passing through both doors. This can be recorded in advance during the same authorized live session.

**Narration:** “The next chamber needs two echoes. Now the audience has to choreograph three versions of itself. Waiting can be the right move, because the past keeps going even when the present stands still.”

## 1:33–1:58 — the relay

**Visual:** Export a capsule, import it into another clean game session, and show those same echoes functioning. Identify this as a manual time-capsule handoff.

**Narration:** “A raid usually carries viewers. Here it can carry memory. Bottle your community's echoes and pass the file to another streamer. Their chat finishes the puzzle with your chat's ghosts.”

## 1:58–2:30 — made with Codex

**Visual:** Show the actual Codex conversation, the relevant engine implementation, browser check, and passing tests. Keep credentials out of frame.

**Narration:** “I built Echo Relay with OpenAI Codex—from pushing the concept past a conventional chat game, to writing the deterministic simulation, original procedural artwork, and Twitch EventSub connection. Codex helped verify every chamber's solution, ghost replay, voting fairness, capsule handoffs, and reconnect behavior.”

## 2:30–2:45 — close

**Visual:** Back to the completed chamber with the real live connection visible. Finish on the project title.

**Narration:** “One chat, across time. Your past is part of the team.”

## Upload checklist

- Less than three minutes, with footage functioning on Twitch and footage of the Codex build process.
- Public or unlisted YouTube video; verify the link opens for another viewer.
- No copyrighted music; use the game's original synthesized tones or clean narration.
- No tokens, secrets, or unrelated private browser content in the recording.
- Add the repository URL, written description, video URL, and required Codex session ID to Devpost, then complete submission before the deadline.
