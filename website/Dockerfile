FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# nginx:alpine vult ${VARIABELEN} in templates in bij het opstarten van de container.
COPY nginx.conf /etc/nginx/templates/default.conf.template
# Chat staat standaard uit; zet CHAT_ENABLED=true in docker-compose om hem aan te zetten.
ENV CHAT_ENABLED=false
EXPOSE 80
