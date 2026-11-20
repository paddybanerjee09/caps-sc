# Bottom tab label sizing

20 November 2026, 16:58 EST (America/Toronto), Codex on main. Follow-up to [[2026-11-20 Screen Title and Home Layout Handoff]]. Rules and skills reused from that task. Canonical note: [[UI and Interaction Decisions]].

- Commit 52d6ba2 changes only src/components/BottomTabs.tsx: all five labels use 9px font and 11px line height (previously 10/12). Icons, touch targets, scaling and two-line support remain as before.
- Checked incremental 10, 9.5, 9 and 8.5px using Windows System.Drawing Arial bold plus tracking. Conditioning measures 63.85, 60.76, 57.68 and 54.60px respectively. At 360px the existing five equal tabs provide 61.2px for text: (360 - 8 outer padding - 16 gaps) / 5 - 6 per-tab border/padding. Selected 9px for margin. Proxy evidence only; Android uses a different font.
- adb devices failed because the ADB daemon could not start. Native screenshot and on-device line-wrap confirmation were not possible. Next: verify Conditioning in active/inactive states on user's device and at larger accessibility text sizes; keep any further font adjustment shared by all five labels.
- npm run typecheck and npx eslint src/components/BottomTabs.tsx both passed. Feature Tree bottom-tabs version 4 maps this commit; local data validation performed. No separate publication endpoint documented.
- Existing unrelated user changes preserved; no delegation. UI source committed; memory/tree edits are this session's scoped follow-up.
