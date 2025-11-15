# Cross-Browser Audio Playback Testing

**Feature**: Text-to-Speech Responses (Feature 010)
**Tasks**: T120-T124
**Created**: 2025-11-14

---

## Overview

This document provides comprehensive test procedures for validating audio playback across different browsers and devices. All tests should be performed on both desktop and mobile platforms.

---

## Test Environment Setup

### Prerequisites

1. **Local Development Server Running**:
   ```bash
   npx wrangler dev
   ```

2. **GraphMind Application Loaded**: Navigate to `http://localhost:8787` (or your dev URL)

3. **Test Audio Available**: Ensure voice query system is functional (Features 008, 009, 010)

4. **Network Connection**: Stable internet connection for WebSocket streaming

---

## T120: Chrome 34+ Audio Playback Test

### Desktop Chrome (Latest)

**Minimum Version**: Chrome 34+
**Recommended**: Chrome 120+ (latest stable)

#### Test Steps

1. **Open Application**:
   - Launch Chrome
   - Navigate to GraphMind application
   - Open Developer Console (F12)

2. **Basic Playback Test**:
   - Ask a voice query (or use text input)
   - Wait for answer generation
   - Observe audio playback begins automatically
   - Verify audio is clear and understandable

3. **Format Compatibility**:
   - In Console, check: `new Audio().canPlayType('audio/webm; codecs="opus"')`
   - Expected: `"probably"` or `"maybe"`

4. **Web Audio API Support**:
   - In Console, check: `typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined'`
   - Expected: `true`

5. **Playback Controls**:
   - Click **Pause** → Audio stops immediately
   - Click **Play** → Audio resumes from pause point
   - Click **Stop** → Audio stops, position resets

6. **Buffering & Streaming**:
   - Monitor Network tab for WebSocket messages
   - Verify `audio_chunk` messages streaming
   - Verify `audio_complete` message received
   - No audio stuttering or gaps

7. **Autoplay Behavior**:
   - Refresh page (before any user interaction)
   - Ask first query of session
   - Check if audio autoplays or requires click
   - Expected: May show "Click to play" on first load (browser autoplay policy)

#### Expected Results

- ✅ Audio plays back smoothly without stuttering
- ✅ WebM/Opus format supported natively
- ✅ Playback controls respond within 100ms
- ✅ Audio quality is clear and natural
- ✅ No console errors during playback

#### Known Issues

- **Autoplay**: Chrome may block autoplay on first visit. Click-to-play fallback should activate.

---

### Mobile Chrome (Android)

**Minimum Version**: Chrome Mobile 34+
**Test Device**: Android phone/tablet

#### Test Steps

1. **Open on Mobile Device**:
   - Launch Chrome on Android
   - Navigate to GraphMind (use ngrok or similar for HTTPS if needed)
   - Grant microphone permissions if testing voice input

2. **Basic Mobile Playback**:
   - Trigger a voice query
   - Verify audio plays through device speaker
   - Check volume controls work

3. **Background State Handling** (T105 validation):
   - Start audio playback
   - Switch to another app (home button or app switcher)
   - Expected: Audio pauses automatically
   - Return to GraphMind
   - Expected: Audio remains paused, Play button available
   - Click Play to resume

4. **Lock Screen Behavior**:
   - Start audio playback
   - Lock device screen
   - Expected: Audio pauses
   - Unlock device
   - Expected: Can resume playback

5. **Orientation Change**:
   - Start audio playback
   - Rotate device (portrait ↔ landscape)
   - Expected: Audio continues playing, UI adapts

#### Expected Results

- ✅ Audio playback works on mobile Chrome
- ✅ Background pause works (T105)
- ✅ Lock screen pause works
- ✅ Orientation changes don't interrupt playback
- ✅ Volume controls work

---

## T121: Safari 14.1+ Audio Playback Test

### Desktop Safari (macOS)

**Minimum Version**: Safari 14.1+
**Recommended**: Safari 17+ (latest)

#### Test Steps

1. **Open Application**:
   - Launch Safari on macOS
   - Navigate to GraphMind
   - Open Web Inspector (Cmd+Opt+I)

