# eXpand (beta)

A Chromium extension that reclaims the wasted space on X (x.com). Works in Chrome, Brave, Edge and other Chromium browsers.

**Beta.** It's in daily use and stable for its author, but X changes its markup often and only a handful of setups have been tested. Expect the occasional rough edge, and please report what you see.

- **Wider center column.** X hard-codes the timeline to 600px. eXpand un-clamps it: default 1200px, adjustable 600–1600px, or fill the window.
- **Icons-only left nav.** The link labels collapse, leaving the 88px icon rail.
- **Right sidebar hidden** (or trimmed to just the search box).
- **Bigger media.** Images and videos are sized relative to the column, so they grow with it. At the default 1200px they're about twice their stock size.
- **Auto-expand “Show more”.** Long posts are truncated in the timeline. eXpand presses X's own “Show more” button for you, unless the full post would render taller than your limit (default 15 lines). It measures the real height by laying the full text out at the column's width, so line breaks count as much as characters. The full text comes from the `note_tweet` field in X's own timeline API responses.
- **Bigger portrait videos.** Phone-shot 9:16 videos are tiny in the timeline. eXpand can crop them to a wider shape (3:4 by default, or 4:5 or square), keeping the middle of the frame, so they can use the column's height. A hover button on each cropped video switches it to the full frame, and fullscreen always shows the whole video.
- **Taller photos.** X caps timeline photos at 510px tall, so portrait images barely grow with a wider column. eXpand rescales them up to a configurable max height (default 800px).

- **Dim theme.** The classic blue-gray Dim, brought back as a remap of X's Lights out colors. Set X to Lights out and pick Dim in the popup.
- **Declutter.** Hide promoted posts (on by default), the Home composer, the feed tab bar, view counts, reply/repost/like counts, the Grok button on posts, and individual left-nav items (Grok, Premium, Creator Studio, History, Communities, Jobs).

## Install (unpacked)

1. Open `chrome://extensions` (or the equivalent in Brave/Edge/Arc).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and pick this folder.
4. Open x.com. Click the toolbar icon to adjust settings.

After changing code, click **Reload** on the extension card and refresh any open x.com tabs (a reload strips the old stylesheet from tabs that are already open). Each browser has its own copy: reloading in Brave does not update Chrome, and vice versa. The version on the card tells you which build is loaded.

## Privacy

eXpand runs entirely in your browser. It reads X's own timeline API responses inside the page to learn the full length of long posts, stores your settings in the browser's extension sync storage, and sends nothing to anyone. It requests only the `storage` permission and access to x.com / twitter.com.

## Layout

```
manifest.json          MV3 manifest
src/page-hook.js       MAIN-world script: taps fetch/XHR for note_tweet (full long-post length)
src/content.js         Isolated content script: layout un-clamping, photo rescale, auto-expand
src/content.css        Layout overrides
src/dim.css            Dim theme (class remap over Lights out)
popup/                 Settings popup
```

## Known limitations

- **X's markup changes.** Selectors use X's stable `data-testid` hooks where they exist, but the Dim theme and a few layout rules depend on X's generated class names, which can change without notice. When something looks off after an X update, that's the first suspect.
- **Quoted long posts** are clipped to five lines by X with no “Show more” button; eXpand leaves them alone.
- **Grid and carousel photos** keep X's own sizing; only single photos and videos are enlarged.
- **Dim** only applies while X itself is set to Lights out (Settings → Display). With X's automatic day/night theme, Dim follows the dark phase.
- **Thread pages** keep X's “Show probable spam” and “Discover more” sections as they are.
- Tested on Chrome and Brave on macOS. Other Chromium browsers should work but haven't been checked.

## Notes

- X's DOM is generated and changes often. Selectors lean on stable `data-testid` hooks (`primaryColumn`, `sidebarColumn`, `tweet-text-show-more-link`) plus a computed-style fallback for the 600px clamp.
- Expansion is skipped on quoted posts and on pages whose primary column isn't a timeline (Messages, Settings, Grok).
- Debugging: in DevTools on x.com, `window.__expandNotes` is the map of captured long posts, and each “Show more” button gets a `data-expand-seen` attribute saying what eXpand decided (`expanded`, `toolong`, `quote`, `noid`) and `data-expand-lines` with the measured height.
