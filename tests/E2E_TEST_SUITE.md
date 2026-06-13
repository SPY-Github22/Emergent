# Emergent Game: E2E Test Suite

## Execution Instructions
1. Open `index.html` (or the local dev server URL) in a modern browser (Chrome/Edge).
2. Open the Browser Developer Tools (F12) to the Console tab to monitor for errors.
3. For persistence tests, use the Application tab (IndexedDB) to verify or clear state.
4. Follow the Action Steps and verify the Expected Output.

---

## Tier 1: Feature Coverage (Happy Path)

### F1: Game Boot/Init
- **T1-F1.1 Normal Boot:** Load game in a fresh browser profile. *Expected: Loads without console errors.*
- **T1-F1.2 Canvas Render:** Verify the 4-layer canvas is visible. *Expected: `<canvas>` elements are present in DOM and not blank.*
- **T1-F1.3 Assets Load:** Verify images/scripts loaded. *Expected: Network tab shows 200 OK for all assets.*
- **T1-F1.4 Audio/Font Load:** Verify custom fonts or audio (if any) load. *Expected: No 404s.*
- **T1-F1.5 Reload Resiliency:** Refresh the page immediately after boot. *Expected: Game reloads cleanly.*

### F2: Cinematic Tutorial
- **T1-F2.1 Trigger:** Start a new game. *Expected: Cinematic opening sequence begins.*
- **T1-F2.2 Progression:** Click/proceed through tutorial steps. *Expected: Text/visuals advance.*
- **T1-F2.3 Completion:** Finish tutorial. *Expected: UI transitions to normal gameplay.*
- **T1-F2.4 Skip:** Attempt to skip (if feature exists). *Expected: Skips to gameplay immediately.*
- **T1-F2.5 Replayability:** Clear IndexedDB, reload. *Expected: Tutorial plays again.*

### F3: Agent Arrival
- **T1-F3.1 First Agent:** Wait after tutorial. *Expected: Agent 1 appears fully illustrated.*
- **T1-F3.2 Second Agent Trigger:** Wait or perform required action. *Expected: Agent 2 arrives.*
- **T1-F3.3 Visual Distinction:** Observe both agents. *Expected: Agents are distinct entities on screen.*
- **T1-F3.4 Interaction Target:** Click Agent 1. *Expected: Agent 1 is selected/focused.*
- **T1-F3.5 Interaction Switch:** Click Agent 2. *Expected: Focus switches to Agent 2.*

### F4: Day-Night Cycle
- **T1-F4.1 Cycle Start:** Observe environment over time. *Expected: Visuals transition from Day to Night.*
- **T1-F4.2 Night State:** Verify Night state effects. *Expected: Lighting/sky changes visibly.*
- **T1-F4.3 Dawn Transition:** Wait through Night. *Expected: Transitions back to Day.*
- **T1-F4.4 Cycle Loop:** Observe multiple cycles. *Expected: Cycles repeat without error.*
- **T1-F4.5 Time Scaling:** (If debug tools exist) speed up time. *Expected: Cycle accelerates smoothly.*

### F5: Interaction Radial Menus
- **T1-F5.1 Open Menu:** Click an agent. *Expected: Radial menu appears around/near agent.*
- **T1-F5.2 Feed Action:** Select 'Feed'. *Expected: Agent animation/state updates.*
- **T1-F5.3 Connect Action:** Select 'Connect'. *Expected: Appropriate interaction plays.*
- **T1-F5.4 Guide/Approve/Correct:** Select remaining actions over time. *Expected: Actions register.*
- **T1-F5.5 Close Menu:** Click elsewhere. *Expected: Radial menu disappears.*

### F6: Mind Panel & Journal
- **T1-F6.1 Open Mind Panel:** Click Mind Panel UI element. *Expected: Panel opens showing agent stats.*
- **T1-F6.2 Data Update:** Perform an action, check panel. *Expected: Stats update accordingly.*
- **T1-F6.3 Open Journal:** Click Journal UI element. *Expected: Journal opens showing history.*
- **T1-F6.4 Entry Addition:** Perform significant action. *Expected: New entry appears in Journal.*
- **T1-F6.5 Close UIs:** Close both panels. *Expected: Panels hide without affecting gameplay.*