2. **Basic Playback Test**:
   - Ask a voice query
   - Wait for answer
   - Verify audio playback

3. **Format Compatibility**:
   - In Console: `new Audio().canPlayType('audio/webm; codecs="opus"')`
   - Expected: `"probably"` or `""` (empty string means may need fallback)
   - Note: Safari 14.1+ supports WebM/Opus, but older versions may not

4. **Web Audio API**:
   - In Console: `typeof AudioContext !== 'undefined'`
   - Expected: `true`

5. **Playback Controls**:
   - Test pause, resume, stop
   - Verify controls respond quickly (<100ms)

6. **Autoplay Policy**:
   - Safari is strictest with autoplay
   - First query may require user interaction
   - Verify click-to-play fallback appears

#### Expected Results

- ✅ Audio playback works (with possible autoplay restrictions)
- ✅ WebM/Opus supported (Safari 14.1+)
- ✅ Controls responsive
- ✅ Click-to-play fallback works if autoplay blocked

#### Known Issues

- **Autoplay**: Safari has strict autoplay policy. Always test click-to-play fallback.
- **Older Safari**: Versions <14.1 may not support WebM/Opus. Consider fallback format.

---

### Mobile Safari (iOS)

**Minimum Version**: iOS 14.5+ (Safari 14.1)
**Test Device**: iPhone/iPad

#### Test Steps

1. **Open on iOS Device**:
   - Launch Safari on iPhone/iPad
   - Navigate to GraphMind (HTTPS required for microphone)
   - Grant permissions

2. **Basic Mobile Playback**:
   - Trigger voice query
   - Verify audio plays
   - Check playback through device speaker

3. **Background State** (T105):
   - Play audio
   - Press home button → Expected: Audio pauses
   - Return to Safari → Expected: Paused, can resume

4. **Silent Mode Switch**:
   - Enable silent mode (hardware switch on iPhone)
   - Play audio
   - Expected: Audio still plays (not affected by silent mode for media playback)

5. **Bluetooth Audio**:
   - Connect Bluetooth headphones/speaker
   - Test audio playback routes correctly

#### Expected Results

- ✅ Audio works on iOS Safari
- ✅ Background pause functional
- ✅ Silent mode doesn't block playback
- ✅ Bluetooth audio routing works

#### Known Issues

- **Autoplay**: iOS Safari blocks autoplay aggressively. Always requires user gesture.
- **WebM/Opus**: Only supported on iOS 14.5+ (Safari 14.1+). Test device compatibility.

---

## T122: Firefox 25+ Audio Playback Test

### Desktop Firefox

**Minimum Version**: Firefox 25+
**Recommended**: Firefox 115+ (latest)

#### Test Steps

1. **Open Application**:
   - Launch Firefox
   - Navigate to GraphMind
   - Open Developer Tools (F12)

2. **Basic Playback**:
   - Ask voice query
   - Verify audio playback

3. **Format Compatibility**:
   - In Console: `new Audio().canPlayType('audio/webm; codecs="opus"')`
   - Expected: `"probably"`
   - Firefox has excellent WebM/Opus support

4. **Web Audio API**:
   - In Console: `typeof AudioContext !== 'undefined'`
   - Expected: `true`

5. **Playback Controls**:
   - Test all controls (pause, resume, stop)
   - Verify responsiveness

#### Expected Results

- ✅ Audio playback works smoothly
- ✅ WebM/Opus fully supported
- ✅ Controls responsive
- ✅ No compatibility issues

---

### Mobile Firefox (Android)

**Test Device**: Android with Firefox Mobile

#### Test Steps

1. **Open on Mobile**:
   - Launch Firefox on Android
   - Navigate to GraphMind

2. **Basic Playback**:
   - Test voice query and audio response

3. **Background State**:
   - Test app switching → Audio pauses
   - Test lock screen → Audio pauses

#### Expected Results

- ✅ Audio works on mobile Firefox
- ✅ Background handling works

---

## T123: WebM/Opus Format Compatibility Test

**Goal**: Verify WebM container with Opus codec is supported across all target browsers

### Browser Compatibility Matrix

