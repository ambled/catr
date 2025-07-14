FROM node:20-alpine
WORKDIR /usr/local/atr

COPY . .
EXPOSE 5000
RUN npm install && npm run build

CMD ["npm","run","preview","--","--host","--port","5000"]
