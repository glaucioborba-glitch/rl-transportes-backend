export function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pick<T>(seed: number, arr: readonly T[]): T {
  return arr[seed % arr.length]!;
}
