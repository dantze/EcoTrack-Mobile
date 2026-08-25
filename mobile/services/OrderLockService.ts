// Stub — OrderLockService is not yet implemented
export const LOCK_TYPE = {
    RIDICARI_EDIT: 'RIDICARI_EDIT',
} as const;

export const OrderLockService = {
    acquireLock: async (_type: string, _id: string, _user: string) => {
        return { locked: true, message: null };
    },
    releaseLock: async (_type: string, _id: string, _user: string) => {
        // no-op
    },
};
