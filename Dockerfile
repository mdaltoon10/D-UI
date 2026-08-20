# ========================================================
# Stage: Final Image of d-ui
# ========================================================
FROM alpine
ENV TZ=Asia/Tehran
WORKDIR /app

RUN apk add --no-cache --update \
  ca-certificates \
  tzdata \
  fail2ban \
  bash \
  curl \
  openssl

# Target architecture is injected automatically by Docker Buildx
ARG TARGETARCH
ARG TARGETVARIANT

# Copy the prebuilt files directly based on TARGETARCH and TARGETVARIANT
COPY prebuilt/${TARGETARCH}${TARGETVARIANT:+/$TARGETVARIANT}/d-ui /app/d-ui
COPY prebuilt/${TARGETARCH}${TARGETVARIANT:+/$TARGETVARIANT}/bin/ /app/bin/

# Copy the static repository files directly from the build context
COPY DockerEntrypoint.sh /app/DockerEntrypoint.sh
COPY d-ui.sh /usr/bin/d-ui
COPY internal/web/translation /app/internal/web/translation

# Configure fail2ban
RUN rm -f /etc/fail2ban/jail.d/alpine-ssh.conf \
  && cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local \
  && sed -i "s/^\[ssh\]$/&\nenabled = false/" /etc/fail2ban/jail.local \
  && sed -i "s/^\[sshd\]$/&\nenabled = false/" /etc/fail2ban/jail.local \
  && sed -i "s/#allowipv6 = auto/allowipv6 = auto/g" /etc/fail2ban/fail2ban.conf

RUN chmod +x \
  /app/DockerEntrypoint.sh \
  /app/d-ui \
  /usr/bin/d-ui

ENV DUI_IN_DOCKER="true"
ENV DUI_MAIN_FOLDER="/app"
ENV DUI_ENABLE_FAIL2BAN="true"
ENV DUI_DB_TYPE=""
ENV DUI_DB_DSN=""
EXPOSE 2053
VOLUME [ "/etc/d-ui" ]
CMD [ "./d-ui" ]
ENTRYPOINT [ "/app/DockerEntrypoint.sh" ]

