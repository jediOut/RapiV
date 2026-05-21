FROM node:22-alpine AS deps

WORKDIR /app

COPY backend/package*.json ./backend/
COPY shared/contracts/package.json ./shared/contracts/
COPY shared/contracts/src ./shared/contracts/src

WORKDIR /app/backend
RUN npm ci

FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY shared/contracts ./shared/contracts

WORKDIR /app/backend
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app/backend

COPY --from=build /app/backend/package*.json ./
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
