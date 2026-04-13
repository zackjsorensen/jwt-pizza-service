ARG NODE_VERSION=22

# FROM node:${NODE_VERSION}-alpine
FROM node:20-slim
WORKDIR /usr/src/app
COPY . .
RUN npm ci
EXPOSE 80
CMD ["node", "index.js", "80"]
