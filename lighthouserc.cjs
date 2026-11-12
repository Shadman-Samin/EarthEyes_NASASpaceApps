const { chromium } = require("@playwright/test")

module.exports = {
  ci: {
    collect: {
      chromePath: chromium.executablePath(),
      staticDistDir: "./dist",
      url: ["http://localhost/"],
    },
    assert: {
      assertions: {
        "categories:accessibility": ["error", { minScore: 0.95 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:performance": ["warn", { minScore: 0.75 }],
        "resource-summary:script:size": ["warn", { maxNumericValue: 650000 }],
      },
    },
    upload: { target: "filesystem", outputDir: "./.lighthouseci/reports" },
  },
}
