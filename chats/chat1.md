# Speed reading tool with RSVP

_Started 2026-07-23 01:07 UTC_

---

## User

a speed-reading tool built on rapid serial visual presentation — it flashes one word at a time at a fixed point so your eyes never move across a page, eliminating the time spent on saccades and backtracking.

What it does:

Word presentation — displays words sequentially at a set pace, each aligned on its optimal recognition point (the pivot letter, colored orange) so the word lands where your eye naturally recognizes it. Pivot position scales with word length.
Adaptive pacing — you set a target speed from 100–1000 WPM, but the actual dwell time varies per word: long words get ~30% extra time, and words ending in punctuation get ~80% extra, so sentence boundaries breathe rather than blurring past.
Text intake — four ways to load material: paste directly, import a PDF (text extracted in-browser), fetch a webpage by URL, or use a bookmarklet that grabs article text from whatever page you're on. All extraction strips navigation, scripts, and boilerplate to isolate the readable body.
Library and resume — saves texts locally with your exact word position, so reopening anything drops you back where you stopped. Each entry tracks percentage read.
Playback control — play/pause, restart, step forward or backward one word at a time, and live speed adjustment mid-read. Progress bar shows position and estimated time remaining.
Speed calibration — a built-in test runs a fixed passage so you can find the pace you actually sustain with comprehension, rather than guessing.
Punctuation- and length-weighted dwell timing rather than a flat interval
PDF text extraction in-browser
Webpage import via URL fetch plus a bookmarklet fallback
Persistent library with exact word-position resume
Speed calibration test
Offline operation via service worker
Manual word-stepping in both directions
Font controls — typeface picker (serif/sans/mono/dyslexia-friendly), size, weight
Comprehension features — post-read quiz generated from the text, retention prompts, comprehension-vs-speed tracking
Reading stats — words read, time spent, WPM over time, streaks
Themes — light/dark/sepia/high-contrast
Chunking — 2–3 words per flash
Rewind by sentence — the regression ability RSVP normally costs you

I want voice to text (optional toggle) as well.

## Assistant

This is a rich, well-specified tool. Before I build, a few scoping questions so I focus the first version on what matters most to you.

_[tool: questions_v2]_

## User

Questions answered:
- fidelity: Fully working tool — real reading engine + local library, wire up what the sandbox allows

## Assistant

Got it — fully working tool. One quick thing before I build: I need a visual direction (the picker didn't come through with your answer).

_[tool: questions_v2]_

## User

Questions answered:
- aesthetic: light and dark modes - warm, easy to look at, white font on black background with red accent letter by default.

## Assistant

_[tool: read_skill_prompt]_

I have everything I need. Building the full RSVP speed-reader as a single Design Component — real reading engine, adaptive pacing, ORP pivot, library with resume, PDF/URL/voice intake, calibration, quiz (via Claude), stats, and four themes with dark default.

_[tool: update_todos]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: show_html]_

Loading the sample to verify the reading engine and pivot alignment.

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

Reading engine works well — pivot centered, ETA, progress all live. The WPM slider thumb is rendering blue instead of accent; checking why.

_[tool: eval_js]_

_[tool: dc_html_str_replace]_

_[tool: update_todos]_

_[tool: ready_for_verification]_

## User

Make it better by being closer to Readrrr (the app on the app store) and make sure we have things like timing fine-tuned. Do deep research.

## Assistant

I'll research Readrrr and RSVP timing models, then refine the engine. Note: I'll take functional/timing inspiration but keep an original design (not clone their branded UI).Good research. Let me pull the detailed timing algorithm from one open-source spec to fine-tune the multipliers precisely.I have a clear, research-backed picture. Key upgrades to make the engine match premium RSVP readers like Readrrr:

- **Fine-tuned timing:** syllable-complexity multipliers (5+ syllables ×1.6, 3–4 ×1.3), sentence/paragraph/clause pauses, number handling, short-word speed-up, plus an ease-in ramp so each session starts gentle — all research-aligned.
- **Read-aloud (TTS) synced to the highlight** — matching Readrrr's "hear text alongside the words," word-boundary synced.
- **Focus mode** — chrome auto-hides while playing for a distraction-free field.
- **Paragraph-aware pauses**, adjustable pause length, and polish.

Let me rewrite the component with these.

_[tool: dc_write]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: web_fetch]_

Right — an iPhone app. Let me put it in a proper iOS device frame and rework the layout for mobile (bottom sheets, tab bar, touch targets). First, the frame starter.

