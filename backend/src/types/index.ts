export interface User {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface MomentRow {
  id: string;
  user_id: string;
  photo_uri: string;
  caption: string;
  emotion: string | null;
  created_at: number;
  updated_at: number;
}

export interface AppendNoteRow {
  id: string;
  moment_id: string;
  text: string;
  created_at: number;
}

export interface JwtPayload {
  userId: string;
  username: string;
}
