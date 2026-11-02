FROM alpine AS base

ARG BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=${BUN_RUNTIME_TRANSPILER_CACHE_PATH}
RUN apk add --no-cache libgcc libstdc++ ripgrep

FROM base AS build-amd64
COPY dist/cli-linux-x64-baseline-musl/bin/opencode /usr/local/bin/bolt

FROM base AS build-arm64
COPY dist/cli-linux-arm64-musl/bin/opencode /usr/local/bin/bolt

ARG TARGETARCH
FROM build-${TARGETARCH}
RUN ln -s bolt /usr/local/bin/opencode && bolt --version && opencode --version
ENTRYPOINT ["bolt"]