| Browser | WebM/Opus Support | Minimum Version | Fallback Needed? |
|---------|------------------|-----------------|------------------|
| Chrome Desktop | ✅ Yes | 34+ | No |
| Chrome Mobile | ✅ Yes | 34+ | No |
| Safari Desktop | ✅ Yes | 14.1+ (macOS 11+) | Possibly (older versions) |
| Safari Mobile | ✅ Yes | 14.1+ (iOS 14.5+) | Possibly (older versions) |
| Firefox Desktop | ✅ Yes | 25+ | No |
| Firefox Mobile | ✅ Yes | 25+ | No |
| Edge | ✅ Yes | 79+ (Chromium-based) | No |

### Test Procedure

For each browser:

1. **Capability Detection**:
   ```javascript
   // Test in browser console
   const audio = new Audio();
   const webmOpus = audio.canPlayType('audio/webm; codecs="opus"');
   console.log('WebM/Opus support:', webmOpus); // "probably" or "maybe" = supported
   ```

2. **Actual Playback Test**:
   - Generate a voice query response
   - Verify audio plays without errors
   - Check Network tab for audio format
   - Verify no format conversion errors in console

3. **Audio Quality Verification**:
   - Listen to full playback
   - Check for artifacts, distortion, or corruption
   - Verify audio is clear and understandable

#### Expected Results

- ✅ All modern browsers return `"probably"` or `"maybe"` for WebM/Opus
- ✅ Audio plays back without errors
- ✅ Audio quality is consistent across browsers
- ✅ No transcoding or conversion needed

#### Fallback Strategy (if needed)

If a browser doesn't support WebM/Opus:
- Fallback to text-only mode (already implemented)
- Log browser/version for monitoring
- Consider adding MP3/AAC fallback in future phase

---

## T124: Autoplay Behavior Test

**Goal**: Verify autoplay restrictions are handled gracefully across all browsers

### Autoplay Policy Overview

Different browsers have different autoplay policies:
- **Chrome**: Allows autoplay after user interaction on domain
- **Safari**: Strictest - requires user gesture for first play
- **Firefox**: Similar to Chrome - allows after interaction

### Test Procedure

#### Test 1: First Visit (No User Interaction)

1. **Open Fresh Browser** (incognito/private mode):
   - Navigate to GraphMind
   - DO NOT click anything yet

2. **Trigger Audio**:
   - Use keyboard or external trigger (if possible)
   - Or ask voice query (microphone permission counts as interaction)

3. **Expected Behavior**:
   - **Chrome**: May autoplay (if mic permission granted) or show click-to-play
   - **Safari**: Likely blocked, shows click-to-play button
   - **Firefox**: Similar to Chrome

4. **Verify Fallback**:
   - If autoplay blocked, verify "Click to play" button appears
   - Click button → Audio should play
   - Verify audio doesn't start until user clicks

#### Test 2: After User Interaction

1. **Interact with Page**:
   - Click anywhere on page
   - Or complete first query with manual play

2. **Trigger Second Audio**:
   - Ask another query
   - Expected: Audio should autoplay (browser remembers permission)

3. **Verify**:
   - No click-to-play needed
   - Audio starts automatically

#### Test 3: Autoplay Settings

1. **Chrome Autoplay Settings**:
   - Navigate to `chrome://settings/content/sound`
   - Ensure site isn't blocked
   - Test with different settings

2. **Safari Autoplay Settings**:
   - Safari > Preferences > Websites > Auto-Play
   - Test "Allow All Auto-Play", "Stop Media with Sound", "Never Auto-Play"

#### Expected Results

- ✅ Autoplay blocked on first visit (browser policy) → Click-to-play fallback works
- ✅ Autoplay works after user interaction (subsequent queries)
- ✅ User can manually enable autoplay in browser settings
- ✅ Graceful handling - no errors, clear user feedback

#### Implementation Validation

Check AudioPlayer.jsx implementation:
- Detects autoplay block (`play()` promise rejection)
- Shows click-to-play button
- Remembers permission for session
- No audio starts without user permission

---

## Testing Checklist

Use this checklist to track completion of cross-browser testing:

