# Multi-stage build: compile the Vite app, then serve the static bundle with nginx
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS serve
WORKDIR /usr/share/nginx/html

COPY --from=build /app/dist ./ 

# Replace default nginx site with a minimal static file server
RUN rm -f /etc/nginx/conf.d/default.conf
COPY <<'NGINX_CONF' /etc/nginx/conf.d/default.conf
server {
  listen 80;
  listen [::]:80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
NGINX_CONF

CMD ["nginx", "-g", "daemon off;"]
