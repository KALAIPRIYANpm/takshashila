# Build the React app, then ship only the server, its one dependency (pg) and the built files.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY client ./client
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/client/dist ./client/dist
# Uploads live here; mount a persistent disk (Render) or volume (Railway) at /var/data.
ENV UPLOAD_DIR=/var/data/uploads
RUN mkdir -p /var/data/uploads
EXPOSE 4000
CMD ["node", "server/index.js"]
