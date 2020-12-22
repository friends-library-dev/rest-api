export interface RouteGenerator<T> {
  (): Promise<Record<string, T>>;
}
