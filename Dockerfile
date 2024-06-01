FROM node:latest
LABEL authors="swaggeroo"

EXPOSE 3000

WORKDIR /app
COPY ["package.json", "package-lock.json", "app.ts", "./"]
COPY routes ./routes
COPY config ./config
COPY models ./models
COPY services ./services
COPY utils ./utils

RUN npm install

CMD ["npm", "start"]