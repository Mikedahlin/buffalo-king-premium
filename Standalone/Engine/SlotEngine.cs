using BuffaloKingWeb.Models;

namespace BuffaloKingWeb.Engine;

public class SlotEngine
{
    static readonly Symbol[] CardFaces = { Symbol.Ten, Symbol.Jack, Symbol.Queen, Symbol.King };
    static readonly Symbol[] StackableSymbols = { Symbol.Buffalo, Symbol.Eagle, Symbol.Wolf };

    readonly Random rng = new();
    long credits = 10000;
    long bet = 80;
    int freeSpinsRemaining;
    int totalSpins;
    long lifetimeWin;
    bool isBusy;

    public long Credits => credits;
    public long Bet => bet;
    public long MinBet => 40;
    public long MaxBet => 10_000_000_000L;   // 10 billion cap
    public int FreeSpinsRemaining => freeSpinsRemaining;
    public bool IsBusy => isBusy;
    public long LifetimeWin => lifetimeWin;
    public int TotalSpins => totalSpins;

    public SpinResult Spin(bool isFreeSpin = false)
    {
        isBusy = true;

        if (!isFreeSpin)
        {
            credits -= bet;
            totalSpins++;
        }
        else
            freeSpinsRemaining--;

        var grid = new Symbol[SlotMath.ReelCount][];
        for (int r = 0; r < SlotMath.ReelCount; r++)
        {
            grid[r] = new Symbol[SlotMath.VisibleRows];
            GenerateReelStrip(grid, r);
        }

        int coins = 0, buffalos = 0, fight = 0;
        for (int r = 0; r < SlotMath.ReelCount; r++)
            for (int row = 0; row < SlotMath.VisibleRows; row++)
            {
                if (grid[r][row] == Symbol.Coin)    coins++;
                if (grid[r][row] == Symbol.Buffalo) buffalos++;
                if (grid[r][row] == Symbol.Fight)   fight++;
            }

        var waysPayout = EvaluateWays(grid);
        long totalWaysPayout = 0;
        var winningWays = new List<WayOutcome>();
        foreach (var w in waysPayout)
        {
            if (w.Payout > 0)
            {
                totalWaysPayout += w.Payout;
                winningWays.Add(w);
            }
        }

        long scatterPayout = SlotMath.CalculateScatterPayout(bet, coins);
        long totalWin = totalWaysPayout + scatterPayout;

        int freeSpinsAwarded = 0;
        if (!isFreeSpin && coins >= bonusCoinMin)
            freeSpinsAwarded = SlotMath.CalculateFreeSpinsAwarded(coins);

        if (freeSpinsAwarded > 0)
            freeSpinsRemaining += freeSpinsAwarded;

        if (totalWin > 0)
        {
            credits += totalWin;
            lifetimeWin += totalWin;
        }

        double betMult = totalWin / (double)Math.Max(1, bet);
        string tier = betMult >= winTierGrand ? "GRAND" : betMult >= winTierMega ? "MEGA" : betMult >= winTierBig ? "BIG" : "";

        var result = new SpinResult
        {
            Grid = GridToStrings(grid),
            CoinCount = coins,
            BuffaloCount = buffalos,
            TotalWaysPayout = totalWaysPayout,
            ScatterPayout = scatterPayout,
            TotalWin = totalWin,
            Bet = bet,
            Credits = credits,
            FreeSpinsRemaining = freeSpinsRemaining,
            FreeSpinsAwarded = freeSpinsAwarded,
            FightTriggered = fight > 0,
            IsFreeSpin = isFreeSpin,
            WinTier = tier,
            WinningWays = winningWays,
            BonusRound = ""
        };

        // Flag bonus round — client handles interactive gameplay
        if ((coins >= bonusCoinMin) || (buffalos >= 4) || (fight > 0))
        {
            var round = DecideBonus(coins, buffalos, fight > 0);
            if (round != BuffaloBonusRound.None)
            {
                result.BonusRound = round.ToString();
                result.BonusCreditsWon = 0;
            }
        }

        isBusy = false;
        return result;
    }

