# Tauri Audio Saga: From Refactor to Resolution

## Part 1: The War with IFrame Security (2026-01-29)

It started as a simple feature for "Portable Studio": a BGM player to keep the focus in the zone. Lo-Fi HipHop, Coffee Shop Jazz—how hard could it be to embed a YouTube IFrame?

**The Ghosts of Error 150 and Error 39**
The first attempt was silent. Debug logs were filled with Error 150 (Embedding Forbidden) and Error 39 (Connection Error). Since Tauri apps run on the custom `tauri://localhost` protocol, YouTube's security wall blocked the request as "untrusted."

**The Temptation of "Clever Hacks"**
We tried every trick in the book:
- Injecting `origin: 'http://localhost'` manually.
- Hiding the identity with `referrerPolicy="no-referrer"`.
- Manually triggering `postMessage` to override the SDK.

The code became a mess of "band-aids." It worked in the browser but failed in the build. We were fighting the platform instead of working with it.

**The `as any` Defeat**
The breaking point was writing `as any` just to silence the TypeScript compiler's protests about invalid properties in the `react-player` config. It was a surrender of engineering integrity. We decided to stop the patches and refactor—clean the state, separate the logic, and find the *real* solution.

---

## Part 2: Breaking the Silence (2026-01-30)

Even after refactoring and fixing CSP settings, there was silence. The video played, the time bar moved, but the speakers remained dead. This is when we moved to **Diagnostic Tiering**.

**Tier 4: The Hardware Call (Web Audio API)**
Before blaming YouTube again, we asked: "Can this app even make sound?"
We bypassed the network and iframes entirely. We used the browser's internal synthesizer—the Web Audio API—to generate a pure sine wave (a beep).

```typescript
const ctx = new AudioContext();
const osc = ctx.createOscillator();
osc.start(); // Rise, audio!
```

It beeped. The app could speak. The problem was specifically in the communication bridge with external giants like YouTube.

**The Localhost Bridge (The Partial Success)**
YouTube refused to trust the `tauri://` protocol. We integrated `tauri-plugin-localhost` to serve the app over `http://localhost:1421`. It allowed the video to load, but a new ghost appeared: **The Silent IFrame**. Even with the player visible and manually clicked, the sound remained trapped in the container.

**The Pivot: Direct Control vs. Black Box**
We realized that the WebView's security model was treating `HTMLMediaElement` (the `<video>` inside the iframe) differently from the **Web Audio API**. While the former was being muted by the engine's opaque policies, the latter—the one powering our Pomodoro beeps—had a clear path to the hardware.

The decision was clear: Stop fighting the black box of YouTube's IFrame. We pivoted to a **Direct MP3 Proxy Strategy**. By fetching MP3 streams and processing them directly via `AudioContext.decodeAudioData()`, we gained full control over the audio pipe.

**The True Melody of Victory**
We finally broke the silence. We didn't solve it by finding more YouTube parameters, but by:
1. Proving the hardware path with basic oscillating beeps.
2. Identifying the specific failure of standard media tags vs. Web Audio API.
3. Switching to a "Transparent Playback" model where the app, not an external iframe, owns the bytes.

Refactoring wasn't a detour; it was the essential clearing of ground required to see the real architecture of the problem.

---

## Part 3: The Silent Decision (The Final Cut)

Even after achieving "Transparent Playback" through direct binary processing, the BGM player remained a source of architectural friction. Each minor update to the WebView engine or a change in YouTube's headers threatened to break the silence once more.

**The Clarity of Deletion**
In a move for radical simplicity, we decided to delete the BGM player entirely. 

It wasn't a failure of technology—we had proven we could make it work. It was a victory of **Product Focus**. Portable Studio isn't a music app; it's a focus tool. By removing the brittle dependency on external audio streams, we reclaimed:
1. **Security Surface**: We could tighten CSP settings and remove `localhost` plugins that were only there for the IFrame.
2. **Bundle Size & Logic**: Removed hundreds of lines of Zustand actions and complex React components.
3. **Mental Clarity**: The developer (and the user) no longer needs to debug Error 150.

The "Audio Saga" ends not with music, but with the quiet, focused confidence of a leaner, more robust application.

---
*参照: 2026-01-30 BGM Player Removal Task.*
