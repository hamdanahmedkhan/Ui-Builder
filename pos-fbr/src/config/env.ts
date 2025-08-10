export const env = {
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  fbr: {
    enabled: (process.env.FBR_ENABLED || 'false').toLowerCase() === 'true',
    baseUrl: process.env.FBR_API_BASE_URL || '',
    clientId: process.env.FBR_CLIENT_ID || '',
    clientSecret: process.env.FBR_CLIENT_SECRET || '',
    posId: process.env.FBR_POS_ID || '',
    ntn: process.env.FBR_NTN || '',
  },
  store: {
    name: process.env.STORE_NAME || 'My Store',
    address: process.env.STORE_ADDRESS || 'Address',
    phone: process.env.STORE_PHONE || '',
  },
};