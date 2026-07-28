# CAPS: The Combat Athlete Performance System

## Purpose

The purpose of CAPS is to serve as a performance platform for combat sport athletes, unifying sport training, strength & conditioning, nutrition, and recovery data. The central design purpose is that sport training should remain an athlete’s primary focus, while strength and & conditioning work should be organized around it.

## Abbreviations

- RHR: Resting heart rate
- RIR: Repetitions in reserve
- HRV: Heart rate variability
- RPE: Rate of perceived exertion
- S&C: Strength and Conditioning

## Technical Architecture

- TypeScript
- React Native and Expo SDK 54 for cross-platform mobile development
- Expo SQLite
- REST API integrations using JSON
- Strava API v3 for conditioning activity synchronization
- OAuth 2.0 authorization for Strava
- USDA FoodData Central API for nutritional data

## SQLite database

- Uses Expo SQLite for local storage
- Uses a normalized relational schema where timeline entries link to category-specific records for nutrition, strength, sport, conditioning, weight, or sleep entries
- Maintains data integrity through foreign keys, indexes, transactions, and versioned schema migrations
- Uses indexed timestamp queries and SQL joins to load and combine records for the daily timeline and progress visualizations

## Nutrition Tracking

- Integrates with the USDA FoodData Central REST API for food search/nutrient data
- Calculates daily micro/macronutrient totals using nutrient data and SQL aggregation
- Compares meal timestamps and nutrient data with nearby training blocks to calculate pre/post-training nutrition intervals
- Supports reusable custom meals composed of food/serving records

## Custom Skill Work

- Allows user to create custom training sessions that often vary depending on the athlete, their gym, and their sport
- Ex: A striking session can contain independently configured activities such as 2x3min rounds of shadowboxing, 3x3min rounds of padwork, 2x5min bag rounds, etc
- Fatigue, nutrition, and recovery needs are estimated depending on session length and RPE
- Aids in organizing S&C around the skill work while keeping it as the main priority

## Tracking Strength Training

- Assists in periodizing strength training according to the athlete’s goals, competition dates, and recorded workload
- Exercises, sets, repetitions, load, rest periods, RPE, and RIR are logged through a normalized workout schema
- Aids in:
  - Rate of force development
  - Relative strength gain
  - Lean mass gain

## Tracking Conditioning Sessions

- Imports athlete activities through the Strava API V3 using OAuth 2.0, scoped access tokens, and activity identifiers for synchronization and deduplication.
- Records runs in-app through device location services
- Derives route length, elapsed time, and pace
- Built-in interval timer for anaerobic work with the ability to create custom circuits
- Reads heart-rate and workout data from Apple HealthKit and Android Health Connect to supplement RPE-based exertion records

## Weight Tracking

- Stores timestamped weight measurements
- Compares rolling averages against athlete goals, weight class limits, and competition dates
- Assists during fat-loss and muscle-building phases
- Helps track water and sodium intake during fight week to promote safe water cutting practices

## Sleep Tracking

- Offers the option to log sleep yourself
- Imports sleep session data from Apple HealthKit or Android Health Connect
- Possible future Fitbit, Garmin, or Oura REST API integration
- Incorporates sleep duration, consistency, quality, and training load into a recovery index

## Progress visualization

- Aggregates data from the normalized SQLite schema using date range queries, joins, and daily/weekly/monthly grouping
- Visualizes body weight, nutritional intake, training duration, session load, sleep, recovery, and performance benchmarks across date ranges

## Recovery Dashboard

- Combines training load, nutrition, sleep, subjective exertion levels, and biometric records into a recovery model
- Imports HRV and RHR samples through Apple HealthKit and Android HealthConnect queries, comparing them to athlete baselines
- Displays recovery score and a summary of biometric trends

## Daily Timeline

- Displays all logged events (Sleep, S&C, Training, Nutrition, Weight logs, etc) on a horizontal React Native ScrollView timetable throughout the day
- Handles instantaneous measurements, overlapping events, overnight sessions, and calendar boundaries
- Shows relationships between various events throughout the day (Ex: How a meal eaten 3 hours pre-training will affect athletic output)
- Helps athlete maintain a dedicated schedule

## Future Direction

- Develop a RAG advisor grounded in current combat sport S&C research to provide evidence-backed guidance based on individual athlete information
- Add coach-athlete relationships, permission-based data sharing, assignable training sessions, and direct messaging
- Introduce light social features
