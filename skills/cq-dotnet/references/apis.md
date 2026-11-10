# APIs

- Swagger operations get a one-line `[SwaggerOperation(Summary = "...")]`. No `Description`.
- Reject invalid caller input at the API with an error code. Never answer it as a business outcome. The core takes a validated type, so it cannot receive the invalid value.
