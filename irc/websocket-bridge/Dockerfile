# Kleine websocket-naar-TCP brug zodat de website (browser) met ngircd kan praten.
FROM python:3.13-alpine
RUN pip install --no-cache-dir websockify==0.13.0
USER nobody
EXPOSE 8080
ENTRYPOINT ["websockify"]
CMD ["8080", "ngircd:6667"]
