FROM node:22-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm ci || npm install --production
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
RUN mkdir -p uploads log
CMD ["node","server.js"]
