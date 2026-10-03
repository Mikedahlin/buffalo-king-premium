FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY Standalone/BuffaloKingWeb.csproj Standalone/
RUN dotnet restore Standalone/BuffaloKingWeb.csproj

COPY Standalone/ Standalone/
RUN dotnet publish Standalone/BuffaloKingWeb.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BuffaloKingWeb.dll"]
