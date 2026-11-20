// A file can make the MCP catalogue gate usable without proving that Codex reloaded a route.
// Keep that disk evidence separate from observed runtime requests in both state and reports.
function catalogVerificationPatch(state, picker, health) {
  if (state.coreSetupComplete !== true || picker.readable !== true) return null;
  if (picker.source === "external" && picker.models.length > 0) {
    return {
      codexCatalogVerified: true,
      codexCatalogVerificationSource: "external-model-catalog",
    };
  }
  if (picker.source === "bridge"
    && Number.isSafeInteger(health?.successful_model_catalog_requests)
    && health.successful_model_catalog_requests >= 1) {
    return {
      codexCatalogVerified: true,
      codexCatalogVerificationSource: "codex-request",
      codexRestartRequired: false,
    };
  }
  return null;
}

// Older fork builds persisted "verified" for both kinds of evidence without recording which.
// Recheck once on upgrade instead of retaining an unsupported restart-complete claim.
function legacyCatalogVerificationPatch(state) {
  if (state.coreSetupComplete === true && state.codexCatalogVerified === true
    && !["codex-request", "external-model-catalog"].includes(state.codexCatalogVerificationSource)) {
    return { codexCatalogVerified: false, codexRestartRequired: true };
  }
  return null;
}

module.exports = { catalogVerificationPatch, legacyCatalogVerificationPatch };
