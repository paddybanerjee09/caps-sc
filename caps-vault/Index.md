# CAPS S&C memory bank

CAPS S&C is the Combat Athlete Performance System. This vault uses the source at `e492e06` as its initial baseline. Check the current branch, source, and working changes before relying on recorded behavior.

## Start here

- Read `AGENTS.md` and applicable `.cursor/rules/*.mdc`, then open the relevant feature or architecture note below.
- Open [[Handoffs]] if you're resuming work or investigating a known discrepancy. Follow the feature note's links for additional context as the task requires it.
- Look up a screen, component, table, or historical node in [[Feature Tree Crosswalk]]. Use [[Project History]] for the major changes and [[Git Commit Index]] to find a specific revision. These are reference notes for targeted lookup.

## Architecture

- [[App Architecture]] · entry point, providers, navigation, app state, SDK, and verification entry points
- [[UI and Interaction Decisions]] · theme and feedback, form and overlay decisions, deferred loading, and rollback lessons
- [[Data and Persistence]] · SQLite, schema versions, timeline ownership, repositories, and migration caveats

## Features

- [[Home]] · Today, timeline, weight and sleep, Fatigue Index, Recovery Index and Progress
- [[Nutrition]] · diary, meal drafts, saved meals, food search and barcode, custom foods, favourites
- [[Conditioning]] · calendar, planning and logging, templates, execution, routes and estimated training stimulus
- [[Strength]] · planning, completed sets, history, exercise search and estimated training stimulus
- [[Skills Training]] · current placeholder and roadmap recorded in the Feature Tree
- [[Settings]] · units, theme, feedback, Account Information, and Athlete Information
