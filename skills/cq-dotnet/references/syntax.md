# Syntax

- Latest syntax the project's C# version supports: `[]` over `ImmutableList<T>.Empty`. Traditional constructors are the one exception.
- `var` for locals. Target-typed `new()` where the type is already stated and has no `Of` factory.
- Never nest calls or object creation. Name each step as a local.
- Property paths read inline: `order.Customer.Address.City`. Never a local that only aliases a property.
- Expression-bodied members for single-return methods, `=>` on the signature line. `extension(T self)` blocks for extension methods.
- Hard wrap at 120 chars. A longer signature or call puts one parameter or argument per line. Signatures over 3 parameters chop at any length. No filler blank lines.
- A string literal stays whole on one line, even past 120 chars; log templates included. Never join literals with `+` to wrap.
- A multi-line call, initializer, or collection closes on its own line: `);`, `};`, `];`.
- File-scoped namespace matching the folder. One type per file, nested types too, except CDK construct props beside their construct and generic overloads of one name, which share the file. No `#region`.
- Plain `using` directives. A `using X = Namespace.Type;` alias only when no plain using or other fix avoids the clash.
- Group statements and member declarations by kind: constants, fields, guards, checks, declarations, calls, return. No blank line inside a group, one between groups.

```csharp
public async Task<Refund> RequestAsync(
    PaymentId paymentId,
    Cents amount,
    RefundReason reason,
    CancellationToken cancellationToken)
{
    ArgumentNullException.ThrowIfNull(reason);

    var requestedAt = timeProvider.GetUtcNow();
    var refundRequest = RefundRequest.Of(paymentId, amount, reason, requestedAt);

    var refund = await paymentGateway.RefundAsync(refundRequest, cancellationToken);

    return refund;
}
```
