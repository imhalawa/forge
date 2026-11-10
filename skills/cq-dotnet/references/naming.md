# Naming

- Name every identifier for the domain concept it holds or does, never for its type, position, or step in the flow.
- Full descriptive names, never abbreviations or single letters. Match the naming of sibling members.
- Plain everyday words: `IsEligibleAsync`, `CheckAsync`, `GetRatesAsync`. Never a heavy word like `Judge`, `Adjudicate` or `Ascertain`.
- A command type whose `Execute` takes an input and changes state is an agent noun: `InvoiceSender`, `IInvoiceSender`. Never a verb phrase.
- Acronyms as words: `Http`, `Json`, `Id`. No `Dto` suffix: `Request`, `Response`, `Payload`, `Row`.
- Never hardcode strings, delimiters, or magic numbers. Define each once as a named constant. Exception and error messages stay inline where they are raised.
- A constant one member uses lives in that member: a local `const` or the parameter's default. Class-level constants only when several members share them.
- Error codes a caller receives live in one static `ErrorCodes` class per project, never in `Global`.
- Never a constant for two constants joined. Interpolate the parts at each use, or compose them in a method: `ToCacheKey(...)`.
- `With...` only for fluent builder methods. Locals named for what they hold: `invoiceSnapshot`, never `withInvoice`.

```diff
- var list = await repo.GetAsync(id, ct);
+ var openInvoices = await invoiceRepository.GetOpenAsync(customerId, cancellationToken);

- internal sealed class SendInvoice
+ internal sealed class InvoiceSender

- public sealed record PaymentDTO(string URL);
+ public sealed record PaymentResponse(string Url);
```
