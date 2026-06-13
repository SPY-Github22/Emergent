# E2E Test Infra: Emergent Game

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.
- Target execution: Manual verification plan (due to "final QA will be performed by the User" acceptance criteria) with optional automation compatibility (e.g. Playwright).

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| F1 | Game Boot/Init | ORIGINAL_REQUEST R3, AC1 | 5 | 5 | ✓ |
| F2 | Cinematic Tutorial | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| F3 | Agent Arrival (2 agents) | ORIGINAL_REQUEST R1, AC2 | 5 | 5 | ✓ |
| F4 | Day-Night Cycle | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |
| F5 | Interaction: Radial Menus | ORIGINAL_REQUEST R2, AC4 | 5 | 5 | ✓ |
| F6 | UI: Mind Panel & Journal | ORIGINAL_REQUEST R3, AC4 | 5 | 5 | ✓ |
| F7 | UI: Whisper Bar | ORIGINAL_REQUEST R3, AC4 | 5 | 5 | ✓ |
| F8 | AI Training & NN Persistence| ORIGINAL_REQUEST R2, AC3 | 5 | 5 | ✓ |
| F9 | AI Autonomous Actions | ORIGINAL_REQUEST R2, AC3 | 5 | 5 | ✓ |
| F10| World State Persistence | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |

## Test Architecture
- **Test runner**: Manual execution by QA/User (browser), guided by test cases. Open browser console to monitor for errors.
- **Test case format**: Action -> Expected visual/state output
- **Directory layout**:
  - `tests/manual/` - Manual verification checklists
  - `tests/automated/` - Placeholder for Playwright specs if automated later

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Full New User Onboarding | F1, F2, F3, F5 | Medium |
| 2 | Long-term Care & Observation | F3, F4, F5, F6 | High |
| 3 | Training to Autonomy | F5, F7, F8, F9 | Very High |
| 4 | Play Session Resumption | F4, F8, F10 | Medium |
| 5 | Interruption & Recovery | F1, F10 | Low |

## Coverage Thresholds
- Tier 1: ≥5 per feature
- Tier 2: ≥5 per feature (where boundaries exist)
- Tier 3: pairwise coverage of major feature interactions
- Tier 4: ≥5 realistic application scenarios
