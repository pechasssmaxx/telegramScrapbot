FROM node:22-bookworm-slim AS base
WORKDIR /app

COPY package.json package-lock.json* tsconfig.json ./
RUN npm install

COPY src ./src
COPY .env.example ./

RUN npm run build

CMD ["npm", "run", "start"]
