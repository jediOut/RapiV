FROM node:20-bookworm

ARG ANDROID_COMMANDLINE_TOOLS_VERSION=13114758
ARG EAS_CLI_VERSION=latest

ENV ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 \
    PATH=/opt/android-sdk/cmdline-tools/latest/bin:/opt/android-sdk/platform-tools:/usr/lib/jvm/java-17-openjdk-amd64/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      jq \
      openjdk-17-jdk \
      openssh-client \
      unzip \
      zip \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p "$ANDROID_HOME/cmdline-tools" \
    && curl --http1.1 --retry 5 --retry-delay 5 --retry-all-errors -fsSL "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_COMMANDLINE_TOOLS_VERSION}_latest.zip" -o /tmp/android-commandline-tools.zip \
    && unzip -q /tmp/android-commandline-tools.zip -d /tmp/android-commandline-tools \
    && mv /tmp/android-commandline-tools/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest" \
    && rm -rf /tmp/android-commandline-tools /tmp/android-commandline-tools.zip

RUN yes | sdkmanager --licenses >/dev/null \
    && sdkmanager \
      "platform-tools" \
      "platforms;android-35" \
      "platforms;android-36" \
      "build-tools;35.0.0" \
      "build-tools;36.0.0"

RUN npm install --global "eas-cli@${EAS_CLI_VERSION}" \
    && npm cache clean --force

WORKDIR /workspace

CMD ["bash"]
