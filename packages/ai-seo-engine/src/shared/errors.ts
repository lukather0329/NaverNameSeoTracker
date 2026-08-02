/** ai-seo-engine 공통 에러. 엔진별로 이 클래스를 상속해 세분화한다. */
export class AiSeoEngineError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AiSeoEngineError";
    this.code = code;
  }
}

export class ValidationError extends AiSeoEngineError {
  constructor(message: string) {
    super("VALIDATION_ERROR", message);
    this.name = "ValidationError";
  }
}

export class InsufficientDataError extends AiSeoEngineError {
  constructor(message: string) {
    super("INSUFFICIENT_DATA", message);
    this.name = "InsufficientDataError";
  }
}

export class ConflictError extends AiSeoEngineError {
  constructor(message: string) {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}
