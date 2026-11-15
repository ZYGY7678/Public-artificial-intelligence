# AI Talk — Qin 1S compatibility prototype

Target: Android API 19 / Android 4.4.4 (MOCOR5-derived firmware).
Reported Qin 1S hardware: Spreadtrum SC9820E, dual Cortex-A53, 256 MB RAM, 512 MB internal storage, 240x320 display.

This prototype contains:
- Compact portrait UI for 240x320.
- Typed chat input.
- Android SpeechRecognizer intent configured for Hebrew (requires a compatible recognition service; often network-dependent).
- Android TextToSpeech (requires an installed Hebrew voice; not guaranteed offline).
- Minimum API 19.

IMPORTANT:
- This is NOT a working AI assistant yet. LocalAssistant is an explicit placeholder.
- A general-purpose Hebrew LLM running fully offline is not a realistic promise on the Qin 1S's 256 MB RAM and 512 MB internal storage. The operating system and apps consume a substantial portion of those resources.
- Public reports confirm Android-derived MOCOR5 / Android 4.4.4 foundations, but third-party APK installation varies by firmware and may be restricted. Test installation on the exact handset.
- Speech recognition and TTS are system services, not bundled offline Hebrew engines.

Build:
Gradle 6.7.1 + Android Gradle Plugin 4.2.2 + JDK 11; Android SDK platform 29/build-tools 29.0.3.