    // ── VOLATILITY SETTINGS ─────────────────────────────────────────────────
    // Adjust these to tune game feel:
    //   stackChance:    0.0 = never stack, 0.15 = rare stacks, 0.35 = frequent
    //   wBuffalo:       lower = rarer buffalo (more valuable), higher = more common
    //   wEagle:         lower = rarer wilds
    //   bonusCoinMin:   minimum coins to trigger bonus (3 = classic, 2 = easy)
    //   winTierGrand:   bet multiplier needed for GRAND label (100 = hard, 50 = easy)
    const double stackChance = 0.15;   // was 0.35 — reduced to avoid jackpot every spin
    const float wBuffalo = 2f;         // was 4f  — rarer buffalo = bigger wins feel special
    const float wEagle   = 5f;         // was 8f  — rarer wilds
    const float wWolf    = 8f;         // was 12f
    const float wCards   = 82f;        // was 72f — more card symbols = more near-misses
    const float wCoin    = 2.5f;       // was 3.5f — slightly rarer scatter
    const float wFight   = 0.5f;       // unchanged
    const int   bonusCoinMin = 3;      // was 2 — require 3 coins for bonus
    const double winTierGrand = 100.0; // was 50 — GRAND only on truly massive wins
    const double winTierMega  = 50.0;  // was 25
    const double winTierBig   = 15.0;  // was 10
    // ────────────────────────────────────────────────────────────────────────

    void GenerateReelStrip(Symbol[][] grid, int reelIndex)
    {
        bool useStack = rng.NextDouble() < stackChance;
        if (useStack)
        {
            var stackSymbol = StackableSymbols[rng.Next(StackableSymbols.Length)];
            int stackHeight = rng.Next(2, 4); // max 3 rows stacked (was 4)
            stackHeight = Math.Min(stackHeight, SlotMath.VisibleRows);
            int startRow = rng.Next(0, SlotMath.VisibleRows - stackHeight + 1);
            for (int row = 0; row < SlotMath.VisibleRows; row++)
                grid[reelIndex][row] = row >= startRow && row < startRow + stackHeight
                    ? stackSymbol
                    : RollWeighted();
        }
        else
        {
            for (int row = 0; row < SlotMath.VisibleRows; row++)
                grid[reelIndex][row] = RollWeighted();
        }
    }

    Symbol RollWeighted()
    {
        float sum = wBuffalo + wEagle + wWolf + wCards + wCoin + wFight;
        float roll = (float)rng.NextDouble() * sum;

        if ((roll -= wBuffalo) < 0f) return Symbol.Buffalo;
        if ((roll -= wEagle)   < 0f) return Symbol.Eagle;
        if ((roll -= wWolf)    < 0f) return Symbol.Wolf;
        if ((roll -= wCards) < 0f) return CardFaces[rng.Next(CardFaces.Length)];
        if ((roll -= wCoin)  < 0f) return Symbol.Coin;
        return Symbol.Fight;
    }

    List<WayOutcome> EvaluateWays(Symbol[][] grid)
    {
        var outcomes = new List<WayOutcome>();
        var evaluated = new HashSet<Symbol>();

        for (int row = 0; row < SlotMath.VisibleRows; row++)
        {
            Symbol sym = grid[0][row];
            if (sym is Symbol.Coin or Symbol.Fight) continue;
            if (!evaluated.Add(sym)) continue;

            int consecutive = CountConsecutive(grid, sym, 1);
            int totalConsecutive = 1 + consecutive;
            long ways = CountWaysAtReel(grid, sym, totalConsecutive);
            long payout = SlotMath.CalculateWayPayout(bet, sym, totalConsecutive);

            if (payout > 0)
            {
                outcomes.Add(new WayOutcome
                {
                    Symbol = sym.ToString(),
                    ConsecutiveReels = totalConsecutive,
                    WayCount = (int)Math.Min(ways, int.MaxValue),
                    Payout = payout * ways
                });
            }
        }

        return outcomes;
    }

