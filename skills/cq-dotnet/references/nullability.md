# Nullability

- Never the null-forgiving `!`. Use `?? throw new InvalidOperationException("<what is missing>")`.
- A required value is never nullable. Fix the type; never validate around it.
- Model absence explicitly and validate it at the owning seam.

```diff
- var merchant = merchants.Find(merchantId)!;
+ var merchant = merchants.Find(merchantId)
+     ?? throw new InvalidOperationException($"Merchant {merchantId} is not configured");
```
