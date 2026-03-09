FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install necessary underlying system tools if needed
RUN apk add --no-cache git openssh-client bash curl jq

# Configure git global settings
RUN git config --global http.lowSpeedLimit 1000 && \
    git config --global http.lowSpeedTime 60

# We will mount the core code and user home as volumes,
# so we don't need to copy them here right now.
# However, we need an entrypoint for the eternal loop.

# Set up the eternal loop runner
COPY agent-loop.js /app/agent-loop.js

# We give the entrypoint execution rights
RUN chmod +x /app/agent-loop.js

# Environment variables
ENV ANTIGRAVITY_DIR=/antigravity
ENV HOST_HOME=/host_home

CMD ["node", "/app/agent-loop.js"]
