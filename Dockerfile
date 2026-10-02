FROM trafex/php-nginx

USER root
RUN apk add --no-cache php85-pdo_mysql
USER nobody

COPY --chown=nobody . /var/www/html/
COPY --chown=nobody conf.php.example /var/www/html/conf.php
RUN rm -rf .git Dockerfile .dockerignore
