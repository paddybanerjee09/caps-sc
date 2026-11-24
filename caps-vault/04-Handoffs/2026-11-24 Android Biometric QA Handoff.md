# Android Biometric QA Handoff

Completed 24 November 2026, 18:37 EST (America/Toronto). Codex /root with /root/android_qa and a read-only biometric audit. Branch: Skill/Conditioning/Strength-Changes; final source revision 760688b. This note is included in the final QA documentation commit.

## Objective and context

The user requested running Android and testing biometric modals, especially weight logging from Home and Athlete Information, keyboard, pickers, persistence and Back navigation, with fixes for observed issues. Follow AGENTS.md and applicable .cursor/rules. Canonical context: [[UI and Interaction Decisions]], [[Settings]], [[Weight and Sleep Logging]] and the earlier [[2026-11-23 UI Refactor Handoff]]. The user's existing vault/index/rule/Obsidian changes were preserved.

## Changes and decisions

| Commit | Result |
| --- | --- |
| 1dddd6d, 17:25 EST | FormModal now uses padding-based Android keyboard avoidance. The previous height behavior clipped the dialog; disabling avoidance covered its footer. Live keyboard-open Save wrote one synthetic 75.25 kg entry and kept the form/actions reachable. |
| ef645a0, 18:00 EST | LogTimeChanger retains stable native wheel identity, highlights the live centered row, settles momentum and carries pending selection across day changes. Draft Date identity reanchors rejected selections even when bounds retain the same numeric value. |
| 080eb08, 18:00 EST, corrected by 760688b, 18:25 EST | An initial audit incorrectly claimed 60 cm became 1 ft 11 in. Executing the actual helper proved it rounds total inches to 2 ft 0 in. The unnecessary picker/validation change was fully restored to baseline 1dddd6d; a passing boundary fixture was added to verify-biometrics. No final height behavior change is intended. |

Affected source: src/components/FormModal.tsx, src/components/LogTimeChanger.tsx and scripts/verify-biometrics.mjs. BiometricEditModal.tsx is restored to its original implementation. No new dependency, database schema, repository operation or persistence contract was introduced. Weight remains canonical in the existing timeline/weight projection; athlete profile storage remains unchanged.

## Android verification

Environment: existing Pixel_7 AVD, Android 17/API37, Expo Go 58.0.6, headless software renderer with explicit 4 GB memory. Synthetic data used CAPS Android QA / caps-sc-android-qa in a detached isolated checkout and Metro 8085. The existing user Metro 8081 was not modified by this task.

Observed passes:

- Home opened the shared actual modal. Empty/invalid input disabled Save. Back hid the numeric keyboard while retaining the draft; another Back dismissed without a write. Saving 75.25 kg with the keyboard open created one log and displayed 75.3 kg. A full Android restart restored it.
- Athlete bodyweight opened the same modal with the correct prefill and internal timestamp. Nested Log Time Back returned to the parent weight draft; cancelling wrote no log.
- A future-minute swipe reanchored to the maximum with center and red highlight aligned. A past-day swipe settled on 18:05; Done applied exactly 23 November 2026, 18:05. Saving from Athlete produced the corresponding Home history entry; opening it showed the matching timestamp and 75.3 kg. The latest current weight and one-log-today marker remained unchanged by the older entry.
- Independent DOB columns clamped Jan 31, 2008 to Feb 29; switching to 1997 clamped to Feb 28. Save updated age to 29. Final process relaunch restored the exact DOB, 1997-02-28.
- Metric 60 cm saved successfully, opened as imperial 2 ft 0 in, and unchanged imperial Save returned to exactly 60 cm in metric. Independently changing feet/inches then Back discarded the draft. The original picker range is correct.
- Preferred pounds displayed/prefilled 165.9 lb for the stored 75.25 kg; Cancel created no new current-day log. Changed sex then Back retained Female.
- Sidebar X returned from Athlete to Home. Final Android Back dismissed DOB to Athlete, then returned to Home. Final process relaunch restored Home age 29/height 60 cm/weight 75.3 kg and Athlete Female with matching values. Settings were returned to KG/CM; original Muay Thai-only selection remained.

Evidence is retained, ignored by Git, under work/recovery-android-qa-export/: QA-results.md and numbered screenshots. Key images: weight-keyboard-before.png / weight-keyboard-after.png; qa04 future clamp; qa05–qa07 timestamp/save; qa11–qa13 DOB; qa23 / qa30 height preservation; qa24 pound prefill; qa34 history detail; qa38–qa40 final persistence; qa42 final Back result. The ignored report distinguishes parent observations from the device agent's observations.

Transient launcher/loading captures (notably qa35 and qa41) are not persistence evidence. Final settled screenshots were inspected. A background Android WebView package update terminated Expo Go earlier; exit-info identified PACKAGE UPDATED, rather than an application exception. Emulator startup System UI ANRs and fast injected typing were environment constraints; paced input and settled screens were used for acceptance. No further source defect was reproduced in final-source testing.

Limits: no physical-device, iOS, screen-reader, large-font, exhaustive DST/date-bound, performance or direct device-database duplicate audit. The observed picker cases are not an exhaustive native acceptance claim.

## Automated checks and memory

Passed: integrated TypeScript (node node_modules/typescript/bin/tsc --noEmit); targeted ESLint for the three modal components, verify-biometrics script and reserved tree data; verify:biometrics including the new 60 cm fixture; verify:weight; verify:recovery-input; verify:display-dates; owned git diff --check.

Canonical Home/Settings/UI notes and the handoff index were updated. The documented Feature Tree is docs/feature-tree. npm run feature-tree regenerated 264 commit records; npm run feature-tree -- --check validated all eight trees without errors, with 24 historical/documentation mapping warnings. architecture/home/settings nodes map the source commits and correction. At Strength's request the reserved architecture training-session-actions node also maps 6dfbf84 at 18:20 EST: one launch action, default Log Session for Strength/Skill, Conditioning Free Session override, no Create Session. Local Feature Tree synchronization is complete; no external publication or browser visual acceptance is claimed.

## Coordination and cleanup

The human explicitly authorized coordination with Update nutrition meal screens and Update strength workout flow. All source content was preserved during the agreed tip-only repair of mixed cef687a. Nutrition completed 80e28c7, 35ceb0d, 41499ce and e4b1ffd; Strength completed 6dfbf84, 6cb81e2 and 9637721. Both released their shared Git windows before QA's final writes. Use explicit owned paths and commit --only for shared-index work. No push or branch switch was performed by this QA completion.

Android/Metro ownership was released by android_qa. Original display size 1080x2400 and density 420 were restored and verified; font scale was unchanged. Task reverse 8085 was removed, task emulator stopped, and only the verified QA Metro process on 8085 was terminated. Earlier 8083/8084 reverse mappings were absent at cleanup. Before removing the exact temporary worktree, its final source content was compared with main (line endings normalized) and its node_modules junction safely unlinked; main dependencies remain available. The worktree and temporary config are gone, and main app.config.js is absent. Screenshots/report/emulator logs remain in the ignored evidence folder. No app-data clear or uninstall was performed; Expo Go was updated in place to run SDK58. Unrelated work files remain their owners' responsibility.

No required source or QA follow-up remains for this request. Other environments and accessibility/performance acceptance remain unrun as listed above. The shared Git window is released after the final scoped QA docs commit and status review.
