FROM node:18-alpine AS build
ARG GITHUB_USERNAME_TOKEN
WORKDIR /build-website
ADD https://github.com/gohugoio/hugo/releases/download/v0.145.0/hugo_0.145.0_Linux-64bit.tar.gz hugo.tar.gz
RUN echo "5be7b7d5026d01515685a8aad1ca015133c0569688819f139ae9fb21e33fd9aa  hugo.tar.gz" | sha256sum -c
RUN tar -zxvf hugo.tar.gz
COPY package-lock.json package.json ./
RUN npm ci
COPY . ./
RUN npm run build
RUN ./hugo --logLevel info
RUN npm run create-modules-json
RUN rm ./public/package.json
RUN rm ./public/package-lock.json
RUN find public -type f -regex '^.*\.\(svg\|css\|html\|xml\)$' -size +1k -exec gzip -k '{}' \;

FROM nginx:stable-alpine
RUN apk add --no-cache nodejs npm
RUN npm i -g forever
COPY --from=build /build-website/redirects.txt /etc/nginx/conf.d/
COPY --from=build /build-website/public /usr/share/nginx/html
COPY --from=build /build-website/proxy /usr/share/proxy
COPY ./entrypoint.sh /entrypoint.sh
COPY ./nginx.conf /etc/nginx/nginx.conf
ENTRYPOINT /entrypoint.sh
