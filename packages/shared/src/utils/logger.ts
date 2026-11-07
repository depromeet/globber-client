const isDev = process.env.NODE_ENV === "development";

export const logger = {
  error: (message: string, error?: unknown) => {
    if (isDev) console.error(message, error);
    else console.error(message, error instanceof Error ? error.message : "Unknown error");
  },
};
