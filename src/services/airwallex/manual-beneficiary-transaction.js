export async function runManualBeneficiaryLinkTransaction(
  connection,
  { validate, link, consume }
) {
  if (
    !connection ||
    typeof connection.startSession !== "function" ||
    typeof validate !== "function" ||
    typeof link !== "function" ||
    typeof consume !== "function"
  ) {
    throw new Error("AIRWALLEX_MANUAL_TRANSACTION_INVALID");
  }

  const session = await connection.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      await validate(session);
      result = await link(session);
      await consume(session);
    });

    return result;
  } finally {
    await session.endSession();
  }
}
