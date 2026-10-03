namespace BuffaloKingWeb.Models;

public enum Symbol
{
    Buffalo, Eagle, Wolf, Ten, Jack, Queen, King, Coin, Fight
}

public enum BuffaloBonusRound
{
    None = 0,
    FreeSpins = 1,
    BonusWheel = 2,
    HoldAndSpinCoins = 3,
    StampedeBonus = 4,
    PickAPrize = 5,
    ExpandingBuffaloWilds = 6
}

public class WayOutcome
{
    public string Symbol { get; set; } = "";
    public int ConsecutiveReels { get; set; }
    public int WayCount { get; set; }
    public long Payout { get; set; }   // long: prevents overflow at high bets
}

public class SpinResult
{
    public string[][] Grid { get; set; } = Array.Empty<string[]>();
    public int CoinCount { get; set; }
    public int BuffaloCount { get; set; }
    public long TotalWaysPayout { get; set; }
    public long ScatterPayout { get; set; }
    public long TotalWin { get; set; }
    public long Bet { get; set; }
    public long Credits { get; set; }
    public int FreeSpinsRemaining { get; set; }
    public int FreeSpinsAwarded { get; set; }
    public bool FightTriggered { get; set; }
    public bool IsFreeSpin { get; set; }
    public string WinTier { get; set; } = "";
    public List<WayOutcome> WinningWays { get; set; } = new();
    public string BonusRound { get; set; } = "";
    public long BonusCreditsWon { get; set; }
}

public class GameState
{
    public long Credits { get; set; }
    public long Bet { get; set; }
    public long MinBet { get; set; }
    public long MaxBet { get; set; }
    public int FreeSpinsRemaining { get; set; }
    public bool IsBusy { get; set; }
    public long LifetimeWin { get; set; }
    public int TotalSpins { get; set; }
    public JackpotInfo? Jackpots { get; set; }
}

public class JackpotInfo
{
    public long Mini { get; set; }
    public long Minor { get; set; }
    public long Major { get; set; }
    public long Grand { get; set; }
}

public class BetChangeRequest
{
    public long Bet { get; set; }
}
