# Types

- Traditional constructor, readonly fields, `ArgumentNullException.ThrowIfNull` per dependency. Never primary constructors.
- `internal sealed` by default. Interfaces only at real seams: I/O, time, external services.
- Records for immutable models, validated `readonly record struct` for IDs and constrained values. Named records, never tuples.
- Host payloads keep fields as the primitives they arrive as: `long? CustomerId`. The mapping into the core builds value types. Never a custom `JsonConverter`.
- Records with parameters expose static `Of(...)` factories. Call sites use `Cents.Of(...)`, or an implicit conversion that validates as `Of` does, not `new`, unless named arguments read better. Never `FromX`, `New`, or `Create`.
- One overload per numeric width the callers pass: `SetIfPresent(..., int?)` beside `SetIfPresent(..., long?)`. Never let an `int?` bind to the `long?` overload by implicit widening.

```csharp
internal sealed class RefundRequester
{
    private readonly IPaymentGateway paymentGateway;
    private readonly TimeProvider timeProvider;

    public RefundRequester(IPaymentGateway paymentGateway, TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(paymentGateway);
        ArgumentNullException.ThrowIfNull(timeProvider);

        this.paymentGateway = paymentGateway;
        this.timeProvider = timeProvider;
    }
}

internal readonly record struct Cents
{
    private Cents(long value) => Value = value;

    public long Value { get; }

    public static Cents Of(long value) =>
        value >= 0 ? new(value) : throw new ArgumentOutOfRangeException(nameof(value));
}
```
