#!/bin/sh
# Start a virtual X display, then the OpenRCT2 client with the given arguments.
Xvfb :99 -screen 0 1024x768x24 -nolisten tcp >/dev/null 2>&1 &
export DISPLAY=:99
for i in $(seq 1 50); do [ -e /tmp/.X11-unix/X99 ] && break; sleep 0.1; done
exec /app/AppRun "$@"