### T120: Chrome 34+
- [ ] Desktop Chrome - Basic playback
- [ ] Desktop Chrome - Format compatibility
- [ ] Desktop Chrome - Playback controls
- [ ] Desktop Chrome - Autoplay behavior
- [ ] Mobile Chrome (Android) - Basic playback
- [ ] Mobile Chrome (Android) - Background state (T105)
- [ ] Mobile Chrome (Android) - Lock screen

### T121: Safari 14.1+
- [ ] Desktop Safari - Basic playback
- [ ] Desktop Safari - Format compatibility
- [ ] Desktop Safari - Playback controls
- [ ] Desktop Safari - Autoplay policy
- [ ] Mobile Safari (iOS) - Basic playback
- [ ] Mobile Safari (iOS) - Background state
- [ ] Mobile Safari (iOS) - Silent mode

### T122: Firefox 25+
- [ ] Desktop Firefox - Basic playback
- [ ] Desktop Firefox - Format compatibility
- [ ] Desktop Firefox - Playback controls
- [ ] Mobile Firefox (Android) - Basic playback
- [ ] Mobile Firefox (Android) - Background state

### T123: WebM/Opus Compatibility
- [ ] Chrome - Format detection
- [ ] Safari - Format detection
- [ ] Firefox - Format detection
- [ ] Edge - Format detection (bonus)
- [ ] All browsers - Actual playback test

### T124: Autoplay Behavior
- [ ] Chrome - First visit (no interaction)
- [ ] Chrome - After interaction
- [ ] Safari - First visit (strictest policy)
- [ ] Safari - After interaction
- [ ] Firefox - First visit
- [ ] Firefox - After interaction

---

## Test Results Template

Use this template to document test results:

```markdown
## Test Results: [Browser Name] [Version]

**Date**: [YYYY-MM-DD]
**Tester**: [Name]
**Device**: [Desktop/Mobile] [OS Version]
**Environment**: [Local/Production]

### Basic Playback
- [ ] Audio plays correctly: [YES/NO]
- [ ] Audio quality: [Excellent/Good/Poor]
- [ ] Latency: [<1s / >1s] after answer generation

### Format Compatibility
- [ ] WebM/Opus supported: [YES/NO]
- [ ] `canPlayType` result: ["probably" / "maybe" / ""]

### Playback Controls
- [ ] Play/Pause works: [YES/NO]
- [ ] Stop works: [YES/NO]
- [ ] Controls responsive (<100ms): [YES/NO]

### Autoplay
- [ ] First visit: [Autoplays/Blocked/Click-to-play]
- [ ] After interaction: [Autoplays/Blocked]

### Mobile-Specific (if applicable)
- [ ] Background pause works: [YES/NO]
- [ ] Lock screen pause works: [YES/NO]
- [ ] Bluetooth audio: [YES/NO/NOT TESTED]

### Issues Found
[List any issues, errors, or unexpected behavior]

### Screenshots/Videos
[Attach if relevant]
```

---

## Automated Testing (Future Enhancement)

While these tests are currently manual, consider automating with:
- **Playwright**: Cross-browser automated testing
- **BrowserStack**: Cloud-based device testing
- **Selenium WebDriver**: Browser automation

Example Playwright test structure:
```javascript
test('Audio playback in Chrome', async ({ page, browserName }) => {
  if (browserName !== 'chromium') return;

  await page.goto('http://localhost:8787');
  // Trigger query
  // Wait for audio element
  // Verify playback state
  // Test controls
});
```

---

## Notes

- **HTTPS Required**: Some features (microphone, autoplay) require HTTPS. Use ngrok for mobile testing.
- **Test Isolation**: Use incognito/private mode to test fresh session behavior
- **Version Verification**: Check actual browser versions, not just "latest"
- **Real Devices**: Test on actual mobile devices, not just emulators

---

## References

- [MDN: Web Audio API Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API#browser_compatibility)
- [Can I Use: WebM](https://caniuse.com/webm)
- [Can I Use: Opus](https://caniuse.com/opus)
- [Chrome Autoplay Policy](https://developer.chrome.com/blog/autoplay/)
- [Safari Autoplay Policy](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)
