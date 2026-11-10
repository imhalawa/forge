# Logging and comments

- Structured templates, named properties, exception passed separately. Log a failure once, where it is handled.
- Never log credentials, tokens, emails, or payloads.
- `Information` when the service did what was asked, a not-found lookup included. `Error` for real failures.
- `Warning` only when the service degrades, something unexpected happens, or a known condition will hurt performance.
- XML docs on interfaces, and on other public contracts with non-obvious semantics: short, definitive, one sentence. Implementations carry none; they inherit.
- `//` only where a reader would otherwise get it wrong, in definitive wording. Never a comment the code can explain: rename or extract instead.
- GraphQL and Swagger descriptions, XML docs and comments are plain, professional and definitive: state what it is or does. Never the story or the reasoning behind it.

```diff
- logger.LogError($"Refund failed for {paymentId}: {exception.Message}");
+ logger.LogError(exception, "Refund failed for {PaymentId}", paymentId);

- // Get the payment
  var payment = await paymentRepository.GetAsync(paymentId, cancellationToken);
```
