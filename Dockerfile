FROM oven/bun

WORKDIR /usr/src/app

COPY package*.json bun.lockb ./

RUN bun install

COPY src ./src

ENV NODE_ENV production

CMD [ "bun", "run", "app" ]
