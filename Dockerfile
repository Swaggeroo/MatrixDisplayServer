FROM node:24.11.1
LABEL authors="swaggeroo"

EXPOSE 3000

RUN apt update && apt install -y ffmpeg

WORKDIR /app
COPY ["package.json", "package-lock.json", "tsconfig.json", "app.ts", "./"]
COPY routes ./routes
COPY config ./config
COPY models ./models
COPY services ./services
COPY utils ./utils

RUN npm install
RUN npm run build

CMD ["npm", "start"]
