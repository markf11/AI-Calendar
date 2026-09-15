# AI Context: Momentum Calendar — Gaps to become a Motion-like calendar

> This file is written for an AI assistant. It states, in one place, what the
> Momentum Calendar project (this repository) already has, what is broken, and
> what still needs to be built to reach "Motion-like" behavior: automatic,
> self-adjusting scheduling of tasks around calendar events. Branch/commit
> references: `feat/motion-scheduling-overhaul` @ 1ff4faf (PR #1).

## What Motion does that this project must replicate

1. Auto-schedules tasks into free time between calendar events (Google/M365).
2. Re-schedules automatically when plans change: new events, overruns, missed tasks, new tasks with deadlines.
3. Respects working hours, breaks, deadlines, priorities, and dependencies.
4. Learns/estimates task durations; supports partial progress ("did 20 of 60 min").
5. Frictionless capture (quick-add) and instant UI auto-layout (drag/reschedule updates the plan).
6. Project backlogs feeding the schedule.
7. Multi-calendar management (color-coded, per-source availability).

## Status: what ALREADY exists (do not rebuild)

### Backend (src/)
- **Scheduling core**: `ConstraintSatisfactionSolver.ts` (backtracking CSP solver,
  dependency-aware ordering, deadline/working-hours/firm-event validation,
  `referenceTime` determinism), `TimeSlotGenerationService.ts` (slot generation,
  task chunking with breaks), `ConstraintCollectionService.ts` (working hours,
  deadlines w/ urgency, priority, dependency, energy constraints; trigger-timestamp
  deterministic), `ScheduleValidationService.ts`, `ScheduleOrchestrationService.ts`
  (replan orchestration, horizon clipping, revision persistence), `PriorityScoringService.ts`.
- **Rescheduling triggers**: `ReschedulingTriggerService.ts` (task_created/updated,
  completed, event_insert/updated/deleted → auto replan, with race handling).
- **Schedule revisions**: `ScheduleRevisionRepository.ts` +
  `migrations/003_schedule_revisions.sql` (append-only revision history, restore).
- **API**: `src/api/routes/schedule.ts` (replan/health-checked schedule routes),
  tasks, projects, booking links, meeting booking, calendar sync, auth, users, webhooks.
- **Calendar integrations**: `GoogleCalendarService.ts`, `MicrosoftGraphService.ts`,
  `CalendarSyncService.ts` (bidirectional sync), `CalendarWebhookService.ts`.
- **Meeting booking**: `MeetingBookingService.ts`, `BookingLinkService.ts`
  (booking links with availability) — already Motion-like.
- **Realtime**: WebSocket service + manager (live updates across devices).
- **Infra**: PostgreSQL + Redis, migrations runner, `/health` endpoint (DB+Redis),
  Docker + docker-compose, encryption utils (hardened, has security tests).

### Frontend (frontend/ — React web)
- Calendar views: `Calendar/Calendar.tsx`, `WeekView.tsx`, `DayView.tsx`, `MonthView.tsx`, `CalendarEvent.tsx`.
- Task UX: `QuickTaskForm.tsx` (quick-add), `TaskEditModal.tsx`, `TaskItem.tsx`, `TaskSidebar.tsx`.
- State: `CalendarContext.tsx`, `TaskContext.tsx` (+ new API adapters `frontend/src/api/`,
  context API tests), keyboard shortcuts, focus management.

### Desktop (desktop/ — Electron) and Mobile (mobile/ — React Native)
- Desktop shell with main/preload/shortcuts/notification/offline managers (external-url policy hardening in progress).
- Mobile: calendar screen, quick task input, task card, location service (deferred phase).

### Tests & CI state
- Backend: ~220 jest suites, 1439 tests. **Baseline (pre-PR#1): 182 suites fail. After PR #1: 160 fail.**
  The remaining failures are largely stale suites (sync, e2e, ai-algorithm-framework
  benchmarks, calendarSync) that predate the current service code.
- Commit 1ff4faf (PR #1) fixed: OOM jest config, deterministic reference-time scheduling.
- `.github/` CI directory exists uncommitted and unfinished.
- `docs/production-readiness.md` covers prod config, OAuth/webhook registration, deploy, rollback.

## What is BROKEN / INCOMPLETE right now (fix-first list)

1. **~160 stale failing test suites** — triage each: real regression vs dead expectations
   vs tests for unimplemented features. Biggest clusters: calendarSync, scheduleValidation,
   conflict detection, e2e suites, ai-algorithm-framework benchmarks.
2. **CI is not set up** — `.github/` is untracked/incomplete; no checks run on PRs. Add a
   minimal CI: lint + tsc + jest (backend) on PR; keep coverage thresholds realistic (70%).
3. **Migration gap**: `migrations/002` missing vs `001` and `003` naming; verify the
   migration runner ordering and record `002` as intentionally skipped or renumber.
4. **Trigger wiring end-to-end**: rescheduling triggers exist and are unit-tested, but
   verify every entry point (task create/complete, event insert/update/delete, overrun
   detection) actually calls `replan()` and persists a revision + notifies clients via WS.
5. **Google/Microsoft OAuth + webhooks**: code exists but is un-verified against live
   providers (needs client IDs, redirect allow-list, webhook validation, subscription renewal).
   Docs exist (`calendar-sync.md`, `production-readiness.md`); execution is untested.

## Still needed to become a Motion-like calendar (build list, in order)

1. **Duration estimation / learning Phase 1** — Motion's core loop. Track estimated vs
   actual minutes per task (`completionHistory` exists as a field), surface a simple
   bias factor (e.g., per-user mean ratio) feeding `generateTaskSlots`. Service + tests TBD.
2. **Auto-reschedule on overrun/missed blocks** — detect a scheduled block that wasn't
   marked complete by its end, roll remainingMinutes into the next hole, emit alert +
   WS update. `UserAlertService.ts` + `ReschedulingTriggerService.ts` are the hook points.
3. **Drag-to-reschedule API + auto layout** — an endpoint accepting a task id + new
   start time (and validating constraints via `ScheduleValidationService`), plus the
   frontend to send it and optimistic re-render. Calendar UI already has views; the
   write-path integration is missing.
4. **Overnight/multi-day chunking policy** — `TimeSlotGenerationService` chunks within
   working hours per day; Motion persists the *same* task at a predictable slot across
   replans. Need a stability rule (prefer keeping prior positions when still valid).
5. **Project backlog → schedule feed** — ProjectService exists; add "auto-schedule from
   project backlog with target dates" logic: pick next tasks by due date/effort into
   the constraint solver input. Mostly wiring, solver already takes arbitrary task lists.
6. **Frontend auto-layout polish** — Motion's calendar feels "always arranged": timeline
   blocks for tasks interleaved with events, drag handles for reordering, unscheduled
   tray. Current WeekView/DayView need task blocks rendered from the schedule API with
   the same shapes as events.
7. **Realtime completion UX** — when a task is marked complete mid-day, the schedule must
   visibly re-flow (WS push → replan → patch diff). Backend partial exists
   (`POST /tasks/:id/mark-completed` triggers rescheduling per docs/progress-tracking.md);
   verify the WS broadcast reaches the calendar contexts.
8. **CI + test-suite repair** (parallel track) — green main is a prerequisite for rapid
   iteration on the features above.
9. **Mobile** — explicitly deferred; Motion parity requires at least read-only schedule
   view + quick capture. Only start after web parity.

## Environment / operational notes

- Requires PostgreSQL 13+ and Redis 6+ (see .env.example; secrets never committed).
- Dev: `npm run dev` (backend, port 3000), `npm run migrate`, frontend/desktop/mobile have
  their own package.json files.
- Test (low-memory hosts): plain `npx jest` works after PR #1's config fix; older advice
  to use `--isolatedModules` is now baked into jest.config.js.
- VPS sizing: 4GB RAM VPS — keep `--maxWorkers 2` and 1.5GB node heap for full runs.

## Recommended execution order for the next agent

1. Commit/PR the remaining uncommitted working tree in reviewable slices (desktop policy,
   encryption hardening, schedule routes, frontend API adapters) — PR #1 covered only the
   reference-time + jest config slice.
2. Stand up CI (lint/tsc/jest, backend first), then triage the 160 stale failures.
3. Then features 1–5 above (backend-first), 6–7 last (UI), 8 continues in parallel.
