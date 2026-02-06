(async () => {
  try {
    await import("./src/server.js");
  } catch (err) {
    console.error("Failed to start backend:", err);
    process.exit(1);
  }
})();
