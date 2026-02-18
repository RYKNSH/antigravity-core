# Tauri & WebView Audio Diagnostic Patterns

This document captures reusable diagnostic patterns for troubleshooting audio issues in Tauri applications, specifically when dealing with cross-origin restrictions, CSP, or platform-level audio routing problems.

## 1. Hardware-Level Verification (The Beep Test)

This test ignores the network and standard media elements (`<audio>`, `<iframe>`) and uses the Web Audio API to generate a sine wave directly. If this works, the problem is likely higher up the stack (e.g., CSP or Protocol).

### Code Pattern (React/TypeScript)

```typescript
/**
 * Generates a 1-second sine wave (440Hz) using direct Web Audio API.
 * This skips network and standard media tag restrictions.
 */
const runBeepTest = async () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API not supported in this environment');
    }

    const ctx = new AudioContextClass();
    
    // Crucial: AudioContext is often 'suspended' until a user gesture (click).
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 440; // A4
    osc.type = 'sine';
    gain.gain.value = 0.5;

    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 1000);

    console.log(`Audio Beep Started. State: ${ctx.state}`);
  } catch (e) {
    console.error('Beep Test Failed:', e);
  }
};
```

## 2. Network & Decoding Verification (The MP3 Stream Test)

This test verifies if the application can fetch external assets and decode them into an audio buffer. This is useful for bypassing limitations in the `<audio>` tag's OS-level audio output routing.

### Code Pattern (React/TypeScript)

```typescript
/**
 * Fetches an MP3, decodes it in memory, and plays it via AudioContext.
 * Bypasses the standard <audio> tag stream routing.
 */
const runMp3StreamTest = async (url: string = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass();
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // 1. Fetch binary data
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const arrayBuffer = await response.arrayBuffer();
    
    // 2. Decode into AudioBuffer
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    
    // 3. Play back via BufferSource
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start(0);
    
    console.log('MP3 Stream Playback Started via AudioContext');
  } catch (e) {
    console.error('MP3 Stream Test Failed:', e);
  }
};
```

## 3. Tauri Localhost Plugin Bridge

When external iframes (like YouTube) refuse to load from `tauri://localhost`, you can bridge them through a standard HTTP origin.

- **Dependency**: `tauri-plugin-localhost`
- **Port**: 1421 (standard for this project)

### Registration (`lib.rs`)

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_localhost::Builder::new(1421).build())
    // ...
```

### Purpose
Converts the internal app origin to `http://localhost:1421`, which is accepted as a valid HTTP origin by most media platforms (YouTube, Spotify, etc.) that would otherwise reject `tauri://` schemes.

## 4. Multi-Layered Diagnosis (Isolation Tiers)

1. **Tier 1 (Surface)**: Check for console errors related to CSP (Content-Security-Policy).
2. **Tier 2 (Logic)**: Verify state changes (Is the `playing` state actually reaching the player?).
3. **Tier 3 (Protocol)**: Check if switching from `tauri://` to `http://localhost` fixes the issue.
4. **Tier 4 (Hardware)**: Run the **Beep Test**. If this fails, the issue is OS-level or WebView-global.
5. **Tier 5 (Workaround)**: Fetch and decode raw MP3s if standard media tags are failing but `AudioContext` is working.
