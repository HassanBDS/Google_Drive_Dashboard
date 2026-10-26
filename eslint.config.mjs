import nextPlugin from "eslint-config-next";

const eslintConfig = nextPlugin.map((cfg) => {
  if (cfg.name === "next") {
    return {
      ...cfg,
      rules: {
        ...cfg.rules,
        "import/no-anonymous-default-export": "off",
        "react-hooks/set-state-in-effect": "warn",
        "react-hooks/preserve-manual-memoization": "warn",
      },
    };
  }
  return cfg;
});

export default eslintConfig;
