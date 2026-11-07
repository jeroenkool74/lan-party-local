# OpenRCT2 dedicated server for the LAN party.
# Based on the official image (https://github.com/OpenRCT2/openrct2-docker), pinned.
ARG OPENRCT2_VERSION=0.5.7
FROM openrct2/openrct2-cli:${OPENRCT2_VERSION}

USER root
# jq: safe JSON edits of users.json / plugin.store.json; patch: apply the FFA patches
RUN apt-get update \
 && apt-get install --no-install-recommends -y jq patch \
 && rm -rf /var/lib/apt/lists/*

# Plugins are baked into the image; the entrypoint copies the enabled ones into
# the data volume (plugin/managed/) on every start.
COPY plugins/ffa-suite/upstream/lib/ /opt/lan/plugins/ffa/
COPY plugins/ffa-suite/patches/ /tmp/ffa-patches/
RUN cd /opt/lan/plugins/ffa \
 && for p in /tmp/ffa-patches/*.patch; do echo "applying $p"; patch -p2 --no-backup-if-mismatch < "$p"; done \
 && rm -rf /tmp/ffa-patches
COPY plugins/lan-stats/lan-stats.js /opt/lan/plugins/lan-stats/lan-stats.js
COPY server/defaults/ /opt/lan/defaults/
COPY server/bin/ /opt/lan/bin/
RUN chmod 0755 /opt/lan/bin/*

# /data is the OpenRCT2 user directory (named volume, initialised from the image).
RUN mkdir -p /data /park && chown openrct2:openrct2 /data
USER openrct2
ENV OPENRCT2_DATA=/data \
    PARK_DIR=/park \
    HOME=/tmp
EXPOSE 11753
ENTRYPOINT ["/opt/lan/bin/entrypoint.sh"]
