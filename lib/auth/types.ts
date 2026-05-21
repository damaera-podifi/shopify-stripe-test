export type UserRecord = {
  id: string;
  email: string;
  password: string;
  shopifyCustomerId: string | null;
  createdAt: string;
};

export type UsersDatabase = {
  users: UserRecord[];
};

export type SessionUser = {
  id: string;
  email: string;
  shopifyCustomerId: string | null;
};
