// The deploy branch is static by default. Live-service integration tests opt out.
export const IS_STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO !== "false";
