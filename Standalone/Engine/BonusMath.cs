using BuffaloKingWeb.Models;

namespace BuffaloKingWeb.Engine;

public struct BonusSpinContext
{
    public int Bet;
    public int CoinCount;
    public int BuffaloCount;
    public int EagleCount;
    public int WolfCount;
    public bool FightTriggered;
}

public struct BonusRoundResult
{
    public BuffaloBonusRound Round;
    public int CreditsWon;
    public int FreeSpinsAwarded;
    public string Summary;
}

public static class BonusMath
{
    public static BonusRoundResult ResolveRound(BuffaloBonusRound round, BonusSpinContext context, Random random)
    {
        return round switch
        {
            BuffaloBonusRound.FreeSpins => ResolveFreeSpins(context, random),
            BuffaloBonusRound.BonusWheel => ResolveBonusWheel(context, random),
            BuffaloBonusRound.HoldAndSpinCoins => ResolveHoldAndSpin(context, random),
            BuffaloBonusRound.StampedeBonus => ResolveStampede(context, random),
            BuffaloBonusRound.PickAPrize => ResolvePickAPrize(context, random),
            BuffaloBonusRound.ExpandingBuffaloWilds => ResolveExpandingWilds(context, random),
            _ => new BonusRoundResult { Round = BuffaloBonusRound.None, CreditsWon = 0, Summary = "No bonus." }
        };
    }

    static BonusRoundResult ResolveFreeSpins(BonusSpinContext context, Random rng)
    {
        int spins = Clamp(context.CoinCount + 8, 8, 20);
        int total = 0;
        int retriggered = 0;
        for (int i = 0; i < spins; i++)
        {
            int mult = RollMultiplier(rng, 2, 6);
            int perSpin = context.Bet * mult;
            if (rng.NextDouble() < 0.22) perSpin += context.Bet * RollMultiplier(rng, 2, 4);
            if (rng.NextDouble() < 0.08) retriggered += 2;
            total += perSpin;
        }
        return new BonusRoundResult
        {
            Round = BuffaloBonusRound.FreeSpins,
            CreditsWon = total,
            FreeSpinsAwarded = retriggered,
            Summary = $"Free Spins: {spins} spins, +{retriggered} retrigger."
        };
    }

    static BonusRoundResult ResolveBonusWheel(BonusSpinContext context, Random rng)
    {
        int[] mults = { 4, 5, 6, 8, 10, 12, 15, 20, 30 };
        int[] weights = { 16, 16, 14, 14, 12, 10, 8, 7, 3 };
        int picked = mults[RollWeighted(weights, rng)];
        bool jackpot = rng.NextDouble() < 0.015;
        return new BonusRoundResult
        {
            Round = BuffaloBonusRound.BonusWheel,
            CreditsWon = (context.Bet * picked) + (jackpot ? context.Bet * 150 : 0),
            FreeSpinsAwarded = jackpot ? 3 : 0,
            Summary = $"Bonus Wheel: x{picked}" + (jackpot ? " + JACKPOT!" : "")
        };
    }

    static BonusRoundResult ResolveHoldAndSpin(BonusSpinContext context, Random rng)
    {
        int locked = Clamp(context.CoinCount, 3, 15);
        int respins = 3;
        int total = 0;
        for (int i = 0; i < locked; i++)
            total += context.Bet * RollMultiplier(rng, 1, 10);
        while (respins > 0 && locked < 15)
        {
            if (rng.NextDouble() < 0.35)
            {
                total += context.Bet * RollMultiplier(rng, 2, 12);
                respins = 3;
                locked++;
            }
            else respins--;
        }
        int grand = locked >= 15 ? context.Bet * 120 : 0;
        return new BonusRoundResult
        {
            Round = BuffaloBonusRound.HoldAndSpinCoins,
            CreditsWon = total + grand,
            Summary = $"Hold-and-Spin: locked {locked} coins."
        };
    }

    static BonusRoundResult ResolveStampede(BonusSpinContext context, Random rng)
    {
        int waves = Clamp(2 + context.BuffaloCount / 2, 2, 6);
        int total = 0;
        for (int i = 0; i < waves; i++)
        {
            total += context.Bet * RollMultiplier(rng, 3, 14);
            if (context.FightTriggered && rng.NextDouble() < 0.25)
                total += context.Bet * RollMultiplier(rng, 6, 12);
        }
        return new BonusRoundResult
        {
            Round = BuffaloBonusRound.StampedeBonus,
            CreditsWon = total,
            FreeSpinsAwarded = rng.NextDouble() < 0.2 ? 2 : 0,
            Summary = $"Stampede: {waves} charge waves."
        };
    }

    static BonusRoundResult ResolvePickAPrize(BonusSpinContext context, Random rng)
    {
        int total = 0;
        int[] prizes = { 3, 5, 8, 10, 12, 15, 18, 25 };
        int[] weights = { 18, 17, 16, 14, 12, 10, 8, 5 };
        for (int i = 0; i < 3; i++)
            total += context.Bet * prizes[RollWeighted(weights, rng)];
        return new BonusRoundResult
        {
            Round = BuffaloBonusRound.PickAPrize,
            CreditsWon = total,
            Summary = "Pick-a-Prize: 3 animal picks."
        };
    }

    static BonusRoundResult ResolveExpandingWilds(BonusSpinContext context, Random rng)
    {
        int reels = Clamp(2 + context.BuffaloCount / 3, 2, 5);
        int total = 0;
        for (int r = 0; r < reels; r++)
            total += context.Bet * RollMultiplier(rng, 4, 12);
        int superExpand = rng.NextDouble() < 0.12 ? context.Bet * 40 : 0;
        return new BonusRoundResult
        {
            Round = BuffaloBonusRound.ExpandingBuffaloWilds,
            CreditsWon = total + superExpand,
            FreeSpinsAwarded = rng.NextDouble() < 0.25 ? 2 : 0,
            Summary = $"Expanding Wilds: {reels} reels expanded."
        };
    }

    static int RollWeighted(int[] weights, Random rng)
    {
        int sum = 0;
        foreach (var w in weights) sum += Math.Max(0, w);
        if (sum <= 0) return 0;
        int roll = rng.Next(0, sum);
        int cursor = 0;
        for (int i = 0; i < weights.Length; i++)
        {
            cursor += Math.Max(0, weights[i]);
            if (roll < cursor) return i;
        }
        return weights.Length - 1;
    }

    static int RollMultiplier(Random rng, int min, int max) => min > max ? min : rng.Next(min, max + 1);
    static int Clamp(int v, int min, int max) => v < min ? min : v > max ? max : v;
}