_[tool: copy_starter_component]_

_[tool: read_file]_

Now I'll rework the whole layout for iPhone: mounted in the iOS device frame, mobile top bar, a control card, an iOS tab bar (Read / Library / + / Stats / Settings), and panels as bottom sheets. The reading engine and timing logic stay intact.

_[tool: set_project_title]_

_[tool: dc_write]_

Let me verify it renders correctly in the phone frame.

_[tool: show_html]_

Phone frame renders well. The device (874px) is taller than the preview, so the bottom is clipped — let me scale it to fit and check the full layout, reading state, and tab bar.

_[tool: save_screenshot]_

Engine and pivot work. I still need to see the bottom controls + tab bar. Let me align to top and scale so the whole phone fits.

_[tool: save_screenshot]_

Focus mode faded the control card mid-play (as designed), leaving the reading field + tab bar. Let me pause to confirm the control card (transport, speed, progress) looks right.

_[tool: save_screenshot]_

Full reading screen looks right — iOS tab bar, transport, speed + Audio toggle, quiz pill, ORP pivot centered. Let me check for console errors, then clean up.

_[tool: get_webview_logs]_

No console errors. Let me clean up the scratch screenshots and hand off to verification.

_[tool: delete_file]_

_[tool: ready_for_verification]_

## User

readrrr lets you press and hold - I want to mimic their UI - https://www.readrrr.app/

## Assistant

The signature is press-and-hold to read (release to pause), plus hold-Space. I'll add that interaction and a "hold to read" affordance + a Focus/Listen mode label, keeping my own visual identity. Targeted edits:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: web_fetch]_

Now the logic — hold handlers, hold-Space, mode label, hint.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Let me verify the hold-to-read works and the hint/mode label render.

_[tool: eval_js]_

_[tool: eval_js]_

_[tool: show_html]_

_[tool: eval_js]_

Hold-to-read works — pointerdown plays, release pauses; hold-Space too. The "Press & hold to read" hint and Focus/Listen mode label render correctly.

_[tool: ready_for_verification]_

## User

Is there more to copy/improve on? please do deep research. Also allow users to type their WPM, improve the text names, etc.

## Assistant

Excellent research. The clear high-value additions beyond what I have: a **Guided-Highlight "Flow" mode** (Outread's signature — keeps context/parafoveal preview, the #1 research fix for RSVP comprehension loss), a **built-in "place to start" library**, and a **Continue/resume card**. Plus your explicit asks: **typeable WPM** and **smarter auto-titles + rename**.

Let me read the current file to anchor edits precisely.

_[tool: read_file]_

_[tool: web_search]_

_[tool: web_search]_

_[tool: snip]_

_[tool: snip]_

_[tool: snip]_

_[tool: read_file]_

Research points clearly to a **Guided-Highlight "Flow" mode** as the biggest comprehension win, plus your explicit asks. Implementing: typeable WPM, smarter titles + rename, a built-in starter library, a Continue card, and Flow mode. Logic first:

_[tool: dc_js_str_replace]_

The dc tools take single c_find/d_replace, not an array. Let me issue them as parallel calls.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the renderVals computations and return keys:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Logic is in. Now the template edits — Flow block, WPM input, settings mode toggle, starters list, Continue card, rename, and spinner-hide CSS:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

One error to fix — I left a stray `color:{{ resumeShow }}` in the Add button style.

_[tool: dc_html_str_replace]_

Let me verify the new features render and work — check for errors, then test Flow mode, WPM typing, and starters.

_[tool: show_html]_

_[tool: eval_js]_

WPM typing, starters, and smart titles work. The Flow toggle wasn't found by my probe — let me inspect the Settings sheet directly.

_[tool: eval_js]_

_[tool: get_webview_logs]_

The probe's anchored regex likely missed the tab. Let me retest Flow with a looser match.

_[tool: eval_js]_

Flow guided-highlight mode works (label "FLOW", paragraph with the moving highlight). All five additions verified. Quick visual confirmation of Flow + the starters sheet:

_[tool: save_screenshot]_

Both new surfaces look great: Flow mode reads as flowing text with the moving highlight (WPM shows the typed 480), and the Add sheet has the "A place to start" library. Cleaning up and handing off.

_[tool: delete_file]_

_[tool: ready_for_verification]_

## User

Can you add things like "read 1000 word streak" style notifications? I want it to play audio as well - word on screen and word heard simultnaeously. i want a high quality text to voice, and for it to generate the voice as well. Clean up the UI so that when you press and hold to read, it fades the rest out. Also make it so you can see the surrounding text when not actively reading, maybe make it smaller and show all text, then when you press and hold it does a fast fade transition into the single word?

## Assistant

This is a meaningful upgrade. Let me read the current reading-area and logic sections precisely before editing.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

I have the exact code. Implementing all four requests — milestone toasts, high-quality voice selection + synced narration, instant fade-on-hold, and the rest-shows-context / hold-fades-to-single-word transition. Logic edits first:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the renderVals computations (flowWords always, voiceOpts, opacity/toast/voice returns):

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template edits — toast markup, keyframe, fade-on-hold, the rest-context/hold-to-word cross-fade, and the voice picker:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

All edits applied. Let me verify the new resting-paragraph view, the hold cross-fade, toasts, and the voice picker.

_[tool: show_html]_

_[tool: eval_js]_

Rest-context view and voices work; hold→release pauses. Let me screenshot the actual held state to confirm the fade-to-single-word and chrome fade visually.

_[tool: save_screenshot]_

The chrome-fade-on-hold has a bug: the window `pointerdown` listener (`onPoke`) re-reveals chrome right after `holdStart` hides it. Also my preview persisted `readMode:'flow'` from earlier testing (Flash is the default, and Flash is where rest→single-word applies). Fixing `onPoke`:

_[tool: dc_js_str_replace]_

_[tool: snip]_

_[tool: snip]_

Testing Flash mode: switch to Flash, then hold to confirm the single-word overlay + chrome fade.

_[tool: save_screenshot]_

Confirmed — screenshot 5 shows the fix working: while held, the chrome fades away and it cross-fades into the single word ("an", pivot in red); when resting it shows the full surrounding paragraph. Flash/Flow both work, voices load, toasts wired.

_[tool: delete_file]_

_[tool: snip]_

_[tool: ready_for_verification]_

## User

the UI is messed up - text overlaps buttons, etc. Make it bound better and the text smaller

## Assistant

The resting paragraph is too tall/large and spills over the controls. Fixing: fewer words in the window, smaller text, tighter leading, and clip the reading area so nothing overlaps.

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: save_screenshot]_