### F7: Whisper Bar
- **T1-F7.1 Visibility:** Verify Whisper Bar is on screen. *Expected: UI element visible.*
- **T1-F7.2 Notification:** Trigger an event. *Expected: Text appears in Whisper Bar.*
- **T1-F7.3 History/Scroll:** Trigger multiple events. *Expected: Old messages fade or scroll.*
- **T1-F7.4 AI Message:** Wait for AI to act. *Expected: AI intent/action announced here.*
- **T1-F7.5 Dismissal:** (If dismissible) click to dismiss. *Expected: Message clears.*

### F8: AI Training & NN Persistence
- **T1-F8.1 Trainer Init:** Boot game. *Expected: TF.js initializes (check console/memory).*
- **T1-F8.2 Data Collection:** Perform actions (Feed, Connect). *Expected: Training data gathered.*
- **T1-F8.3 Background Train:** Wait for training interval. *Expected: TF.js `fit()` runs (no freeze).*
- **T1-F8.4 DB Save:** Reload page. *Expected: Model loads from IndexedDB (no re-init).*
- **T1-F8.5 Model Update:** Play longer, reload. *Expected: Updated weights load successfully.*

### F9: AI Autonomous Actions
- **T1-F9.1 Threshold Reach:** Train extensively on one action (e.g., Feed). *Expected: AI confidence rises.*
- **T1-F9.2 Autonomous Trigger:** Wait idle. *Expected: AI automatically performs the trained action.*
- **T1-F9.3 Whisper Bar Notify:** Observe UI during auto-action. *Expected: Whisper Bar announces AI action.*
- **T1-F9.4 Mixed Training:** Train on two actions. *Expected: AI alternates based on context.*
- **T1-F9.5 State Impact:** Check agent state after auto-action. *Expected: State updates as if player clicked.*

### F10: World State Persistence
- **T1-F10.1 Save Trigger:** Advance to Day 2, close browser. *Expected: State saves to IndexedDB.*
- **T1-F10.2 Load State:** Reopen browser. *Expected: Game resumes at Day 2.*
- **T1-F10.3 Agent State Save:** Feed agent, reload. *Expected: Agent is still fed.*
- **T1-F10.4 Time Save:** Reload during night. *Expected: Game resumes at night.*
- **T1-F10.5 Clear Data:** Clear IndexedDB, reload. *Expected: Starts from Day 1 / Tutorial.*

---

## Tier 2: Boundary & Corner Cases

### F1/F2: Init & Tutorial
- **T2-1 Window Resize:** Resize window extremely small during tutorial. *Expected: UI scales or handles gracefully.*
- **T2-2 Rapid Clicks:** Spam click during cinematic. *Expected: No crashing, skips/advances safely.*
- **T2-3 Slow Loading:** Simulate Slow 3G in network tab. *Expected: Loading screen persists until ready.*
- **T2-4 No WebGL:** Disable WebGL. *Expected: Graceful fallback or clear error message to user.*
- **T2-5 Multiple Tabs:** Open game in two tabs. *Expected: IndexedDB handles lock gracefully.*

### F3/F4: Agents & Time
- **T2-6 Midnight Action:** Act exactly as day turns to night. *Expected: Action registers correctly.*
- **T2-7 Agent Overlap:** Agents move to same coordinates. *Expected: Click targets disambiguate correctly.*
- **T2-8 Offscreen Agents:** Agents move to edge of canvas. *Expected: Kept in bounds or camera follows.*
- **T2-9 Long AFK:** Leave game running 24 hours. *Expected: No memory leak, day counter increments safely.*
- **T2-10 Rapid Time:** (If debug) 1000x time speed. *Expected: Physics/rendering don't break.*

### F5/F6/F7: UI & Interaction
- **T2-11 UI Spam:** Open/close Mind Panel 50 times rapidly. *Expected: No UI duplication or lag.*
- **T2-12 Menu outside bounds:** Click near screen edge to open radial menu. *Expected: Menu stays within screen.*
- **T2-13 Conflicting Inputs:** Open radial menu, press keyboard shortcuts (if any). *Expected: Handled safely.*
- **T2-14 Long Journal:** Accrue 1000 journal entries. *Expected: UI scroll performs smoothly.*
- **T2-15 Long Whisper:** Trigger event with extremely long name/text. *Expected: Text truncates/wraps nicely.*

