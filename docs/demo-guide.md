# Guided feasibility demonstration

Allow approximately **5–8 minutes** to inspect the idea. There is no fixed recording limit for this engineering walkthrough. The competition's shorter submission video is a separate deliverable.

1. **The question (30 seconds).** Open the angled-option scene. Follow A7, who never receives a pass in the clip. Explain that the displayed index concerns a hypothetical immediate ground pass.
2. **Inspect a frame (60 seconds).** Pause and switch to Analyst. Locate the receiving candidate, lane bottleneck and positional offside line. Read the component scores and arrival times. A line-margin estimate is not a calibrated probability.
3. **Compare two runs (60 seconds).** Show the smooth-stop alternative over the common 2.5-second window. Explain equal initial position and velocity, bounded acceleration and fixed surrounding trajectories. Select the identical route: its difference must be zero. Restore the smooth stop.
4. **Test the counterexamples (60–90 seconds).** In Into traffic, inspect a late frame and the passing-lane component. In Too early, compare the onset of unreachable candidates with the later offside-position gate. Avoid saying every zero is caused by offside.
5. **Ask for evidence (60 seconds).** Ask why the run matters, inspect the tool trace, and jump to an evidence frame. State explicitly that the default answer is a local deterministic template. A configured Foundry model chooses tools and evidence, with numerical text verified by the application.
6. **Challenge assumptions (60 seconds).** Change ball speed, check nine perturbations, and inspect the best team option. Personal receiving improvement need not improve the team's maximum. These ranges are not statistical confidence intervals.
7. **Reproduce (30 seconds).** Export the JSON evidence. Show the fixed-seed generator, method, test command and independent review. Describe what would be required to validate against expert judgments or real tracking data.

## A later competition recording

After a real Foundry smoke check succeeds, record a separate English video under two minutes: the question, one comparison, one actual cloud tool trace, one counterexample, and an honest scope statement. Do not substitute a template answer for a live cloud demonstration.
