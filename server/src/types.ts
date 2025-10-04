export interface WhiteboardData {
    version: string;
    objects: any[];
    background: string;
}

export interface Room {
    users: Set<string>;
    whiteboardData: WhiteboardData | null;
}

export interface User {
    id: string;
    roomId: string;
}