That still shows the pre-edit layout — the preview didn't pick up the template changes. Let me force a fresh render and re-check the actual paragraph size and bounds.

_[tool: show_html]_

Now I'll add the top/bottom fade (gradient mask) and smooth vertical scrolling that keeps the current word centered — words fade out before reaching the chrome. Reworking the reading paragraph into a masked, auto-scrolling viewport.

Logic — larger centered window, current-word marker, and a scroll sync:

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Now the template — replace both paragraph blocks with the masked, scrolling viewport:

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: show_html]_

_[tool: save_screenshot]_

The fade + scroll works exactly as asked: resting text fades out at top and bottom (before touching the chrome), and as it advances the paragraph smoothly scrolls to keep the current word centered while the edges stay faded (screenshots 2→3). Cleaning up and handing off.

_[tool: delete_file]_

_[tool: snip]_

Right — it's boxed to a fixed 224px. I'll make the reading viewport flex to fill all the available vertical space (the fade + scroll scale with it).

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Let me verify the text now fills the space.

_[tool: show_html]_

_[tool: save_screenshot]_

Text now fills the full reading area — the paragraph spans from top to just above the controls, fading at both edges, and scrolls to keep the current word centered as it advances (screenshot 3).

_[tool: snip]_

_[tool: delete_file]_

_[tool: ready_for_verification]_

## User

do a final design sweep to mke sure it is intuitive and well nade for users

## Assistant

_[tool: snip]_

_[tool: eval_js]_

Let me capture the key screens to review them for design/UX issues.

_[tool: multi_screenshot]_

Solid overall. The clearest issues: the Library fills with duplicate entries when the same text is loaded again, and the resting text top-aligns at the start instead of keeping the current word centered. Fixing both — dedupe the library, and always center the current word (teleprompter-style).

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Let me reload (so the dedupe migration runs) and verify the library and the centered resting text.

_[tool: show_html]_

_[tool: multi_screenshot]_

Both fixes verified: the Library is deduped (one "Why your mind wanders" entry instead of eight), and the resting text now keeps the current word centered teleprompter-style with the fade above/below (screenshot 2). The rest of the screens — intake, settings, stats, calibrate — read cleanly.

_[tool: snip]_

_[tool: ready_for_verification]_

