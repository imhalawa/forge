# Tests

## Scope
- Reuse existing fixtures, factories, mocks, and extensions. Search the shared test projects before writing new ones.
- Unit tests cover one piece of logic. External-service scenarios go in integration tests.
- Never test language features: record properties, setters, factory assignments, or a value type's own guards and operators. Cover those through the behaviour that uses them.
- Payloads live in `TestData/**/*.json` fixtures read with `TestData.Read(...)`. Never inline JSON as a string constant.
- A test reads its fixture into a local where it is used. Never a class field holding a fixture one test uses.

## Structure
- Name tests `Behavior_Scenario_Result`. Unit tests use Arrange/Act/Assert; integration tests use Given/When/Then.
- Phases are comments only, never helper methods. Each describes the case: `// Given a caller with no roles`. No empty phase comment.
- The act phase holds only the call under test.
- The act phase stores what the call returns in `result`, whatever it holds.
- Moq setups stay inline in arrange. Assert with FluentAssertions on what was recorded (`mock.Invocations`), never `Verify` or a helper that wraps it.
- Shared setup goes in the test class constructor: frozen mocks, their default setups, `_sut = Fixture.CreateSut<T>()`. Tests call `_sut` themselves; never a helper that creates the subject or wraps the call.
- `[Fact]`/`[Theory]` methods first, TheoryData providers at the bottom.

## Rules
- No if/else, loops, or private methods. Partition theories by outcome, build TheoryData with LINQ.
- Helpers go in extension classes, never in a TestBase.
- One reason to fail. Never derive the expected value from the theory input.
- Never `!` or `?.`. Assert non-null with FluentAssertions, then continue with the asserted value.
- Each test is self-contained. Integration cleanup resets every resource: drain queues, truncate tables.
- One assertion per statement, on a named local: `var paymentIds = rows.Select(...);` then `paymentIds.Should()...`. No `.And`, `.Which`, or LINQ chained into `Should()`.

## Tooling
- xUnit, FluentAssertions 7.x, Moq through AutoMoq (`Fixture.MockOf<T>()`), AutoFixture for incidental data.
- Fix time, IDs, and behavior-driving inputs. Freeze deliberate dependencies.
- Tag `[Trait("Category", ...)]` as Unit, Integration, or Live.

```csharp
[Fact]
[Trait("Category", "Unit")]
public void Redeem_AmountAboveBalance_IsRefused()
{
    // Arrange a card holding 10.00
    var giftCard = GiftCard.Of(GiftCardCode.Of("GC-1"), Cents.Of(1000));

    // Act
    var result = giftCard.Redeem(Cents.Of(1500));

    // Assert the payment is refused
    result.Should().BeOfType<RedeemResult.Refused>();
}
```
