@echo off
setlocal

:: 0. Di chuyen TOAN BO du an Android bi "lac" tai C:\Users\Hhung vao dung vi tri goz-mauve/z
echo [0/3] Dang don dep va di chuyen du an Android ve dung cho...

:: Danh sach cac thu muc va file can di chuyen
set "ROOT=C:\Users\Hhung"
if exist "%ROOT%\app" move "%ROOT%\app" "."
if exist "%ROOT%\gradle" move "%ROOT%\gradle" "."
if exist "%ROOT%\gradlew" move "%ROOT%\gradlew" "."
if exist "%ROOT%\gradlew.bat" move "%ROOT%\gradlew.bat" "."
if exist "%ROOT%\build.gradle" move "%ROOT%\build.gradle" "."
if exist "%ROOT%\settings.gradle" move "%ROOT%\settings.gradle" "."
if exist "%ROOT%\gradle.properties" move "%ROOT%\gradle.properties" "."
if exist "%ROOT%\android.keystore" move "%ROOT%\android.keystore" "."
if exist "%ROOT%\store_icon.png" move "%ROOT%\store_icon.png" "."
if exist "%ROOT%\twa-manifest.json" move "%ROOT%\twa-manifest.json" "."
if exist "%ROOT%\manifest-checksum.txt" move "%ROOT%\manifest-checksum.txt" "."

:: 1. Thiet lap JAVA_HOME tu bo cai cua Bubblewrap
set "JAVA_HOME=C:\Users\Hhung\.bubblewrap\jdk\jdk-17.0.11+9"
echo [1/3] Da thiet lap JAVA_HOME: %JAVA_HOME%

:: 2. Tu dong dong y tat ca cac Dieu khoan (Licenses)
echo [2/3] Dang chap nhan ban quyen Android SDK...
(for /L %%i in (1,1,10) do @echo y) | "C:\Users\Hhung\.bubblewrap\android_sdk\tools\bin\sdkmanager.bat" --licenses

:: 3. Chay lenh Build cua Bubblewrap
echo [3/3] Dang bat dau Build APK cho Goz Finance...
echo [LUU Y] Vui long nhap MAT KHAU va nhan ENTER khi duoc hoi!
call bubblewrap build

echo.
echo ======================================================
echo DA HOAN TAT! Ban hay kiem tra file: app-release-signed.apk
echo ======================================================
pause
