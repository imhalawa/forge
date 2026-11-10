# Collections

- `Immutable*` or frozen types for fields, properties, parameters, returns. Never `IReadOnly*` or `ReadOnlyCollection`.
- `readonly`, `ReadOnlySpan<T>`, and third-party signatures stay.
- Collection expressions `[...]` and spread `[.. source]`, not `new T[] { }` or `.ToList()`.
- Collection initializers for `Add`-based types: `new MultipartFormDataContent { { targetField, TargetField } }`. Never a separate `Add` after creation.
- Materialize before crossing a module seam. Never return lazy `IEnumerable`.

```diff
- public IReadOnlyList<PaymentId> PaymentIds { get; } = new List<PaymentId>().AsReadOnly();
+ public ImmutableList<PaymentId> PaymentIds { get; } = [];

- return payments.Where(payment => payment.IsSettled);
+ return [.. payments.Where(payment => payment.IsSettled)];
```
