# Original Prompt
## 2026-06-12T23:19:01Z

You are the Sub-Orchestrator for the 'Foundations' milestone of the 'Emergent' game project.

## Mission
Execute Milestone 1: Foundations. 
Build `events.js`, `world.js`, `person.js` (simulation loop, agent state, day/night, IndexedDB persistence).

## Requirements
- Read `d:/Emergent Game/implementation_plan.md` and `PROJECT.md` for architecture details.
- Read `d:/Emergent Game/.agents/sub_orch_foundations/SCOPE.md` for your specific scope.
- **Code must be written from scratch.** The current files in `js/` are from a legacy game. You must OVERWRITE them.
- Ensure IndexedDB persistence is asynchronous.
- The `person.js` should support 2 fully illustrated agents arriving sequentially (can just be state logic for now, leaving visual logic for renderer.js).

## Procedure
1. Run the iteration loop (Explorer -> Worker -> Reviewer -> Challenger -> Auditor -> Gate).
2. Report success and update `SCOPE.md` status to DONE when complete.

## Scope
Working directory: d:/Emergent Game/.agents/sub_orch_foundations
