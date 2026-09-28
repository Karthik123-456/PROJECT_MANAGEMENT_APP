export function createAuthController(authService) {
  return {
    async register(req, res) {
      const result = await authService.register(req.validated.body);
      res.status(201).json(result);
    },

    async login(req, res) {
      const result = await authService.login(req.validated.body);
      res.status(200).json(result);
    },

    me(req, res) {
      res.status(200).json({ user: req.user });
    },
  };
}
