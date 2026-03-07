#!/bin/sh
set -e

# 1. Run the original Penpot entrypoint to generate nginx.conf
/bin/bash /entrypoint.sh

# 2. Patch nginx.conf for dynamic DNS resolution
# This prevents nginx from crashing when upstream containers aren't ready yet
sed -i 's|proxy_pass http://penpot-exporter:6061;|resolver 127.0.0.11 valid=30s; set $exporter_url http://penpot-exporter:6061; proxy_pass $exporter_url;|g' /etc/nginx/nginx.conf
sed -i 's|proxy_pass http://penpot-backend:6060/api;|set $backend_url http://penpot-backend:6060; proxy_pass $backend_url/api;|g' /etc/nginx/nginx.conf

# 3. Start nginx (the original CMD)
exec nginx -g 'daemon off;'
