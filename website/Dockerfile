FROM node:20-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM golang:1.24-alpine AS server-build

WORKDIR /src
COPY server/main.go ./server/main.go
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/static-server ./server/main.go

FROM scratch
COPY --from=build /app/dist /usr/share/nginx/html
COPY --from=server-build /out/static-server /static-server
EXPOSE 80
ENTRYPOINT ["/static-server"]