### F8/F9: Neural Network
- **T2-16 Zero Training:** Do absolutely nothing. *Expected: AI never acts autonomously, confidence stays 0.*
- **T2-17 Contradictory Training:** Approve, then immediately Correct the same thing repeatedly. *Expected: NN learns 50/50 or low confidence.*
- **T2-18 TF.js Memory Limit:** Train continuously for 2 hours. *Expected: `tf.tidy()` prevents memory leaks.*
- **T2-19 Corrupted DB:** Manually delete model from IndexedDB. *Expected: Fallback to fresh untrained model without crash.*
- **T2-20 Immediate Reload:** Reload exactly while `model.fit()` is running. *Expected: Save aborts gracefully, old model kept.*

### F10: Persistence
- **T2-21 Quota Exceeded:** Fill browser storage, then save game. *Expected: Catch error, warn user via Whisper Bar.*
- **T2-22 Schema Update:** (Future proofing) Change game version. *Expected: Migrates old save or resets cleanly.*
- **T2-23 Corrupt Save:** Modify IndexedDB JSON to invalid values (e.g., agent hp: NaN). *Expected: Game detects corruption, resets.*
- **T2-24 Private Browsing:** Run in Incognito (IndexedDB behavior differs). *Expected: Works per session, warns about no long-term save.*
- **T2-25 Cross-Origin:** Try to load from local file `file://`. *Expected: CORS handles correctly (may require server).*

---

## Tier 3: Cross-Feature Interactions

- **T3-1 UI + Time:** Leave Mind Panel open while day turns to night. *Expected: Panel remains open, background updates.*
- **T3-2 Interaction + AI:** Open radial menu just as AI triggers an autonomous action on that agent. *Expected: Menu updates or closes safely.*
- **T3-3 Persistence + Tutorial:** Complete 50% of tutorial, reload page. *Expected: Resumes at 50% or restarts tutorial cleanly.*
- **T3-4 NN + Persistence:** Train AI to 80% confidence, reload, wait. *Expected: AI still acts autonomously (weights saved).*
- **T3-5 Whisper + Day/Night:** Dawn triggers at exact moment AI posts to Whisper Bar. *Expected: Both messages queue/display properly.*
- **T3-6 Agents + Journal:** Agent 2 arrives while viewing Journal. *Expected: Journal updates live or shows notification.*
- **T3-7 Interaction + Persistence:** Reload page while an action animation (e.g., Feed) is playing. *Expected: Resumes post-action state.*

---

## Tier 4: Real-World Scenarios

### T4-1: Full New User Onboarding
1. Clear browser data. Boot game.
2. Complete tutorial without skipping.
3. Wait for Agent 1. Open Mind Panel.
4. Feed Agent 1. Check Journal.
*Expected: Flawless experience, all systems introduce smoothly, no errors.*

### T4-2: Long-term Care & Observation
1. Load game with both agents present.
2. Over 3 in-game days, selectively Feed and Connect.
3. Ignore Guide/Approve/Correct.
*Expected: Agents survive, NN begins biasing toward Feed/Connect actions. Day counter hits 4.*

### T4-3: Training to Autonomy
1. Focus entirely on one agent.
2. Wait for them to perform an action. Immediately use 'Approve'.
3. Repeat 20 times.
4. Stop interacting and observe.
*Expected: Whisper Bar announces AI taking over that specific action. Agent begins looping the approved action.*

### T4-4: Play Session Resumption
1. Play normally for 15 minutes. Note exact state (time of day, agent positions, journal entries).
2. Close tab entirely.
3. Reopen tab.
*Expected: Exact state is restored via IndexedDB. NN weights are loaded. Time resumes.*

### T4-5: Interruption & Recovery
1. Start heavy interaction (spamming radial menus).
2. During the chaos, simulate browser crash (kill tab process or force close).
3. Restore tab.
*Expected: Game loads from last automatic save point. No soft-locks.*
