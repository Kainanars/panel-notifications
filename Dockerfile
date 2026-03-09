FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 3030
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3030/health || exit 1
CMD ["node", "server.js"]
