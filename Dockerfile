FROM node:20-alpine
WORKDIR /usr/local/atr

COPY . .
EXPOSE 5173
RUN npm install

CMD ["npm","run","dev","--","--host"]
