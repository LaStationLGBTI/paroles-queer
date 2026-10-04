FROM trafex/php-nginx

USER nobody

COPY --chown=nobody . /var/www/html/
RUN rm -rf .git Dockerfile .dockerignore index.php  # Site statique pour le moment
