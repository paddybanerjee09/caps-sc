# Interface layout

- Keep modals and screens space efficient and easy to navigate. Size short inputs for their expected content; reserve full-width fields for titles, search, notes, and other long text.
- Group related short inputs side by side, such as Sets/Reps and Weight/RPE. Allow rows to wrap when narrow screens or large accessibility text require it.
- Keep status and adaptation controls to the right of modal titles. Let their text wrap within the row instead of moving the control below the title.
- Place `LogTimeChanger` with `inline` in the same row as neighboring inputs or buttons. Stretch controls to the row's height while keeping the time control's width content-sized. Keep field labels outside that control row.
- Preserve at least 44-point touch targets, readable labels, scrolling, and keyboard access while reducing wasted space.
- Display and accept weights in the user's selected kg/lb units; convert to kilograms for storage.
