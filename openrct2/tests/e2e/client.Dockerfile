# Headless OpenRCT2 *client* for end-to-end tests: the official Linux AppImage
# (extracted, mounted at /app) running under Xvfb. Not used in production.
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb xauth libgl1 libegl1 libx11-6 libxext6 libxrandr2 libxcursor1 libxi6 libxss1 libxxf86vm1 \
      libasound2t64 libpulse0 libfontconfig1 libfreetype6 libdbus-1-3 libwayland-client0 libwayland-cursor0 \
      libwayland-egl1 libxkbcommon0 libdecor-0-0 ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV SDL_AUDIODRIVER=dummy HOME=/tmp
COPY client-entrypoint.sh /usr/local/bin/client-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/client-entrypoint.sh"]
