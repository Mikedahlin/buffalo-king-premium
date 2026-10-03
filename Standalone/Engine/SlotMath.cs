using BuffaloKingWeb.Models;

namespace BuffaloKingWeb.Engine;

public static class SlotMath
{
    public const int ReelCount = 6;
    public const int VisibleRows = 4;

    public static long CalculateWayPayout(long bet, Symbol symbol, int consecutiveCount)
    {
        if (bet <= 0 || consecutiveCount < 2) return 0;

        long basePayout = symbol switch
        {
            Symbol.Buffalo => consecutiveCount switch { 2 => 2, 3 => 10, 4 => 50, 5 => 250, _ => 500 },
            Symbol.Eagle   => consecutiveCount switch { 2 => 1, 3 => 6,  4 => 20, 5 => 100, _ => 200 },
            Symbol.Wolf    => consecutiveCount switch { 3 => 5, 4 => 15, 5 => 75, _ => 150 },
            Symbol.Ten or Symbol.Jack or Symbol.Queen or Symbol.King
                           => consecutiveCount switch { 3 => 3, 4 => 10, 5 => 40, _ => 80 },
            _ => 0
        };

        return bet * basePayout;
    }

    public static long CalculateScatterPayout(long bet, int coinCount)
    {
        if (bet <= 0 || coinCount < 2) return 0;
        return coinCount switch
        {
            2 => bet * 2,
            3 => bet * 5,
            4 => bet * 20,
            5 => bet * 50,
            _ => bet * coinCount * 5
        };
    }

    public static int CalculateFreeSpinsAwarded(int coinCount)
    {
        return coinCount >= 5 ? 25 : coinCount == 4 ? 15 : coinCount >= 2 ? 8 : 0;
    }

    public static bool IsWild(Symbol s) => s == Symbol.Eagle;
    public static bool IsCard(Symbol s) => s is Symbol.Ten or Symbol.Jack or Symbol.Queen or Symbol.King;
    public static bool IsScatter(Symbol s) => s == Symbol.Coin;
}
