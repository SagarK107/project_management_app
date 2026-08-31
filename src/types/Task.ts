export const Status = {
    NOT_STARTED: "NOT_STARTED",
    IN_PROGRESS: "IN_PROGRESS",
    ON_HOLD: "ON_HOLD",
    DONE: "DONE",
} as const;

export type Status = typeof Status[keyof typeof Status];

export type Task = {
    id: number,
    name: string,
    description: string,
    status: Status,
    projectId: number,
    createdAt: Date
}