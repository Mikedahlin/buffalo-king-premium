# Buffalo King Premium

This is the clean web deployment source for Buffalo King. It contains the full
ASP.NET 8 game server plus the real Buffalo King artwork, audio, and bonus
video under `Standalone/wwwroot`.

## Local run

```powershell
dotnet run --project .\Standalone\BuffaloKingWeb.csproj
```

The app listens on port `8080` by default, or the port provided through the
`PORT` environment variable.

## Important hosting note

This is an ASP.NET application with live `/api` routes. Vercel's static hosting
cannot run the .NET process directly. The Dockerfile is included for a .NET
container host. A Vercel front end would need a separate API host or a full
port of the game engine to Vercel Functions.

