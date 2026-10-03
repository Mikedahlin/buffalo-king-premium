# Buffalo King 2026 — Premium Slot
# Cache-bust: 2026-premium-v1
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy project file and restore dependencies first (layer cache)
COPY Standalone/BuffaloKingWeb.csproj Standalone/
RUN dotnet restore Standalone/BuffaloKingWeb.csproj

# Copy ALL source files (wwwroot, cs files, etc.) — this layer re-runs on any file change
COPY Standalone/ Standalone/

# Publish
RUN dotnet publish Standalone/BuffaloKingWeb.csproj -c Release -o /app

# Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BuffaloKingWeb.dll"]
