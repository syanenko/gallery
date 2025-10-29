adb devices
REM adb logcat
REM adb logcat chromium:D WebView:D *:S
REM adb logcat browser:V *:S
REM adb logcat *:V | grep QQ
adb reverse tcp:8086 tcp:8086

