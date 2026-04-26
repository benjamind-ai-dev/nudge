export class BusinessNotFoundError extends Error {
  constructor(id: string) {
    super(`Business ${id} not found`);
  }
}
