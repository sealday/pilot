export type MemoryScope = "user" | "project" | "session";

export type MemoryRecord = {
  id: string;
  scope: MemoryScope;
  text: string;
  createdAt: string;
};
