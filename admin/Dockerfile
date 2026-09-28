# syntax=docker/dockerfile:1
#
# Build the Vite bundle, then serve the static output from nginx as an
# unprivileged, read-only container. The final image contains no Node.js and no
# node_modules, which is typically 300-400 MB smaller than a Node runtime image.

# ---------------------------------------------------------------- build stage
FROM node:22-alpine AS builder

WORKDIR /build

# Lockfile-first, so `npm ci` is used instead of `npm install`. npm ci installs
# exactly what the lockfile pins and fails if package.json and the lockfile
# disagree, which is what stops "worked yesterday" dependency drift.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# -------------------------------------------------------------- runtime stage
FROM nginx:1.27-alpine AS runtime

# nginx:alpine ships an unprivileged `nginx` user and a pid file under /tmp.
RUN touch /var/run/nginx.pid \
 && chown -R nginx:nginx /var/run/nginx.pid /var/cache/nginx

COPY --from=builder --chown=nginx:nginx /build/dist /usr/share/nginx/html

# Static shim; the real config is rendered into /tmp/nginx at startup.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Render into /tmp so the unprivileged nginx user can write there, instead of
# needing write access to /etc/nginx/conf.d. The directory must be created here:
# the entrypoint tests that the output directory is already writable and skips
# rendering entirely if it is not.
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp/nginx
RUN mkdir -p /tmp/nginx && chown nginx:nginx /tmp/nginx && chmod 755 /tmp/nginx

USER nginx
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:8080/healthz" >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
