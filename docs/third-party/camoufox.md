# Camoufox runtime

The application uses the [Camoufox TypeScript launcher](https://github.com/daijro/camoufox/tree/main/typescript), version0.5.9 (MIT). Its license and third-party notices are retained beside this file. Native Firefox/Camoufox is fetched separately from upstream; this installer does not bundle the browser source or binary. Engine source and its own notices remain available from the [upstream project](https://github.com/daijro/camoufox).

The SDK uses UAParser only for getOS/getBrowser. A package override pins the compatible MIT-licensed ua-parser-js1.0.41, rather than shipping its AGPL-licensed 2.x dependency. Windows Firefox UA parsing, native profile launches and packaged behavior are verified with this override. Playwright-core 1.62.0 is pinned for the SDK's declared protocol compatibility.
