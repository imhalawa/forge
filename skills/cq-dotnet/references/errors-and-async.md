# Errors and async

- Expected outcomes whose cases carry no data are an enum. Cases that carry data are an abstract record plus top-level sealed records with an exhaustive `switch`. Never nested or `partial` records. Exceptions only for unexpected faults.
- `CancellationToken` last, always propagated. `Task`, not `ValueTask`. No `ConfigureAwait(false)`.
- Inject `TimeProvider`. UTC `DateTimeOffset` for instants. Explicit `StringComparison` always.

```csharp
internal enum UpsertOutcome
{
    Stored,
    Stale,
}

internal abstract record RedeemResult;

internal sealed record Redeemed(Cents RemainingBalance) : RedeemResult;

internal sealed record Refused(Cents Balance) : RedeemResult;

var message = result switch
{
    Redeemed redeemed => $"Left: {redeemed.RemainingBalance.Value}",
    Refused refused => $"Balance too low: {refused.Balance.Value}",
    _ => throw new UnreachableException(),
};
```

Each type goes in its own file per [syntax](syntax.md); they are shown together here only for reading.
