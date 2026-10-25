@echo off
title Amsterdam Light Festival - local preview
cd /d "%~dp0"
echo.
echo   Amsterdam Light Festival - local preview
echo   ---------------------------------------
echo   Starting a small web server on port 8099.
echo   Your browser will open automatically.
echo.
echo   Keep this window open while you look at the site.
echo   Close it (or press Ctrl+C) when you are done.
echo.
start "" http://127.0.0.1:8099/
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m http.server 8099
) else (
  python -m http.server 8099
)
pause
