# Academy automation for Camoufox

User requested adapting the existing three-quiz local runner to Profile Workspace's Camoufox engine, preserving arbitrary profile selection, the 24-answer bank, preflight and verified XP claims. This follows the approved direction in the conversation: use the app's owned Playwright contexts rather than attempting Chromium CDP on Firefox.

The trusted manager receives one narrow `academy` IPC method with validated profile ID, one of analyze/quiz/claim, and a fixed course slug where required. The Camoufox worker uses its existing persistent context and a dedicated Academy tab. No arbitrary URL, script, credential or cookie interface is exposed. Provider authentication remains manual. Requests are serialized per native profile and have bounded page waits. Native automation must not launch a second browser on an existing profile directory.

The external START runner discovers running native profiles from the manager and issues narrow actions. Existing Chromium support remains. Local reports distinguish quiz completion from XP delivery; repeat runs inspect saved site results and do not reopen a successful exam. Full-bank analysis runs before answering, unknown questions stop, and XP claims target real buttons despite decorative duplicate text.

Alternatives: direct CDP cannot control Firefox; serving persistent profiles through an external Camoufox browser server is not supported by this integration. Reusing the owned worker avoids session copying and profile corruption.

Validation: unit rules/IPC guards, real Camoufox routed fixture with three quizzes and XP, package/build checks, and installed-app read-only readiness. Live provider logins and unknown account state must not be invented as verified.
