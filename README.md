# Momentum Fitness

Momentum is a calm, personal training journal for tracking workouts, body weight, and long-term progress. It uses Next.js for the application, Supabase for authentication and data, and Vercel for hosting.

Live app: [workout-tracker-kappa-seven.vercel.app](https://workout-tracker-kappa-seven.vercel.app)

## Features

- Log workout weight, sets, reps, and dates by exercise and body part
- Track daily body weight
- Review progress over 1 week, 1 month, 3 months, 6 months, 1 year, or year to date
- See weekly workouts, training volume, recent activity, and personal records
- Responsive desktop and mobile layouts
- Supabase authentication with row-level data protection

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and add the Supabase project values.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Environment variables

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

The publishable Supabase key is designed for browser use. Database access is protected by Supabase Row Level Security policies.

## Seed test history

`scripts/seed-test-history.mjs` is a one-off visual-testing helper. It uses a service-role key and bypasses RLS, so it must only ever target a disposable test account.

1. Add `SUPABASE_SERVICE_ROLE_KEY` and `ALLOW_TEST_DATA_SEED=true` to `.env.local`.
2. Replace `TEST_USER_ID` at the top of the script with an existing Auth user's UUID.
3. Run `npm run seed:test-history`.

The script refuses to create users, requires confirmation, and only selects exercises that already exist in the library.

## Deployment

The production app is hosted on Vercel. Connect this repository to a Vercel project, add the environment variables above, and use `main` as the production branch.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase
- Vercel

