function createTokenStore() {
  let token: string | null = null;

  return {
    getToken: () => token,
    setToken: (newToken: string) => {
      token = newToken;
    },
    clearToken: () => {
      token = null;
    },
  };
}

export const tokenStore = createTokenStore();
