using BuffaloKingWeb.Engine;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<SlotEngine>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.UseDefaultFiles();
app.UseStaticFiles();

var engine = app.Services.GetRequiredService<SlotEngine>();

app.MapGet("/api/state", (SlotEngine e) => e.GetState());

app.MapPost("/api/spin", (SlotEngine e) =>
{
    var state = e.GetState();
    if (state.Credits < state.Bet && state.FreeSpinsRemaining <= 0)
        return Results.BadRequest(new { error = "Insufficient credits" });

    bool isFreeSpin = state.FreeSpinsRemaining > 0;
    var result = e.Spin(isFreeSpin);
    return Results.Ok(result);
});

app.MapPost("/api/bonus-collect", (BonusCollectRequest req, SlotEngine e) =>
{
    if (req.Credits > 0) e.AddCredits(req.Credits);
    if (req.FreeSpins > 0) e.AddFreeSpins(req.FreeSpins);
    return Results.Ok(e.GetState());
});

app.MapPost("/api/add-credits", (SlotEngine e) =>
{
    e.AddCredits(10000);
    return Results.Ok(e.GetState());
});

app.MapPost("/api/bet", (BetChangeRequest req, SlotEngine e) =>
{
    if (e.TrySetBet(req.Bet))
        return Results.Ok(new { bet = e.Bet });
    return Results.BadRequest(new { error = "Invalid bet" });
});

var port = Environment.GetEnvironmentVariable("PORT") ?? "8080";
app.Urls.Add($"http://0.0.0.0:{port}");

Console.WriteLine($"Buffalo King running on port {port}");
app.Run();

public record BetChangeRequest(long Bet);
public record BonusCollectRequest(long Credits, int FreeSpins);
