const env = process.env;

if (!env.CMN_PROVIDER_WIF) {
    throw new Error('Env variable CMN_PROVIDER_WIF is required!');
}

if (!env.CMN_PROVIDER_USERNAME) {
    throw new Error('Env variable CMN_PROVIDER_USERNAME is required!');
}

if (!env.CMN_CYBERWAY_HTTP_URL) {
    throw new Error('Env variable CMN_CYBERWAY_HTTP_URL is required!');
}
module.exports = {
    GLS_CONNECTOR_HOST: env.GLS_CONNECTOR_HOST || '127.0.0.0',
    GLS_CONNECTOR_PORT: env.GLS_CONNECTOR_PORT || 3000,
    CMN_PROVIDER_WIF: env.CMN_PROVIDER_WIF,
    CMN_PROVIDER_USERNAME: env.CMN_PROVIDER_USERNAME,
    CMN_PROVIDER_PUBLIC_KEY: env.CMN_PROVIDER_PUBLIC_KEY,
    GLS_CHANNEL_TTL: env.GLS_CHANNEL_TTL || 1000,
    CMN_CYBERWAY_HTTP_URL: env.CMN_CYBERWAY_HTTP_URL,
};
