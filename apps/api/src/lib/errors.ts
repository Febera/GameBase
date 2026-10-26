/** Erro vindo de uma API externa (IGDB, Twitch, etc.). Vira HTTP 502 para o frontend. */
export class UpstreamError extends Error {
  constructor(
    readonly source: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}

/** Entrada inválida enviada pelo cliente. Vira HTTP 400. */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/** Recurso que depende de uma variável de ambiente não configurada. Vira HTTP 503. */
export class MissingConfigError extends Error {
  constructor(
    readonly variable: string,
    message: string,
  ) {
    super(message);
    this.name = 'MissingConfigError';
  }
}

/** Recurso inexistente. Vira HTTP 404. */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Jogo com foco em conteúdo sexual pedido com o filtro ligado. Vira HTTP 403. */
export class AdultContentError extends Error {
  constructor() {
    super('Este jogo tem foco em conteúdo sexual e está oculto pelo filtro em Opções.');
    this.name = 'AdultContentError';
  }
}

/** Limite de pedidos atingido. Vira HTTP 429. */
export class TooManyRequestsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}
