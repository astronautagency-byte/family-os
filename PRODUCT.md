# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

FamOS serves households coordinating everyday family life. When needs differ, prioritize parents coordinating the household. Children have a simpler experience focused on Calendar, Tasks, Rewards and Chat, within household settings and permissions.

## Product Purpose

Help families know what needs to happen next and coordinate plans with less effort. Success means useful, dependable coordination rather than maximizing time spent in the app.

## Positioning

Bring household schedules, tasks, shopping, meals, recipes and communication into one shared home. Connect workflows where doing so reduces repeated entry and helps the next person act.

## Operating Context

Families use the app on phones, tablets and computers. The project includes an existing web app and Tauri iPhone and Android wrappers. Google Calendar connection is optional; its sensitive-scope verification remains pending.

## Capabilities and Constraints

- Household members share plans; privacy and access must respect household membership, user roles and private chat channels.
- Parents control RewardBank, chore star values and rewards. Children collect approved stars and can request rewards.
- Household customization hides enabled pages and features without deleting the underlying data. Settings must remain accessible.
- Basic meal planning is intended to be available on Free; paid meal roulette is separate.
- Imports and AI suggestions require user review before saving. Buying a grocery item does not establish its inventory quantity or expiry date.
- Reminders should be dependable, owned by the right person and configurable.
- Billing, store availability and integrations must be represented according to their actual verified state; do not imply unverified functionality or publication.

## Brand Commitments

The product is called FamOS. The user wants it warm, bright, fun and vibrant while remaining simple, functional and uncluttered. Lifestyle imagery paired with recognizable product UI is preferred on the public website. Illustrations and avatars should be consistent across the app, with varied ages, appearances and backgrounds.

## Evidence on Hand

The running app components and existing tokens are in `src/components`, `src/pages`, and `src/theme`. Product captures under `public/marketing/product-captures` use sample data; they are not evidence of customer outcomes. Current implementation and security status must be verified rather than inferred from marketing copy.

## Product Principles

1. Make the next useful action obvious.
2. Keep setup skippable where possible and preserve families' existing data.
3. Connect planning workflows without taking unapproved actions.
4. Prefer dependable, understandable behavior over extra features or decoration.
5. Give each household control over complexity, visibility and notifications.