    int CountConsecutive(Symbol[][] grid, Symbol target, int startReel)
    {
        int count = 0;
        for (int r = startReel; r < SlotMath.ReelCount; r++)
        {
            bool found = false;
            for (int row = 0; row < SlotMath.VisibleRows; row++)
                if (grid[r][row] == target || SlotMath.IsWild(grid[r][row])) { found = true; break; }
            if (found) count++; else break;
        }
        return count;
    }

    long CountWaysAtReel(Symbol[][] grid, Symbol target, int depth)
    {
        long ways = 1;
        for (int r = 1; r < depth && r < SlotMath.ReelCount; r++)
        {
            int matches = 0;
            for (int row = 0; row < SlotMath.VisibleRows; row++)
                if (grid[r][row] == target || SlotMath.IsWild(grid[r][row]))
                    matches++;
            ways = Math.Max(1, ways * Math.Max(1, matches));
        }
        return ways;
    }

    BuffaloBonusRound DecideBonus(int coinCount, int buffaloCount, bool fightTriggered)
    {
        var eligible = new List<BuffaloBonusRound>();

        if (coinCount >= bonusCoinMin)     eligible.Add(BuffaloBonusRound.FreeSpins);
        if (coinCount >= bonusCoinMin + 1) eligible.Add(BuffaloBonusRound.BonusWheel);
        if (coinCount >= bonusCoinMin + 2) eligible.Add(BuffaloBonusRound.HoldAndSpinCoins);
        if (fightTriggered || buffaloCount >= 4) eligible.Add(BuffaloBonusRound.StampedeBonus);
        if (fightTriggered || buffaloCount >= 5) eligible.Add(BuffaloBonusRound.PickAPrize);
        if (buffaloCount >= 3) eligible.Add(BuffaloBonusRound.ExpandingBuffaloWilds);

        if (eligible.Count == 0) return BuffaloBonusRound.None;
        if (eligible.Count == 1) return eligible[0];

        int[] weights = new int[eligible.Count];
        int totalWeight = 0;
        for (int i = 0; i < eligible.Count; i++)
        {
            int w = eligible[i] switch
            {
                BuffaloBonusRound.FreeSpins           => 24,
                BuffaloBonusRound.BonusWheel          => 18,
                BuffaloBonusRound.HoldAndSpinCoins    => 14,
                BuffaloBonusRound.StampedeBonus       => 16,
                BuffaloBonusRound.PickAPrize          => 16,
                BuffaloBonusRound.ExpandingBuffaloWilds => 12,
                _ => 1
            };
            weights[i] = w;
            totalWeight += w;
        }

        int roll = rng.Next(0, totalWeight);
        int cursor = 0;
        for (int i = 0; i < eligible.Count; i++)
        {
            cursor += weights[i];
            if (roll < cursor) return eligible[i];
        }
        return eligible[^1];
    }

    public void AddCredits(long amount) { if (amount > 0) credits += amount; }
    public void AddFreeSpins(int amount) { if (amount > 0) freeSpinsRemaining += amount; }

    public bool TrySetBet(long newBet)
    {
        if (isBusy || newBet < MinBet || newBet > MaxBet) return false;
        bet = newBet;
        return true;
    }

    public GameState GetState() => new()
    {
        Credits = credits,
        Bet = bet,
        MinBet = MinBet,
        MaxBet = MaxBet,
        FreeSpinsRemaining = freeSpinsRemaining,
        IsBusy = isBusy,
        LifetimeWin = lifetimeWin,
        TotalSpins = totalSpins,
        Jackpots = new JackpotInfo
        {
            Mini  = bet * 25,
            Minor = bet * 50,
            Major = bet * 100,
            Grand = bet * 500
        }
    };

    static string[][] GridToStrings(Symbol[][] grid)
    {
        var result = new string[SlotMath.ReelCount][];
        for (int r = 0; r < SlotMath.ReelCount; r++)
        {
            result[r] = new string[SlotMath.VisibleRows];
            for (int row = 0; row < SlotMath.VisibleRows; row++)
                result[r][row] = grid[r][row].ToString();
        }
        return result;
    }
}
