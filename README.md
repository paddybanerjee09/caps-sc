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
- Exercises, 
